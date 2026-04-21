export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";
import { getShopifyProductsByCollectionIds } from "@/lib/shopify";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

type JsonMap = Record<string, string>;

function isMissingLineItemMappingColumn(error: any) {
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return text.includes("line_item_mapping_json") && text.includes("does not exist");
}

function toMap(input: unknown): JsonMap {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: JsonMap = {};
  for (const [rawKey, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    const key = String(rawKey || "").trim().toLowerCase();
    const val = value.trim();
    if (key && val) out[key] = val;
  }
  return out;
}

async function requireAdmin() {
  const session: any = await getSession();
  const role = (session?.user?.role ?? "").toString().toLowerCase();
  return role === "admin";
}

export async function GET() {
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const supabase = getServerSupabaseClient();
    let settings: any = null;
    let settingsError: any = null;
    let schemaWarning: string | null = null;
    const fullSettingsResult = await supabase
      .from("shopify_settings")
      .select("allowed_collection_ids, line_item_mapping_json")
      .eq("id", SETTINGS_ID)
      .maybeSingle();

    settings = fullSettingsResult.data;
    settingsError = fullSettingsResult.error;

    if (settingsError && isMissingLineItemMappingColumn(settingsError)) {
      const fallback = await supabase
        .from("shopify_settings")
        .select("allowed_collection_ids")
        .eq("id", SETTINGS_ID)
        .maybeSingle();
      settings = fallback.data;
      settingsError = fallback.error;
      schemaWarning = "Database is missing shopify_settings.line_item_mapping_json; explicit SKU mappings are disabled until migrations are applied.";
    }

    if (settingsError) throw settingsError;

    const allowedCollectionIds = (settings?.allowed_collection_ids || []) as string[];
    const explicitMap = toMap(settings?.line_item_mapping_json);

    const { data: priceRows, error: priceError } = await supabase
      .from("price_list_items")
      .select("item_no, qbo_item_id")
      .not("qbo_item_id", "is", null);
    if (priceError) throw priceError;

    const priceMap: JsonMap = {};
    (priceRows || []).forEach((row: any) => {
      const sku = String(row.item_no || "").trim().toLowerCase();
      const qboItemId = String(row.qbo_item_id || "").trim();
      if (sku && qboItemId) priceMap[sku] = qboItemId;
    });

    let products: any[] = [];
    let warning: string | null = schemaWarning;
    try {
      products = await getShopifyProductsByCollectionIds(allowedCollectionIds);
    } catch (shopifyError: any) {
      warning = shopifyError?.message || "Unable to fetch Shopify products";
      products = [];
    }
    const rows: Array<{
      sku: string;
      variantId: number;
      productTitle: string;
      variantTitle: string;
      mappedQboItemId: string | null;
      mappingSource: "explicit" | "price_list" | "none";
    }> = [];

    for (const product of products || []) {
      for (const variant of product?.variants || []) {
        const sku = String(variant?.sku || "").trim();
        if (!sku) continue;

        const key = sku.toLowerCase();
        const explicit = explicitMap[key] || null;
        const priceList = priceMap[key] || null;

        rows.push({
          sku,
          variantId: Number(variant.id),
          productTitle: String(product.title || ""),
          variantTitle: String(variant.title || ""),
          mappedQboItemId: explicit || priceList,
          mappingSource: explicit ? "explicit" : priceList ? "price_list" : "none",
        });
      }
    }

    rows.sort((a, b) => a.sku.localeCompare(b.sku));

    return NextResponse.json({
      ok: true,
      mappings: rows,
      explicitMap,
      warning,
      counts: {
        total: rows.length,
        explicit: rows.filter((r) => r.mappingSource === "explicit").length,
        price_list: rows.filter((r) => r.mappingSource === "price_list").length,
        unmapped: rows.filter((r) => r.mappingSource === "none").length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch Shopify/QBO product mappings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const rawSku = String(body?.sku || "").trim();
    const qboItemId = body?.qbo_item_id ? String(body.qbo_item_id).trim() : null;

    if (!rawSku) {
      return NextResponse.json({ error: "sku is required" }, { status: 400 });
    }

    const skuKey = rawSku.toLowerCase();
    const supabase = getServerSupabaseClient();

    const { data: existing, error: existingError } = await supabase
      .from("shopify_settings")
      .select("line_item_mapping_json")
      .eq("id", SETTINGS_ID)
      .maybeSingle();
    if (existingError) {
      if (isMissingLineItemMappingColumn(existingError)) {
        return NextResponse.json(
          { error: "Database is missing shopify_settings.line_item_mapping_json. Run the latest Supabase migrations first." },
          { status: 400 }
        );
      }
      throw existingError;
    }

    const map = toMap(existing?.line_item_mapping_json);
    if (qboItemId) {
      map[skuKey] = qboItemId;
    } else {
      delete map[skuKey];
    }

    const { error: upsertError } = await supabase
      .from("shopify_settings")
      .upsert({
        id: SETTINGS_ID,
        line_item_mapping_json: map,
        updated_at: new Date().toISOString(),
      });
    if (upsertError) {
      if (isMissingLineItemMappingColumn(upsertError)) {
        return NextResponse.json(
          { error: "Database is missing shopify_settings.line_item_mapping_json. Run the latest Supabase migrations first." },
          { status: 400 }
        );
      }
      throw upsertError;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save Shopify/QBO product mapping" },
      { status: 500 }
    );
  }
}