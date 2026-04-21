import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";
import { authorizedQboFetch } from "@/lib/qbo";
import { getShopifyTokens } from "@/lib/shopify";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";
const SHOPIFY_API_VERSION = "2024-01";

function isMissingLineItemMappingColumn(error: any) {
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return text.includes("line_item_mapping_json") && text.includes("does not exist");
}

type JsonMap = Record<string, string>;

type ShopifyOrder = {
  id: number;
  name: string;
  order_number: number;
  created_at: string;
  total_price: string;
  note?: string | null;
  email?: string | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
  line_items: Array<{
    title: string;
    sku: string | null;
    quantity: number;
    price: string;
  }>;
  shipping_lines?: Array<{ price?: string | number | null }>;
};

function toMap(input: unknown): JsonMap {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: JsonMap = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v !== "string") continue;
    const key = String(k || "").trim().toLowerCase();
    const val = v.trim();
    if (key && val) out[key] = val;
  }
  return out;
}

function customerName(order: ShopifyOrder) {
  const first = order.customer?.first_name || "";
  const last = order.customer?.last_name || "";
  return [first, last].filter(Boolean).join(" ").trim() || order.customer?.email || order.email || "Shopify Customer";
}

function customerEmail(order: ShopifyOrder) {
  return String(order.customer?.email || order.email || "").trim().toLowerCase();
}

function shippingTotal(order: ShopifyOrder) {
  return Number(
    (order.shipping_lines || [])
      .reduce((sum, line) => sum + (Number(line?.price || 0) || 0), 0)
      .toFixed(2)
  );
}

async function resolvePaymentMethodId(explicitId: string | null, methodName: string | null) {
  if (explicitId) return explicitId;
  const safeName = String(methodName || "Shopify").trim();
  if (!safeName) return null;

  const query = `SELECT * FROM PaymentMethod WHERE Name = '${safeName.replace(/'/g, "''")}' MAXRESULTS 1`;
  const existing = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(query)}&minorversion=65`);
  const existingId = existing?.QueryResponse?.PaymentMethod?.[0]?.Id;
  if (existingId) return existingId;

  try {
    const created = await authorizedQboFetch<any>("/paymentmethod?minorversion=65", {
      method: "POST",
      body: JSON.stringify({ Name: safeName, Type: "NON_CREDIT_CARD" }),
    });
    return created?.PaymentMethod?.Id || null;
  } catch {
    return null;
  }
}

async function findOrCreateCustomerId(params: {
  order: ShopifyOrder;
  customerMap: JsonMap;
  defaultCustomerId: string | null;
  createMissingCustomers: boolean;
}) {
  const { order, customerMap, defaultCustomerId, createMissingCustomers } = params;
  const email = customerEmail(order);
  const name = customerName(order).toLowerCase();

  if (email && customerMap[email]) return customerMap[email];
  if (name && customerMap[name]) return customerMap[name];
  if (defaultCustomerId) return defaultCustomerId;
  if (!createMissingCustomers) return null;

  const displayName = customerName(order);
  const query = `SELECT * FROM Customer WHERE DisplayName = '${displayName.replace(/'/g, "''")}' MAXRESULTS 1`;
  try {
    const found = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(query)}&minorversion=65`);
    const existingId = found?.QueryResponse?.Customer?.[0]?.Id;
    if (existingId) return existingId;
  } catch {
    // Continue to create
  }

  const created = await authorizedQboFetch<any>("/customer?minorversion=65", {
    method: "POST",
    body: JSON.stringify({
      DisplayName: displayName,
      PrimaryEmailAddr: email ? { Address: email } : undefined,
    }),
  });

  return created?.Customer?.Id || null;
}

export async function POST(req: NextRequest) {
  try {
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();
    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const shopifyOrderId = String(body?.shopify_order_id || "").trim();
    if (!shopifyOrderId) {
      return NextResponse.json({ error: "shopify_order_id is required" }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();

    const { data: existingMap } = await supabase
      .from("shopify_qbo_mappings")
      .select("shopify_order_id, qbo_invoice_id, is_cancelled")
      .eq("shopify_order_id", shopifyOrderId)
      .maybeSingle();

    if (existingMap?.qbo_invoice_id) {
      return NextResponse.json({ error: "This order is already linked to a QBO invoice" }, { status: 409 });
    }

    let settingsData: any = null;
    let settingsError: any = null;
    const fullSettings = await supabase
      .from("shopify_settings")
      .select("qbo_default_customer_id, qbo_default_item_id, qbo_shipping_item_id, qbo_payment_method_id, qbo_payment_method_name, qbo_deposit_account_id, customer_mapping_json, line_item_mapping_json, create_missing_customers")
      .eq("id", SETTINGS_ID)
      .single();

    settingsData = fullSettings.data;
    settingsError = fullSettings.error;

    if (settingsError && isMissingLineItemMappingColumn(settingsError)) {
      const fallback = await supabase
        .from("shopify_settings")
        .select("qbo_default_customer_id, qbo_default_item_id, qbo_shipping_item_id, qbo_payment_method_id, qbo_payment_method_name, qbo_deposit_account_id, customer_mapping_json, create_missing_customers")
        .eq("id", SETTINGS_ID)
        .single();
      settingsData = fallback.data ? { ...fallback.data, line_item_mapping_json: {} } : fallback.data;
      settingsError = fallback.error;
    }

    if (settingsError && settingsError.code !== "PGRST116") {
      throw settingsError;
    }

    const tokens = await getShopifyTokens();
    if (!tokens) {
      return NextResponse.json({ error: "Shopify not connected" }, { status: 401 });
    }

    const shopifyRes = await fetch(
      `https://${tokens.shop}/admin/api/${SHOPIFY_API_VERSION}/orders/${shopifyOrderId}.json?fields=id,name,order_number,created_at,total_price,note,email,customer,line_items,shipping_lines`,
      {
        headers: {
          "X-Shopify-Access-Token": tokens.access_token,
          "Content-Type": "application/json",
        },
      }
    );

    if (!shopifyRes.ok) {
      const text = await shopifyRes.text();
      return NextResponse.json({ error: `Failed to fetch Shopify order: ${text}` }, { status: 500 });
    }

    const order = ((await shopifyRes.json()) as { order: ShopifyOrder })?.order;
    if (!order?.id) {
      return NextResponse.json({ error: "Shopify order not found" }, { status: 404 });
    }

    const customerMap = toMap(settingsData?.customer_mapping_json);
    const lineMap = toMap(settingsData?.line_item_mapping_json);

    const customerId = await findOrCreateCustomerId({
      order,
      customerMap,
      defaultCustomerId: settingsData?.qbo_default_customer_id || null,
      createMissingCustomers: Boolean(settingsData?.create_missing_customers),
    });

    if (!customerId) {
      return NextResponse.json(
        { error: "No customer mapping found and no default customer is configured" },
        { status: 400 }
      );
    }

    const { data: mappedItems, error: mappedItemsError } = await supabase
      .from("price_list_items")
      .select("item_no, qbo_item_id")
      .not("qbo_item_id", "is", null);
    if (mappedItemsError) throw mappedItemsError;

    const skuMap: JsonMap = {};
    (mappedItems || []).forEach((item: any) => {
      const sku = String(item.item_no || "").trim().toLowerCase();
      const qboItemId = String(item.qbo_item_id || "").trim();
      if (sku && qboItemId) skuMap[sku] = qboItemId;
    });

    const defaultItemId = settingsData?.qbo_default_item_id || null;
    const invoiceLines = (order.line_items || []).map((line) => {
      const sku = String(line.sku || "").trim().toLowerCase();
      const itemId = (sku && (lineMap[sku] || skuMap[sku])) || defaultItemId;
      if (!itemId) {
        throw new Error(`No QBO item mapping for SKU \"${line.sku || line.title}\"`);
      }

      const qty = Number(line.quantity || 0);
      const unitPrice = Number(line.price || 0);
      return {
        DetailType: "SalesItemLineDetail",
        Amount: Number((qty * unitPrice).toFixed(2)),
        Description: line.title || line.sku || "Shopify line item",
        SalesItemLineDetail: {
          ItemRef: { value: itemId },
          Qty: qty,
          UnitPrice: unitPrice,
        },
      };
    });

    const shippingItemId = settingsData?.qbo_shipping_item_id || null;
    const shippingAmt = shippingTotal(order);
    if (shippingAmt > 0 && shippingItemId) {
      invoiceLines.push({
        DetailType: "SalesItemLineDetail",
        Amount: shippingAmt,
        Description: "Shipping",
        SalesItemLineDetail: {
          ItemRef: { value: shippingItemId },
          Qty: 1,
          UnitPrice: shippingAmt,
        },
      });
    }

    const invoicePayload = {
      CustomerRef: { value: customerId },
      Line: invoiceLines,
      TxnDate: String(order.created_at || "").slice(0, 10),
      PONumber: String(order.name || `#${order.order_number}`).replace(/^#/, ""),
      PrivateNote: `Manually created from Shopify Reconcile (${order.id})`,
      CustomerMemo: {
        value: [`Shopify Order: ${order.name}`, `Shopify Order ID: ${order.id}`, order.note ? `Note: ${order.note}` : null]
          .filter(Boolean)
          .join(" | "),
      },
    };

    const invoiceRes = await authorizedQboFetch<any>("/invoice?minorversion=65", {
      method: "POST",
      body: JSON.stringify(invoicePayload),
    });
    const invoice = invoiceRes?.Invoice;
    if (!invoice?.Id) {
      throw new Error("QuickBooks did not return created invoice id");
    }

    const paymentMethodId = await resolvePaymentMethodId(
      settingsData?.qbo_payment_method_id || null,
      settingsData?.qbo_payment_method_name || "Shopify"
    );

    let paymentId: string | null = null;
    const totalAmt = Number(order.total_price || 0);
    if (totalAmt > 0) {
      const paymentPayload: any = {
        CustomerRef: { value: customerId },
        TotalAmt: Number(totalAmt.toFixed(2)),
        TxnDate: String(order.created_at || "").slice(0, 10),
        PrivateNote: `Paid via Shopify (${order.name})`,
        Line: [
          {
            Amount: Number(totalAmt.toFixed(2)),
            LinkedTxn: [{ TxnId: invoice.Id, TxnType: "Invoice" }],
          },
        ],
      };

      if (paymentMethodId) {
        paymentPayload.PaymentMethodRef = { value: paymentMethodId };
      }
      if (settingsData?.qbo_deposit_account_id) {
        paymentPayload.DepositToAccountRef = { value: settingsData.qbo_deposit_account_id };
      }

      const paymentRes = await authorizedQboFetch<any>("/payment?minorversion=65", {
        method: "POST",
        body: JSON.stringify(paymentPayload),
      });
      paymentId = paymentRes?.Payment?.Id || null;
    }

    await supabase
      .from("shopify_qbo_mappings")
      .upsert(
        {
          shopify_order_id: String(order.id),
          shopify_order_number: String(order.name || order.order_number).replace(/^#/, ""),
          qbo_invoice_id: invoice.Id,
          qbo_doc_number: invoice.DocNumber || null,
          qbo_customer_name: customerName(order),
          note: "Manually created as new QBO invoice",
          is_cancelled: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "shopify_order_id" }
      );

    return NextResponse.json({
      ok: true,
      invoiceId: invoice.Id,
      invoiceNumber: invoice.DocNumber || null,
      paymentId,
      shopifyOrderId: String(order.id),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create QBO invoice from Shopify order" },
      { status: 500 }
    );
  }
}