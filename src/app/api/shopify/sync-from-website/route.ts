export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";
import { shopifyApiFetch } from "@/lib/shopify";

type ShopifyVariantPayload = {
  variant?: {
    id?: number;
    product_id?: number;
    price?: string;
    compare_at_price?: string | null;
  };
};

type PreviewRow = {
  id: string;
  item_no: string;
  local_sell_price: number;
  local_list_price: number;
  website_sell_price: number | null;
  website_compare_at_price: number | null;
};

type PricingRow = {
  id: string;
  item_no: string;
  shopify_variant_id: string | null;
  sell_price: number | null;
  list_price: number | null;
  cost_with_shipping: number | null;
  manual_pricing_override: boolean | null;
  website_product_url: string | null;
  fob_cost: number | null;
  quantity: number | null;
  tariff_105: number | null;
  ocean_frt: number | null;
  importing: number | null;
  indirect_labor: number | null;
  direct_labor: number | null;
  overhead_cost: number | null;
  zone5_shipping: number | null;
  tariff_exempt: boolean | null;
  margin: number | null;
};

type MarginMode = "multiply" | "divide";

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampMargin(margin: number) {
  if (!Number.isFinite(margin)) return 0;
  if (margin >= 0.9999999999) return 0.9999999999;
  if (margin <= -5) return -5;
  return Number(margin.toFixed(12));
}

async function getMappedRows() {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from("price_list_items")
    .select(
      "id,item_no,shopify_variant_id,sell_price,list_price,cost_with_shipping,manual_pricing_override,website_product_url,fob_cost,quantity,tariff_105,ocean_frt,importing,indirect_labor,direct_labor,overhead_cost,zone5_shipping,tariff_exempt,margin"
    )
    .eq("is_active", true)
    .not("shopify_variant_id", "is", null);

  if (error) throw error;
  return (data || []) as PricingRow[];
}

async function getGlobalTariffPercent() {
  const supabase = getServerSupabaseClient();
  const { data } = await supabase
    .from("pricing_settings")
    .select("global_tariff_percent")
    .eq("id", "00000000-0000-0000-0000-000000000002")
    .maybeSingle();

  const value = Number(data?.global_tariff_percent ?? 100);
  return Number.isFinite(value) ? value : 100;
}

function computeFinalCostForUiMath(row: PricingRow, tariffPercent: number) {
  const fob = toNumber(row.fob_cost);
  const qty = toNumber(row.quantity);
  const zone5 = toNumber(row.zone5_shipping);
  const indirect = toNumber(row.indirect_labor);
  const direct = toNumber(row.direct_labor);
  const overhead = toNumber(row.overhead_cost);
  const isTariffExempt = row.tariff_exempt === true;
  const isManual = row.manual_pricing_override === true;

  let tariff = 0;
  let ocean = 0;
  let importing = 0;

  if (isTariffExempt) {
    tariff = 0;
    ocean = 0;
    importing = 0;
  } else if (isManual) {
    tariff = toNumber(row.tariff_105);
    ocean = toNumber(row.ocean_frt);
    importing = toNumber(row.importing);
  } else {
    tariff = fob * (1 + tariffPercent / 100);
    ocean = qty > 0 ? 8000 / qty : toNumber(row.ocean_frt);
    importing = qty > 0 ? 2100 / qty : toNumber(row.importing);
  }

  const perUnit = (isTariffExempt ? fob : tariff) + ocean + importing;
  return perUnit + zone5 + indirect + direct + overhead;
}

function detectMarginMode(rows: PricingRow[]): MarginMode {
  let multiplyScore = 0;
  let divideScore = 0;

  for (const row of rows) {
    const cost = toNumber(row.cost_with_shipping);
    const sell = toNumber(row.sell_price);
    const margin = Number(row.margin);

    if (cost <= 0 || sell <= 0 || !Number.isFinite(margin)) continue;

    const predictedMultiply = cost * (1 + margin);
    const predictedDivide = margin < 1 ? cost / (1 - margin) : Number.POSITIVE_INFINITY;

    const multiplyError = Math.abs(predictedMultiply - sell);
    const divideError = Math.abs(predictedDivide - sell);

    if (multiplyError <= divideError) multiplyScore += 1;
    else divideScore += 1;
  }

  return divideScore > multiplyScore ? "divide" : "multiply";
}

async function fetchVariantPricing(variantId: string) {
  const parsed = Number.parseInt(variantId, 10);
  if (Number.isNaN(parsed)) {
    return { sell: null, compareAt: null };
  }

  const payload = await shopifyApiFetch<ShopifyVariantPayload>(`/variants/${parsed}.json`);
  const variant = payload?.variant;

  if (!variant) return { sell: null, compareAt: null };

  const sell = variant.price != null ? Number(variant.price) : null;
  const compareAt = variant.compare_at_price != null ? Number(variant.compare_at_price) : null;

  return {
    sell: Number.isFinite(sell as number) ? (sell as number) : null,
    compareAt: Number.isFinite(compareAt as number) ? (compareAt as number) : null,
  };
}

export async function GET() {
  try {
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();

    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const rows = await getMappedRows();

    const preview: PreviewRow[] = [];
    for (const row of rows) {
      const variantId = String(row.shopify_variant_id || "");
      const website = await fetchVariantPricing(variantId);

      preview.push({
        id: String(row.id),
        item_no: String(row.item_no || ""),
        local_sell_price: toNumber(row.sell_price),
        local_list_price: toNumber(row.list_price),
        website_sell_price: website.sell,
        website_compare_at_price: website.compareAt,
      });
    }

    return NextResponse.json({ ok: true, preview });
  } catch (error: any) {
    console.error("Website sync preview error:", error);
    return NextResponse.json({ error: error.message || "Failed to load website price preview" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();

    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const supabase = getServerSupabaseClient();
    const rows = await getMappedRows();
    const globalTariffPercent = await getGlobalTariffPercent();
    const marginMode = detectMarginMode(rows);

    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const variantId = String(row.shopify_variant_id || "");
      const website = await fetchVariantPricing(variantId);

      if (!website.sell || website.sell <= 0) {
        skipped += 1;
        continue;
      }

      const finalCost = toNumber(row.cost_with_shipping) || computeFinalCostForUiMath(row, globalTariffPercent);
      if (finalCost <= 0) {
        skipped += 1;
        continue;
      }

      const nextMargin = clampMargin(
        marginMode === "divide"
          ? 1 - finalCost / website.sell
          : website.sell / finalCost - 1
      );
      const updatePayload: Record<string, unknown> = {
        margin: nextMargin,
        updated_at: new Date().toISOString(),
      };

      if (website.compareAt && website.compareAt > 0) {
        updatePayload.list_price = Number(website.compareAt.toFixed(2));
      }

      const { error } = await supabase
        .from("price_list_items")
        .update(updatePayload)
        .eq("id", row.id);

      if (error) {
        failed += 1;
        errors.push(`${row.item_no}: ${error.message}`);
        continue;
      }

      updated += 1;
    }

    return NextResponse.json({
      ok: true,
      updated,
      skipped,
      failed,
      margin_mode: marginMode,
      errors,
    });
  } catch (error: any) {
    console.error("Website sync pull error:", error);
    return NextResponse.json({ error: error.message || "Failed to sync from website prices" }, { status: 500 });
  }
}
