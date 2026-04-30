import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000002";
const DEFAULT_TARIFF_PERCENT = 100;

function computeFinalCostForTariffChange(row: any, tariffPercent: number) {
  const supplier = String(row?.supplier ?? "").toUpperCase();
  const isKatool = supplier.includes("KATOOL") || supplier.includes("KATA");
  const tariffExempt = Boolean(row?.tariff_exempt) || isKatool;

  const fobCost = Number(row?.fob_cost ?? 0);
  const quantity = Number(row?.quantity ?? 0);
  const zone5Shipping = Number(row?.zone5_shipping ?? 0);

  if (tariffExempt) {
    return fobCost + zone5Shipping;
  }

  const tariff = fobCost * (1 + tariffPercent / 100);
  const ocean = quantity > 0 ? 3000 / quantity : Number(row?.ocean_frt ?? 0);
  const importing = quantity > 0 ? 2100 / quantity : Number(row?.importing ?? 0);

  return tariff + ocean + importing + zone5Shipping;
}

function clampMargin(margin: number) {
  if (!Number.isFinite(margin)) return 0;
  if (margin >= 0.95) return 0.95;
  if (margin <= -5) return -5;
  return Number(margin.toFixed(6));
}

export async function GET() {
  try {
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();

    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from("pricing_settings")
      .select("id, global_tariff_percent")
      .eq("id", SETTINGS_ID)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      settings: {
        id: SETTINGS_ID,
        global_tariff_percent: Number(data?.global_tariff_percent ?? DEFAULT_TARIFF_PERCENT),
      },
    });
  } catch (error: any) {
    console.error("Get pricing settings error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch pricing settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();

    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const body = await req.json();
    const parsedTariff = Number(body?.global_tariff_percent);
    const keepSellPrices = Boolean(body?.keep_sell_prices);

    if (!Number.isFinite(parsedTariff) || parsedTariff < 0 || parsedTariff > 500) {
      return NextResponse.json({ error: "global_tariff_percent must be a number between 0 and 500" }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();

    const { error: upsertError } = await supabase
      .from("pricing_settings")
      .upsert({
        id: SETTINGS_ID,
        global_tariff_percent: parsedTariff,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) throw upsertError;

    if (!keepSellPrices) {
      const { error: recalcError } = await supabase
        .from("price_list_items")
        .update({ updated_at: new Date().toISOString() })
        .or("manual_pricing_override.is.null,manual_pricing_override.eq.false");

      if (recalcError) throw recalcError;
    } else {
      let from = 0;
      const batchSize = 500;
      let adjustedCount = 0;

      while (true) {
        const { data: rows, error: rowsError } = await supabase
          .from("price_list_items")
          .select("id,supplier,tariff_exempt,fob_cost,quantity,ocean_frt,importing,zone5_shipping,sell_price")
          .or("manual_pricing_override.is.null,manual_pricing_override.eq.false")
          .range(from, from + batchSize - 1);

        if (rowsError) throw rowsError;

        if (!rows || rows.length === 0) {
          break;
        }

        for (const row of rows) {
          const existingSell = Number(row.sell_price ?? 0);

          if (!Number.isFinite(existingSell) || existingSell <= 0) {
            const { error: touchError } = await supabase
              .from("price_list_items")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", row.id);

            if (touchError) throw touchError;
            continue;
          }

          const finalCost = computeFinalCostForTariffChange(row, parsedTariff);
          const nextMargin = clampMargin(1 - finalCost / existingSell);

          const { error: updateRowError } = await supabase
            .from("price_list_items")
            .update({
              margin: nextMargin,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);

          if (updateRowError) throw updateRowError;
          adjustedCount += 1;
        }

        if (rows.length < batchSize) {
          break;
        }

        from += batchSize;
      }

      return NextResponse.json({
        ok: true,
        settings: {
          id: SETTINGS_ID,
          global_tariff_percent: parsedTariff,
        },
        keep_sell_prices: true,
        adjusted_rows: adjustedCount,
      });
    }

    return NextResponse.json({
      ok: true,
      settings: {
        id: SETTINGS_ID,
        global_tariff_percent: parsedTariff,
      },
      keep_sell_prices: false,
    });
  } catch (error: any) {
    console.error("Update pricing settings error:", error);
    return NextResponse.json({ error: error.message || "Failed to update pricing settings" }, { status: 500 });
  }
}
