import nodemailer from "nodemailer";
import { getServerSupabaseClient } from "@/lib/supabase";
import { authorizedQboFetch } from "@/lib/qbo";
import { getShopifyTokens } from "@/lib/shopify";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";
const SHOPIFY_API_VERSION = "2024-01";

type JsonMap = Record<string, string>;

type ShopifySyncSettings = {
  order_sync_enabled: boolean;
  order_sync_financial_statuses: string[];
  qbo_default_customer_id: string | null;
  qbo_default_item_id: string | null;
  qbo_shipping_item_id: string | null;
  qbo_payment_method_id: string | null;
  qbo_payment_method_name: string | null;
  qbo_deposit_account_id: string | null;
  customer_mapping_json: JsonMap | null;
  line_item_mapping_json: JsonMap | null;
  auto_send_to_email: string | null;
  send_summary_email: boolean;
  create_missing_customers: boolean;
  last_order_sync_at: string | null;
};

type ShopifyOrderLine = {
  title: string;
  sku: string | null;
  quantity: number;
  price: string;
  properties?: Array<{
    name?: string | null;
    value?: string | null;
  }>;
};

type ShopifyOrder = {
  id: number;
  name: string;
  order_number: number;
  created_at: string;
  financial_status: string;
  total_price: string;
  note: string | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
  email?: string | null;
  line_items: ShopifyOrderLine[];
  shipping_lines?: Array<{ price?: string | number | null }>;
};

type SyncOrderResult = {
  shopifyOrderId: string;
  orderName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  paymentId?: string;
  status: "synced" | "skipped" | "failed";
  reason?: string;
};

export type ShopifyOrderSyncResult = {
  synced: number;
  skipped: number;
  failed: number;
  since: string;
  statusFilter: string[];
  results: SyncOrderResult[];
  errors: string[];
};

function toMap(input: unknown): JsonMap {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const normalized: JsonMap = {};
  for (const [rawKey, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    const key = String(rawKey || "").trim().toLowerCase();
    const val = value.trim();
    if (key && val) normalized[key] = val;
  }

  return normalized;
}

function normalizeStatus(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isMissingLineItemMappingColumn(error: any) {
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return text.includes("line_item_mapping_json") && text.includes("does not exist");
}

function getNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const links = linkHeader.split(",").map((part) => part.trim());
  const next = links.find((link) => /rel="next"/.test(link));
  if (!next) return null;
  const match = next.match(/<([^>]+)>/);
  return match?.[1] || null;
}

function customerName(order: ShopifyOrder) {
  const first = order.customer?.first_name || "";
  const last = order.customer?.last_name || "";
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || order.customer?.email || order.email || "Shopify Customer";
}

function customerEmail(order: ShopifyOrder) {
  return String(order.customer?.email || order.email || "").trim().toLowerCase();
}

function orderShippingTotal(order: ShopifyOrder): number {
  return (order.shipping_lines || []).reduce((sum, line) => {
    const v = Number(line?.price || 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
}

function normalizeToken(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function mappingKeysForLine(line: ShopifyOrderLine): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const add = (key: string) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };

  const sku = normalizeToken(line.sku);
  if (sku) add(sku);

  const title = normalizeToken(line.title);
  if (title) add(`title:${title}`);

  for (const prop of line.properties || []) {
    const name = normalizeToken(prop?.name);
    const value = normalizeToken(prop?.value);
    if (!value) continue;
    if (name) add(`prop:${name}:${value}`);
    add(`propvalue:${value}`);
  }

  return keys;
}

async function fetchShopifyOrdersSince(since: string): Promise<ShopifyOrder[]> {
  const tokens = await getShopifyTokens();
  if (!tokens) {
    throw new Error("Shopify not connected");
  }

  const params = new URLSearchParams({
    limit: "250",
    status: "any",
    created_at_min: since,
    fields: "id,name,order_number,created_at,financial_status,total_price,note,email,customer,line_items,shipping_lines",
  });

  let nextUrl: string | null = `https://${tokens.shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json?${params.toString()}`;
  const allOrders: ShopifyOrder[] = [];

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        "X-Shopify-Access-Token": tokens.access_token,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { orders: ShopifyOrder[] };
    allOrders.push(...(data.orders || []));
    nextUrl = getNextPageUrl(response.headers.get("Link"));
  }

  return allOrders;
}

async function resolvePaymentMethodId(settings: ShopifySyncSettings): Promise<string | null> {
  if (settings.qbo_payment_method_id) {
    return settings.qbo_payment_method_id;
  }

  const methodName = String(settings.qbo_payment_method_name || "Shopify").trim();
  if (!methodName) return null;

  const query = `SELECT * FROM PaymentMethod WHERE Name = '${methodName.replace(/'/g, "''")}' MAXRESULTS 1`;
  const existing = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(query)}&minorversion=65`);
  const existingMethod = existing?.QueryResponse?.PaymentMethod?.[0];
  if (existingMethod?.Id) {
    return existingMethod.Id;
  }

  try {
    const created = await authorizedQboFetch<any>("/paymentmethod?minorversion=65", {
      method: "POST",
      body: JSON.stringify({
        Name: methodName,
        Type: "NON_CREDIT_CARD",
      }),
    });

    return created?.PaymentMethod?.Id || null;
  } catch {
    return null;
  }
}

async function findOrCreateCustomerId(
  settings: ShopifySyncSettings,
  customerMap: JsonMap,
  order: ShopifyOrder
): Promise<string | null> {
  const email = customerEmail(order);
  const name = customerName(order).toLowerCase();

  if (email && customerMap[email]) return customerMap[email];
  if (name && customerMap[name]) return customerMap[name];
  if (settings.qbo_default_customer_id) return settings.qbo_default_customer_id;

  if (!settings.create_missing_customers) {
    return null;
  }

  const displayName = customerName(order);

  try {
    const query = `SELECT * FROM Customer WHERE DisplayName = '${displayName.replace(/'/g, "''")}' MAXRESULTS 1`;
    const found = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(query)}&minorversion=65`);
    const existing = found?.QueryResponse?.Customer?.[0];
    if (existing?.Id) return existing.Id;
  } catch {
    // Continue to create customer if lookup fails
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

function buildInvoiceLines(order: ShopifyOrder, lineMap: JsonMap, skuToQboItemMap: JsonMap, defaultItemId: string | null) {
  return (order.line_items || []).map((line) => {
    const sku = normalizeToken(line.sku);
    const price = Number(line.price || 0);
    const qty = Number(line.quantity || 0);
    const amount = Number((price * qty).toFixed(2));

    // Resolution priority:
    // 1. Explicit SKU mapping (most specific — user set this directly)
    // 2. Price-list SKU mapping
    // 3. Explicit title/property mapping (fallback for lines with no SKU)
    // 4. Default item
    const explicitSkuItemId = (sku && lineMap[sku]) || null;
    const priceListItemId = (sku && skuToQboItemMap[sku]) || null;
    const propKeys = mappingKeysForLine(line).filter((k) => k !== sku);
    const propItemId = propKeys.map((key) => lineMap[key]).find(Boolean) || null;
    const mappedItemId = explicitSkuItemId || priceListItemId || propItemId || defaultItemId;

    if (!mappedItemId) {
      throw new Error(`No QBO item mapping for line "${line.title || sku || "Shopify line item"}"`);
    }

    return {
      DetailType: "SalesItemLineDetail",
      Amount: amount,
      Description: line.title || sku,
      SalesItemLineDetail: {
        ItemRef: { value: mappedItemId },
        Qty: qty,
        UnitPrice: price,
      },
    };
  });
}

async function sendSummaryEmail(recipient: string, result: ShopifyOrderSyncResult) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const failedRows = result.results
    .filter((row) => row.status === "failed")
    .slice(0, 30)
    .map((row) => `- ${row.orderName}: ${row.reason || "Unknown error"}`)
    .join("\n");

  const text = [
    "Shopify to QuickBooks order sync completed.",
    "",
    `Since: ${result.since}`,
    `Statuses: ${result.statusFilter.join(", ")}`,
    `Synced: ${result.synced}`,
    `Skipped: ${result.skipped}`,
    `Failed: ${result.failed}`,
    "",
    failedRows ? `Failures:\n${failedRows}` : "No failures.",
  ].join("\n");

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipient,
    subject: `Shopify → QuickBooks Sync: ${result.synced} synced, ${result.failed} failed`,
    text,
  });
}

export async function syncShopifyOrdersToQbo(params?: {
  since?: string;
  force?: boolean;
  triggerSource?: string;
}): Promise<ShopifyOrderSyncResult> {
  const supabase = getServerSupabaseClient();

  let settingsData: any = null;
  let settingsError: any = null;
  const fullSettings = await supabase
    .from("shopify_settings")
    .select("order_sync_enabled, order_sync_financial_statuses, qbo_default_customer_id, qbo_default_item_id, qbo_shipping_item_id, qbo_payment_method_id, qbo_payment_method_name, qbo_deposit_account_id, customer_mapping_json, line_item_mapping_json, auto_send_to_email, send_summary_email, create_missing_customers, last_order_sync_at")
    .eq("id", SETTINGS_ID)
    .single();

  settingsData = fullSettings.data;
  settingsError = fullSettings.error;

  if (settingsError && isMissingLineItemMappingColumn(settingsError)) {
    const fallback = await supabase
      .from("shopify_settings")
      .select("order_sync_enabled, order_sync_financial_statuses, qbo_default_customer_id, qbo_default_item_id, qbo_shipping_item_id, qbo_payment_method_id, qbo_payment_method_name, qbo_deposit_account_id, customer_mapping_json, auto_send_to_email, send_summary_email, create_missing_customers, last_order_sync_at")
      .eq("id", SETTINGS_ID)
      .single();
    settingsData = fallback.data ? { ...fallback.data, line_item_mapping_json: {} } : fallback.data;
    settingsError = fallback.error;
  }

  if (settingsError && settingsError.code !== "PGRST116") {
    throw new Error(settingsError.message || "Failed to load Shopify sync settings");
  }

  const settings: ShopifySyncSettings = {
    order_sync_enabled: settingsData?.order_sync_enabled ?? false,
    order_sync_financial_statuses: settingsData?.order_sync_financial_statuses || ["paid"],
    qbo_default_customer_id: settingsData?.qbo_default_customer_id || null,
    qbo_default_item_id: settingsData?.qbo_default_item_id || null,
    qbo_shipping_item_id: settingsData?.qbo_shipping_item_id || null,
    qbo_payment_method_id: settingsData?.qbo_payment_method_id || null,
    qbo_payment_method_name: settingsData?.qbo_payment_method_name || "Shopify",
    qbo_deposit_account_id: settingsData?.qbo_deposit_account_id || null,
    customer_mapping_json: toMap(settingsData?.customer_mapping_json),
    line_item_mapping_json: toMap(settingsData?.line_item_mapping_json),
    auto_send_to_email: settingsData?.auto_send_to_email || null,
    send_summary_email: settingsData?.send_summary_email ?? false,
    create_missing_customers: settingsData?.create_missing_customers ?? false,
    last_order_sync_at: settingsData?.last_order_sync_at || null,
  };

  if (!params?.force && !settings.order_sync_enabled) {
    throw new Error("Order sync is disabled in Shopify settings");
  }

  const manualBackfill = Boolean(params?.force && !params?.since);
  const autoSince = settings.last_order_sync_at || new Date().toISOString();
  const since = params?.since || (manualBackfill ? "1970-01-01T00:00:00.000Z" : autoSince);
  const statusFilter = (settings.order_sync_financial_statuses || ["paid"]).map((s) => normalizeStatus(s));

  const { data: logRow } = await supabase
    .from("shopify_order_sync_logs")
    .insert({
      started_at: new Date().toISOString(),
      status: "running",
      since_timestamp: since,
      trigger_source: params?.triggerSource || "manual",
      recipient_email: settings.auto_send_to_email,
    })
    .select("id")
    .single();

  const result: ShopifyOrderSyncResult = {
    synced: 0,
    skipped: 0,
    failed: 0,
    since,
    statusFilter,
    results: [],
    errors: [],
  };

  try {
    const orders = await fetchShopifyOrdersSince(since);
    const filteredOrders = orders.filter((order) => statusFilter.includes(normalizeStatus(order.financial_status)));

    const { data: priceItems, error: priceError } = await supabase
      .from("price_list_items")
      .select("item_no, qbo_item_id")
      .not("qbo_item_id", "is", null);

    if (priceError) {
      throw new Error(priceError.message || "Failed loading item mappings");
    }

    const skuToQboItemMap: JsonMap = {};
    (priceItems || []).forEach((item: any) => {
      const sku = String(item.item_no || "").trim().toLowerCase();
      const qboItemId = String(item.qbo_item_id || "").trim();
      if (sku && qboItemId) skuToQboItemMap[sku] = qboItemId;
    });

    const orderIds = filteredOrders.map((o) => String(o.id));
    const { data: existingMappings } = orderIds.length
      ? await supabase
          .from("shopify_qbo_mappings")
          .select("shopify_order_id, qbo_invoice_id, is_cancelled")
          .in("shopify_order_id", orderIds)
      : { data: [] as any[] };

    const existingByOrderId = new Map<string, any>();
    (existingMappings || []).forEach((m: any) => existingByOrderId.set(String(m.shopify_order_id), m));

    const paymentMethodId = await resolvePaymentMethodId(settings);

    for (const order of filteredOrders) {
      const orderId = String(order.id);
      const orderName = order.name || `#${order.order_number}`;

      try {
        const existing = existingByOrderId.get(orderId);
        if (existing?.is_cancelled) {
          result.skipped += 1;
          result.results.push({
            shopifyOrderId: orderId,
            orderName,
            status: "skipped",
            reason: "Order marked cancelled in manual mappings",
          });
          continue;
        }
        if (existing?.qbo_invoice_id) {
          result.skipped += 1;
          result.results.push({
            shopifyOrderId: orderId,
            orderName,
            status: "skipped",
            reason: "Already synced",
          });
          continue;
        }

        const customerId = await findOrCreateCustomerId(settings, settings.customer_mapping_json || {}, order);
        if (!customerId) {
          throw new Error("No customer mapping found and no default customer configured");
        }

        const qboLines = buildInvoiceLines(
          order,
          settings.line_item_mapping_json || {},
          skuToQboItemMap,
          settings.qbo_default_item_id
        );

        const shippingTotal = Number(orderShippingTotal(order).toFixed(2));
        if (shippingTotal > 0 && settings.qbo_shipping_item_id) {
          qboLines.push({
            DetailType: "SalesItemLineDetail",
            Amount: shippingTotal,
            Description: "Shipping",
            SalesItemLineDetail: {
              ItemRef: { value: settings.qbo_shipping_item_id },
              Qty: 1,
              UnitPrice: shippingTotal,
            },
          });
        }

        const invoicePayload: any = {
          CustomerRef: { value: customerId },
          Line: qboLines,
          TxnDate: order.created_at.slice(0, 10),
          PONumber: String(orderName).replace(/^#/, ""),
          PrivateNote: `Shopify Order ${orderName} (${orderId})`,
          CustomerMemo: {
            value: [
              `Shopify Order: ${orderName}`,
              `Shopify Order ID: ${orderId}`,
              order.note ? `Note: ${order.note}` : null,
            ]
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
          throw new Error("QBO did not return a created invoice Id");
        }

        const totalAmt = Number(order.total_price || 0);
        let paymentId: string | undefined;

        if (totalAmt > 0) {
          const paymentPayload: any = {
            CustomerRef: { value: customerId },
            TotalAmt: Number(totalAmt.toFixed(2)),
            TxnDate: order.created_at.slice(0, 10),
            PrivateNote: `Paid via Shopify (${orderName})`,
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

          if (settings.qbo_deposit_account_id) {
            paymentPayload.DepositToAccountRef = { value: settings.qbo_deposit_account_id };
          }

          const paymentRes = await authorizedQboFetch<any>("/payment?minorversion=65", {
            method: "POST",
            body: JSON.stringify(paymentPayload),
          });

          paymentId = paymentRes?.Payment?.Id;
        }

        await supabase
          .from("shopify_qbo_mappings")
          .upsert(
            {
              shopify_order_id: orderId,
              shopify_order_number: String(orderName).replace(/^#/, ""),
              qbo_invoice_id: invoice.Id,
              qbo_doc_number: invoice.DocNumber || null,
              qbo_customer_name: customerName(order),
              note: "Auto-synced Shopify -> QBO",
              is_cancelled: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "shopify_order_id" }
          );

        result.synced += 1;
        result.results.push({
          shopifyOrderId: orderId,
          orderName,
          status: "synced",
          invoiceId: invoice.Id,
          invoiceNumber: invoice.DocNumber,
          paymentId,
        });
      } catch (err: any) {
        result.failed += 1;
        const msg = err?.message || "Unknown sync failure";
        result.errors.push(`${orderName}: ${msg}`);
        result.results.push({
          shopifyOrderId: orderId,
          orderName,
          status: "failed",
          reason: msg,
        });
      }
    }

    const newestOrderCreatedAt = filteredOrders
      .map((o) => Date.parse(o.created_at))
      .filter((v) => Number.isFinite(v))
      .sort((a, b) => b - a)[0];

    await supabase
      .from("shopify_settings")
      .upsert({
        id: SETTINGS_ID,
        last_order_sync_at: newestOrderCreatedAt ? new Date(newestOrderCreatedAt + 1000).toISOString() : since,
        updated_at: new Date().toISOString(),
      });

    if (settings.send_summary_email && settings.auto_send_to_email) {
      await sendSummaryEmail(settings.auto_send_to_email, result);
    }

    if (logRow?.id) {
      await supabase
        .from("shopify_order_sync_logs")
        .update({
          completed_at: new Date().toISOString(),
          status: result.failed > 0 ? "completed_with_errors" : "completed",
          synced_count: result.synced,
          skipped_count: result.skipped,
          failed_count: result.failed,
          details: {
            since: result.since,
            statusFilter: result.statusFilter,
            results: result.results,
          },
          errors: result.errors,
        })
        .eq("id", logRow.id);
    }

    return result;
  } catch (err: any) {
    if (logRow?.id) {
      await supabase
        .from("shopify_order_sync_logs")
        .update({
          completed_at: new Date().toISOString(),
          status: "failed",
          errors: [err?.message || "Order sync failed unexpectedly"],
        })
        .eq("id", logRow.id);
    }
    throw err;
  }
}