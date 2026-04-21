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
    phone?: string | null;
  } | null;
  phone?: string | null;
  billing_address?: {
    name?: string | null;
    company?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    province?: string | null;
    province_code?: string | null;
    zip?: string | null;
    country?: string | null;
    country_code?: string | null;
    phone?: string | null;
  } | null;
  shipping_address?: {
    name?: string | null;
    company?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    province?: string | null;
    province_code?: string | null;
    zip?: string | null;
    country?: string | null;
    country_code?: string | null;
    phone?: string | null;
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

function customerPhone(order: ShopifyOrder) {
  return String(order.phone || order.customer?.phone || order.shipping_address?.phone || order.billing_address?.phone || "").trim();
}

function buildQboAddress(
  addr: ShopifyOrder["billing_address"] | ShopifyOrder["shipping_address"] | null | undefined,
  options?: { includeContact?: boolean; email?: string | null; phone?: string | null }
) {
  if (!addr) return undefined;

  const lines = [
    [addr.name, addr.company].filter(Boolean).join(" - "),
    addr.address1 || "",
    addr.address2 || "",
  ].filter(Boolean) as string[];

  if (options?.includeContact) {
    if (options.phone) {
      lines.push(`Phone: ${options.phone}`);
    }
    lines.push(options.email ? `Email: ${options.email}` : "Email: *no customer email*");
  }

  const out: Record<string, string> = {
    City: String(addr.city || "").trim(),
    CountrySubDivisionCode: String(addr.province_code || addr.province || "").trim(),
    PostalCode: String(addr.zip || "").trim(),
    Country: String(addr.country || addr.country_code || "").trim(),
  };

  lines.slice(0, 5).forEach((line, idx) => {
    out[`Line${idx + 1}`] = line;
  });

  const hasValue = Object.values(out).some((v) => String(v || "").trim().length > 0);
  return hasValue ? out : undefined;
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

function titleMappingKey(value: string | null | undefined): string | null {
  const title = normalizeToken(value);
  return title ? `title:${title}` : null;
}

function isDeliveredToWashington(order: ShopifyOrder) {
  const addr = order.shipping_address || order.billing_address;
  const state = normalizeToken(addr?.province_code || addr?.province);
  return state === "wa" || state === "washington";
}

async function resolveTransactionCustomFieldDefIds(): Promise<{
  salesRep: string | null;
  email: string | null;
  phone: string | null;
}> {
  const query = "SELECT * FROM CustomFieldDefinition MAXRESULTS 100";
  const res = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(query)}&minorversion=65`).catch(() => null);
  const defs = Array.isArray(res?.QueryResponse?.CustomFieldDefinition) ? res.QueryResponse.CustomFieldDefinition : [];
  const findId = (...names: string[]) => {
    const found = defs.find((d: any) => names.includes(String(d?.Name || "").toLowerCase().trim()));
    return found?.Id ? String(found.Id) : null;
  };

  return {
    salesRep: findId("sales rep", "salesrep", "rep"),
    email: findId("email"),
    phone: findId("phone"),
  };
}

async function resolveShopifyPaymentMethodId(settings: ShopifySyncSettings): Promise<string | null> {
  if (settings.qbo_payment_method_id) return settings.qbo_payment_method_id;
  const name = (settings.qbo_payment_method_name || "Shopify").toLowerCase().trim();
  const query = "SELECT Id, Name FROM PaymentMethod MAXRESULTS 200";
  const res = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(query)}&minorversion=65`);
  const methods = Array.isArray(res?.QueryResponse?.PaymentMethod) ? res.QueryResponse.PaymentMethod : [];
  const match = methods.find((m: any) => String(m?.Name || "").toLowerCase().trim() === name);
  return match?.Id ? String(match.Id) : null;
}

async function resolveOutOfStateTaxCodeId(): Promise<string | null> {
  const query = "SELECT Id, Name FROM TaxCode MAXRESULTS 1000";
  const res = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(query)}&minorversion=65`);
  const taxCodes = Array.isArray(res?.QueryResponse?.TaxCode) ? res.QueryResponse.TaxCode : [];
  const outOfState = taxCodes.find((code: any) => normalizeToken(code?.Name) === "out of state");
  return outOfState?.Id ? String(outOfState.Id) : null;
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
    fields: "id,name,order_number,created_at,financial_status,total_price,note,email,phone,customer,billing_address,shipping_address,line_items,shipping_lines",
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

function buildInvoiceLines(order: ShopifyOrder, lineMap: JsonMap, skuToQboItemMap: JsonMap) {
  return (order.line_items || []).map((line) => {
    const sku = normalizeToken(line.sku);
    const price = Number(line.price || 0);
    const qty = Number(line.quantity || 0);
    const amount = Number((price * qty).toFixed(2));

    // Resolution priority:
    // 1. Explicit SKU mapping (most specific — user set this directly)
    // 2. Legacy explicit SKU mapping
    // 3. Price-list SKU mapping
    // 4. (No fallback) — unmapped lines must be explicitly mapped
    const explicitTitleItemId = (titleMappingKey(line.title) && lineMap[titleMappingKey(line.title)!]) || null;
    const explicitSkuItemId = (sku && lineMap[sku]) || null;
    const priceListItemId = (sku && skuToQboItemMap[sku]) || null;
    const mappedItemId = explicitTitleItemId || explicitSkuItemId || priceListItemId;

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

function isDuplicateDocNumberError(error: any) {
  const text = String(error?.message || "").toLowerCase();
  return text.includes("duplicate") && text.includes("doc") && text.includes("number");
}

async function getNextSequentialInvoiceDocNumber(): Promise<number> {
  const query = "SELECT DocNumber FROM Invoice WHERE DocNumber != '' ORDER BY MetaData.LastUpdatedTime DESC MAXRESULTS 500";
  const res = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(query)}&minorversion=65`);
  const invoices = Array.isArray(res?.QueryResponse?.Invoice) ? res.QueryResponse.Invoice : [];

  let maxNumericDoc = 0;
  for (const invoice of invoices) {
    const raw = String(invoice?.DocNumber || "").trim();
    if (!/^\d+$/.test(raw)) continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n > maxNumericDoc) maxNumericDoc = n;
  }

  return maxNumericDoc + 1;
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
    const syncDate = new Date().toISOString().slice(0, 10);
    let nextDocNumber = await getNextSequentialInvoiceDocNumber();
    const requiresOutOfStateTaxCode = filteredOrders.some((order) => !isDeliveredToWashington(order));
    const outOfStateTaxCodeId = requiresOutOfStateTaxCode ? await resolveOutOfStateTaxCodeId() : null;
    const customFieldDefIds = await resolveTransactionCustomFieldDefIds();
    if (requiresOutOfStateTaxCode && !outOfStateTaxCodeId) {
      throw new Error("QuickBooks tax code 'Out of State' was not found. Create it in QBO before syncing non-WA invoices.");
    }

    for (const order of filteredOrders) {
      const orderId = String(order.id);
      const orderName = order.name || `#${order.order_number}`;

      try {
        const existing = existingByOrderId.get(orderId);
        // Only skip if cancelled AND already linked to an invoice — a cancelled-only flag
        // without an invoice means the user accidentally hit Cancel; let the sync proceed.
        if (existing?.is_cancelled && existing?.qbo_invoice_id) {
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
          skuToQboItemMap
        );

        const missingLineTitles = (order.line_items || [])
          .filter((line) => {
            const sku = normalizeToken(line.sku);
            const titleKey = titleMappingKey(line.title);
            const explicitTitleItemId = (titleKey && (settings.line_item_mapping_json || {})[titleKey]) || null;
            const explicitSkuItemId = (sku && (settings.line_item_mapping_json || {})[sku]) || null;
            const priceListItemId = (sku && skuToQboItemMap[sku]) || null;
            const itemId = explicitTitleItemId || explicitSkuItemId || priceListItemId;
            return !itemId;
          })
          .map((line) => line.title || line.sku || "Shopify line item");

        if (missingLineTitles.length > 0) {
          throw new Error(
            `Invoice not created — unmapped line item(s): ${Array.from(new Set(missingLineTitles)).join(", ")}. Go to Product Mapping and map them first.`
          );
        }

        const shippingTotal = Number(orderShippingTotal(order).toFixed(2));
        if (shippingTotal > 0 && !settings.qbo_shipping_item_id) {
          throw new Error("Invoice not created — this Shopify order has a shipping charge, but no QBO shipping item is configured in Settings.");
        }
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

        const billAddr = buildQboAddress(order.billing_address || null, { includeContact: false });
        const shippingAddrSource = order.shipping_address || order.billing_address || null;
        const shipAddr = buildQboAddress(shippingAddrSource, { includeContact: false });

        const invoicePayload: any = {
          CustomerRef: { value: customerId },
          Line: qboLines,
          TxnDate: syncDate,
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

        if (customerEmail(order)) {
          invoicePayload.BillEmail = { Address: customerEmail(order) };
        }
        if (billAddr) invoicePayload.BillAddr = billAddr;
        if (shipAddr) invoicePayload.ShipAddr = shipAddr;
        if (!isDeliveredToWashington(order) && outOfStateTaxCodeId) {
          invoicePayload.TxnTaxDetail = {
            TxnTaxCodeRef: { value: outOfStateTaxCodeId },
          };
        }
        const customFields = [
          customFieldDefIds.salesRep
            ? { DefinitionId: customFieldDefIds.salesRep, Name: "Sales Rep", Type: "StringType", StringValue: "KLH" }
            : null,
          customFieldDefIds.email && customerEmail(order)
            ? { DefinitionId: customFieldDefIds.email, Name: "email", Type: "StringType", StringValue: customerEmail(order) }
            : null,
          customFieldDefIds.phone && customerPhone(order)
            ? { DefinitionId: customFieldDefIds.phone, Name: "Phone", Type: "StringType", StringValue: customerPhone(order) }
            : null,
        ].filter(Boolean);
        if (customFields.length > 0) {
          invoicePayload.CustomField = customFields;
        }

        let invoice: any = null;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const invoiceRes = await authorizedQboFetch<any>("/invoice?minorversion=65", {
            method: "POST",
            body: JSON.stringify({ ...invoicePayload, DocNumber: String(nextDocNumber) }),
          }).catch((err) => {
            if (isDuplicateDocNumberError(err)) {
              nextDocNumber += 1;
              return null;
            }
            throw err;
          });

          invoice = invoiceRes?.Invoice;
          if (invoice?.Id) {
            nextDocNumber += 1;
            break;
          }
        }

        if (!invoice?.Id) {
          throw new Error("QBO did not return a created invoice Id");
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

        // Record full payment via Shopify payment method
        let paymentId: string | undefined;
        const payAmount = Number(order.total_price);
        if (payAmount > 0) {
          const pmId = await resolveShopifyPaymentMethodId(settings);
          const paymentPayload: any = {
            CustomerRef: { value: customerId },
            TotalAmt: payAmount,
            TxnDate: syncDate,
            Line: [{ Amount: payAmount, LinkedTxn: [{ TxnId: invoice.Id, TxnType: "Invoice" }] }],
          };
          if (pmId) paymentPayload.PaymentMethodRef = { value: pmId };
          if (settings.qbo_deposit_account_id) paymentPayload.DepositToAccountRef = { value: settings.qbo_deposit_account_id };
          const paymentRes = await authorizedQboFetch<any>("/payment?minorversion=65", {
            method: "POST",
            body: JSON.stringify(paymentPayload),
          });
          paymentId = paymentRes?.Payment?.Id ? String(paymentRes.Payment.Id) : undefined;
        }

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