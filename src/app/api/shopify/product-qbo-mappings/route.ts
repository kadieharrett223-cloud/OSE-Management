export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";
import { getShopifyProducts, getShopifyTokens } from "@/lib/shopify";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

type JsonMap = Record<string, string>;

type MappingRow = {
  mappingKey: string;
  lineItemTitle: string;
  variantId: number;
  productTitle: string;
  variantTitle: string;
  mappedQboItemId: string | null;
  mappingSource: "explicit" | "price_list" | "none";
};

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

function normalizeToken(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function titleMappingKey(value: string | null | undefined): string | null {
  const title = normalizeToken(value);
  return title ? `title:${title}` : null;
}

function titleFromMappingKey(key: string): string {
  return key.startsWith("title:") ? key.slice("title:".length) : key;
}

function buildVariantSummary(product: any): string {
  const parts = (product?.variants || [])
    .map((variant: any) => {
      const sku = String(variant?.sku || "").trim();
      const title = String(variant?.title || "").trim();
      return [sku, title && title !== "Default Title" ? title : ""].filter(Boolean).join(" · ");
    })
    .filter(Boolean);

  return parts.slice(0, 3).join(" | ");
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
      schemaWarning = "Database is missing shopify_settings.line_item_mapping_json; explicit title mappings are disabled until migrations are applied.";
    }

    if (settingsError) throw settingsError;

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
      products = await getShopifyProducts();
    } catch (shopifyError: any) {
      warning = shopifyError?.message || "Unable to fetch Shopify products";
      products = [];
    }

    const rows: MappingRow[] = [];
    const seenTitleKeys = new Set<string>();

    for (const product of products || []) {
      const productTitle = String(product?.title || "").trim();
      const mappingKey = titleMappingKey(productTitle);
      if (!mappingKey || seenTitleKeys.has(mappingKey)) continue;

      const variantPriceIds = new Set<string>();
      for (const variant of product?.variants || []) {
        const sku = String(variant?.sku || "").trim().toLowerCase();
        const qboItemId = sku ? priceMap[sku] : null;
        if (qboItemId) variantPriceIds.add(qboItemId);
      }

      const explicit = explicitMap[mappingKey] || null;
      const priceList = variantPriceIds.size === 1 ? Array.from(variantPriceIds)[0] : null;

      rows.push({
        mappingKey,
        lineItemTitle: productTitle,
        variantId: Number(product?.id || rows.length + 1),
        productTitle,
        variantTitle: buildVariantSummary(product),
        mappedQboItemId: explicit || priceList,
        mappingSource: explicit ? "explicit" : priceList ? "price_list" : "none",
      });
      seenTitleKeys.add(mappingKey);
    }

    const orderTitleMap = new Map<string, string>();
    try {
      const tokens = await getShopifyTokens();
      if (tokens) {
        const createdAtMin = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
        const params = new URLSearchParams({
          limit: "250",
          status: "any",
          created_at_min: createdAtMin,
          fields: "id,line_items",
        });

        const ordersRes = await fetch(
          `https://${tokens.shop}/admin/api/2024-01/orders.json?${params.toString()}`,
          {
            headers: {
              "X-Shopify-Access-Token": tokens.access_token,
              "Content-Type": "application/json",
            },
          }
        );

        if (ordersRes.ok) {
          const payload = (await ordersRes.json()) as { orders?: any[] };
          for (const order of payload.orders || []) {
            for (const line of order?.line_items || []) {
              const mappingKey = titleMappingKey(line?.title);
              const lineItemTitle = String(line?.title || "").trim();
              if (mappingKey && lineItemTitle && !orderTitleMap.has(mappingKey)) {
                orderTitleMap.set(mappingKey, lineItemTitle);
              }
            }
          }
        }
      }
    } catch {
      // Non-fatal: recent order titles simply won't be auto-discovered this time.
    }

    for (const key of Object.keys(explicitMap)) {
      if (!key.startsWith("title:")) continue;
      if (!orderTitleMap.has(key) && !seenTitleKeys.has(key)) {
        orderTitleMap.set(key, titleFromMappingKey(key));
      }
    }

    let syntheticId = -1;
    for (const [mappingKey, lineItemTitle] of orderTitleMap) {
      if (seenTitleKeys.has(mappingKey)) continue;
      const explicit = explicitMap[mappingKey] || null;
      rows.push({
        mappingKey,
        lineItemTitle,
        variantId: syntheticId--,
        productTitle: lineItemTitle,
        variantTitle: "Seen on Shopify orders",
        mappedQboItemId: explicit,
        mappingSource: explicit ? "explicit" : "none",
      });
      seenTitleKeys.add(mappingKey);
    }

    rows.sort((a, b) => a.lineItemTitle.localeCompare(b.lineItemTitle));

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

/** PUT /api/shopify/product-qbo-mappings — bulk save Shopify title→item pairs */
export async function PUT(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const entries: { mappingKey?: string; sku?: string; qbo_item_id: string | null }[] = Array.isArray(body?.mappings)
      ? body.mappings
      : [];

    if (entries.length === 0) {
      return NextResponse.json({ error: "mappings array is required and must not be empty" }, { status: 400 });
    }

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
    for (const { mappingKey, sku, qbo_item_id } of entries) {
      const key = String(mappingKey || sku || "").trim().toLowerCase();
      if (!key) continue;
      const itemId = qbo_item_id ? String(qbo_item_id).trim() : null;
      if (itemId) map[key] = itemId;
      else delete map[key];
    }

    const { error: upsertError } = await supabase
      .from("shopify_settings")
      .upsert({ id: SETTINGS_ID, line_item_mapping_json: map, updated_at: new Date().toISOString() });
    if (upsertError) {
      if (isMissingLineItemMappingColumn(upsertError)) {
        return NextResponse.json(
          { error: "Database is missing shopify_settings.line_item_mapping_json. Run the latest Supabase migrations first." },
          { status: 400 }
        );
      }
      throw upsertError;
    }

    return NextResponse.json({ ok: true, saved: entries.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to bulk-save Shopify/QBO product mappings" },
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
    const rawKey = String(body?.mappingKey || body?.sku || "").trim();
    const qboItemId = body?.qbo_item_id ? String(body.qbo_item_id).trim() : null;

    if (!rawKey) {
      return NextResponse.json({ error: "mappingKey is required" }, { status: 400 });
    }

    const key = rawKey.toLowerCase();
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
    if (qboItemId) map[key] = qboItemId;
    else delete map[key];

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