import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000002";
const DEFAULT_TARIFF_PERCENT = 100;

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

    // Trigger recalculation for all non-manual rows
    const { error: recalcError } = await supabase
      .from("price_list_items")
      .update({ updated_at: new Date().toISOString() })
      .or("manual_pricing_override.is.null,manual_pricing_override.eq.false");

    if (recalcError) throw recalcError;

    return NextResponse.json({
      ok: true,
      settings: {
        id: SETTINGS_ID,
        global_tariff_percent: parsedTariff,
      },
    });
  } catch (error: any) {
    console.error("Update pricing settings error:", error);
    return NextResponse.json({ error: error.message || "Failed to update pricing settings" }, { status: 500 });
  }
}
