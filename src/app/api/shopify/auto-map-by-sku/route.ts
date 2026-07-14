export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";
import { getShopifyProducts, getShopifyTokens } from "@/lib/shopify";

function normalizeSku(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export async function POST() {
  try {
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();

    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const supabase = getServerSupabaseClient();
    const tokens = await getShopifyTokens();
    if (!tokens?.shop) {
      return NextResponse.json({ error: "Shopify is not connected" }, { status: 400 });
    }

    const [{ data: items, error: itemError }, products] = await Promise.all([
      supabase
        .from("price_list_items")
        .select("id, item_no, shopify_product_id, shopify_variant_id, website_product_url")
        .eq("is_active", true),
      getShopifyProducts(),
    ]);

    if (itemError) throw itemError;

    const variantsBySku = new Map<
      string,
      Array<{ variantId: string; productId: string; productHandle: string | null }>
    >();

    for (const product of products || []) {
      const productId = String(product?.id || "");
      const productHandle = product?.handle ? String(product.handle) : null;
      for (const variant of product?.variants || []) {
        const normalized = normalizeSku(variant?.sku);
        if (!normalized) continue;
        const existing = variantsBySku.get(normalized) || [];
        existing.push({
          variantId: String(variant?.id || ""),
          productId,
          productHandle,
        });
        variantsBySku.set(normalized, existing);
      }
    }

    let mapped = 0;
    let skippedNoMatch = 0;
    let skippedAmbiguous = 0;

    for (const item of items || []) {
      const normalizedItemSku = normalizeSku(item.item_no);
      if (!normalizedItemSku) {
        skippedNoMatch += 1;
        continue;
      }

      const candidates = variantsBySku.get(normalizedItemSku) || [];
      if (candidates.length === 0) {
        skippedNoMatch += 1;
        continue;
      }

      if (candidates.length > 1) {
        skippedAmbiguous += 1;
        continue;
      }

      const match = candidates[0];
      const websiteUrl = match.productHandle
        ? `https://${tokens.shop}/products/${match.productHandle}?variant=${match.variantId}`
        : item.website_product_url || null;

      const { error: updateError } = await supabase
        .from("price_list_items")
        .update({
          shopify_product_id: match.productId,
          shopify_variant_id: match.variantId,
          website_product_url: websiteUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (updateError) throw updateError;
      mapped += 1;
    }

    return NextResponse.json({
      ok: true,
      mapped,
      skipped_no_match: skippedNoMatch,
      skipped_ambiguous: skippedAmbiguous,
      total_items: (items || []).length,
    });
  } catch (error: any) {
    console.error("Auto map by SKU error:", error);
    return NextResponse.json({ error: error.message || "Failed to auto-map by SKU" }, { status: 500 });
  }
}
