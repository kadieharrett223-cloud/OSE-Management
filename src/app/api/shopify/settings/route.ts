export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

function isMissingLineItemMappingColumn(error: any) {
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return text.includes("line_item_mapping_json") && text.includes("does not exist");
}

export async function GET() {
  try {
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();

    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const supabase = getServerSupabaseClient();
    let data: any = null;
    let error: any = null;
    const fullResult = await supabase
      .from("shopify_settings")
      .select("id, allowed_collection_ids, order_sync_enabled, order_sync_financial_statuses, qbo_default_customer_id, qbo_default_item_id, qbo_shipping_item_id, qbo_payment_method_id, qbo_payment_method_name, qbo_deposit_account_id, customer_mapping_json, line_item_mapping_json, auto_send_to_email, send_summary_email, create_missing_customers, last_order_sync_at")
      .eq("id", SETTINGS_ID)
      .single();

    data = fullResult.data;
    error = fullResult.error;

    if (error && isMissingLineItemMappingColumn(error)) {
      const fallback = await supabase
        .from("shopify_settings")
        .select("id, allowed_collection_ids, order_sync_enabled, order_sync_financial_statuses, qbo_default_customer_id, qbo_default_item_id, qbo_shipping_item_id, qbo_payment_method_id, qbo_payment_method_name, qbo_deposit_account_id, customer_mapping_json, auto_send_to_email, send_summary_email, create_missing_customers, last_order_sync_at")
        .eq("id", SETTINGS_ID)
        .single();
      data = fallback.data ? { ...fallback.data, line_item_mapping_json: {} } : fallback.data;
      error = fallback.error;
    }

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      settings:
        data ||
        {
          id: SETTINGS_ID,
          allowed_collection_ids: [],
          order_sync_enabled: false,
          order_sync_financial_statuses: ["paid"],
          qbo_default_customer_id: null,
          qbo_default_item_id: null,
          qbo_shipping_item_id: null,
          qbo_payment_method_id: null,
          qbo_payment_method_name: "Shopify",
          qbo_deposit_account_id: null,
          customer_mapping_json: {},
          line_item_mapping_json: {},
          auto_send_to_email: null,
          send_summary_email: false,
          create_missing_customers: false,
          last_order_sync_at: null,
        },
    });
  } catch (error: any) {
    console.error("Get Shopify settings error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch settings" }, { status: 500 });
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
    const allowedCollectionIds: string[] = Array.isArray(body?.allowed_collection_ids)
      ? body.allowed_collection_ids
      : [];

    const orderSyncFinancialStatuses = Array.isArray(body?.order_sync_financial_statuses)
      ? body.order_sync_financial_statuses.map((v: any) => String(v).trim().toLowerCase()).filter(Boolean)
      : ["paid"];

    const normalizeMap = (value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return {};
      const out: Record<string, string> = {};
      for (const [key, rawVal] of Object.entries(value as Record<string, unknown>)) {
        if (typeof rawVal !== "string") continue;
        const cleanedKey = String(key || "").trim().toLowerCase();
        const cleanedVal = rawVal.trim();
        if (!cleanedKey || !cleanedVal) continue;
        out[cleanedKey] = cleanedVal;
      }
      return out;
    };

    const supabase = getServerSupabaseClient();
    const payloadWithLineItem = {
      id: SETTINGS_ID,
      allowed_collection_ids: allowedCollectionIds,
      order_sync_enabled: Boolean(body?.order_sync_enabled),
      order_sync_financial_statuses: orderSyncFinancialStatuses.length > 0 ? orderSyncFinancialStatuses : ["paid"],
      qbo_default_customer_id: body?.qbo_default_customer_id ? String(body.qbo_default_customer_id).trim() : null,
      qbo_default_item_id: body?.qbo_default_item_id ? String(body.qbo_default_item_id).trim() : null,
      qbo_shipping_item_id: body?.qbo_shipping_item_id ? String(body.qbo_shipping_item_id).trim() : null,
      qbo_payment_method_id: body?.qbo_payment_method_id ? String(body.qbo_payment_method_id).trim() : null,
      qbo_payment_method_name: body?.qbo_payment_method_name
        ? String(body.qbo_payment_method_name).trim()
        : "Shopify",
      qbo_deposit_account_id: body?.qbo_deposit_account_id ? String(body.qbo_deposit_account_id).trim() : null,
      customer_mapping_json: normalizeMap(body?.customer_mapping_json),
      line_item_mapping_json: normalizeMap(body?.line_item_mapping_json),
      auto_send_to_email: body?.auto_send_to_email ? String(body.auto_send_to_email).trim() : null,
      send_summary_email: Boolean(body?.send_summary_email),
      create_missing_customers: Boolean(body?.create_missing_customers),
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase
      .from("shopify_settings")
      .upsert(payloadWithLineItem);

    if (error && isMissingLineItemMappingColumn(error)) {
      const { line_item_mapping_json, ...payloadWithoutLineItem } = payloadWithLineItem;
      const fallback = await supabase
        .from("shopify_settings")
        .upsert(payloadWithoutLineItem);
      error = fallback.error;
    }

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Update Shopify settings error:", error);
    return NextResponse.json({ error: error.message || "Failed to update settings" }, { status: 500 });
  }
}
