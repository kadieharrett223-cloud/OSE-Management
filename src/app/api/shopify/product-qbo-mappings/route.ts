export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";
import { getShopifyProducts, getShopifyTokens } from "@/lib/shopify";

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

function normalizeToken(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isLikelyInternalId(value: string): boolean {
  if (!value) return true;
  if (/^\d{8,}$/.test(value)) return true;
  if (/^gid:\/\//.test(value)) return true;
  if (/^image-dropdown-\d+$/i.test(value)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value)) return true;
  return false;
}

function isLikelyMetaPropertyName(name: string): boolean {
  if (!name) return true;
  return (
    name.startsWith("_") ||
    name.startsWith("gpo_") ||
    name.includes("gpo_parent") ||
    name.includes("gpo_field_name") ||
    name.includes("_bundle")
  );
}

function isHumanReadableOptionValue(value: string): boolean {
  if (!value) return false;
  if (isLikelyInternalId(value)) return false;
  if (!/[a-z]/i.test(value)) return false;
  return value.length <= 120;
}

function prettyLabel(raw: string): string {
  return raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function parseMappingKeyLabel(key: string): { productTitle: string; variantTitle: string } {
  if (key.startsWith("prop:")) {
    const parts = key.split(":");
    const optionName = prettyLabel(parts[1] || "option");
    const optionValue = prettyLabel(parts.slice(2).join(":") || "value");
    return {
      productTitle: "Shopify Dropdown",
      variantTitle: `${optionName} = ${optionValue}`,
    };
  }
  if (key.startsWith("propvalue:")) {
    return {
      productTitle: "Shopify Dropdown Value",
      variantTitle: prettyLabel(key.slice("propvalue:".length) || "value"),
    };
  }
  if (key.startsWith("title:")) {
    return {
      productTitle: "Shopify Line Title",
      variantTitle: prettyLabel(key.slice("title:".length) || "line item"),
    };
  }
  return {
    productTitle: "Shopify Mapping Key",
    variantTitle: key,
  };
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

    // Include app-driven line item option/title keys discovered from recent Shopify orders
    const customKeySet = new Set<string>();
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
              const sku = normalizeToken(line?.sku);
              const title = normalizeToken(line?.title);
              if (!sku && title) customKeySet.add(`title:${title}`);

              for (const prop of line?.properties || []) {
                const name = normalizeToken(prop?.name);
                const value = normalizeToken(prop?.value);
                if (!value) continue;

                const explicitPropKey = name ? `prop:${name}:${value}` : "";
                const isExplicitMapped = explicitPropKey ? Boolean(explicitMap[explicitPropKey]) : false;

                if (name && (isExplicitMapped || (!isLikelyMetaPropertyName(name) && isHumanReadableOptionValue(value)))) {
                  customKeySet.add(explicitPropKey);
                }

                const valueOnlyKey = `propvalue:${value}`;
                if (explicitMap[valueOnlyKey] || isHumanReadableOptionValue(value)) {
                  customKeySet.add(valueOnlyKey);
                }
              }
            }
          }
        }
      }
    } catch {
      // Non-fatal: custom keys simply won't be auto-discovered this time.
    }

    // Also include any existing explicit non-SKU keys so they remain editable.
    for (const key of Object.keys(explicitMap)) {
      if (key.startsWith("title:") || key.startsWith("prop:") || key.startsWith("propvalue:")) {
        customKeySet.add(key);
      }
    }

    let syntheticId = -1;
    for (const key of Array.from(customKeySet)) {
      const explicit = explicitMap[key] || null;
      const labels = parseMappingKeyLabel(key);
      rows.push({
        sku: key,
        variantId: syntheticId--,
        productTitle: labels.productTitle,
        variantTitle: labels.variantTitle,
        mappedQboItemId: explicit,
        mappingSource: explicit ? "explicit" : "none",
      });
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

/** PUT /api/shopify/product-qbo-mappings — bulk save multiple SKU→item pairs at once */
export async function PUT(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const entries: { sku: string; qbo_item_id: string | null }[] = Array.isArray(body?.mappings)
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
    for (const { sku, qbo_item_id } of entries) {
      const skuKey = String(sku || "").trim().toLowerCase();
      if (!skuKey) continue;
      const itemId = qbo_item_id ? String(qbo_item_id).trim() : null;
      if (itemId) {
        map[skuKey] = itemId;
      } else {
        delete map[skuKey];
      }
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