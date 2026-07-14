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

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampMargin(margin: number) {
  if (!Number.isFinite(margin)) return 0;
  if (margin >= 0.95) return 0.95;
  if (margin <= -5) return -5;
  return Number(margin.toFixed(10));
}

async function getMappedRows() {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from("price_list_items")
    .select(
      "id,item_no,shopify_variant_id,sell_price,list_price,cost_with_shipping,manual_pricing_override,website_product_url"
    )
    .eq("is_active", true)
    .not("shopify_variant_id", "is", null);

  if (error) throw error;
  return data || [];
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

      const finalCost = toNumber(row.cost_with_shipping);
      if (finalCost <= 0) {
        skipped += 1;
        continue;
      }

      const nextMargin = clampMargin(website.sell / finalCost - 1);
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
      errors,
    });
  } catch (error: any) {
    console.error("Website sync pull error:", error);
    return NextResponse.json({ error: error.message || "Failed to sync from website prices" }, { status: 500 });
  }
}
