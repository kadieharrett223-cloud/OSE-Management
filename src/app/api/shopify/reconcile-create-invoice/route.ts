import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";
import { authorizedQboFetch, authorizedQboFetchRaw } from "@/lib/qbo";
import { getShopifyTokens } from "@/lib/shopify";
import nodemailer from "nodemailer";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";
const SHOPIFY_API_VERSION = "2024-01";
const FORCED_INVOICE_SEND_TO_EMAIL = "kadie@olympic-equipment.com";
const SALES_REP_VALUE = "KLH";

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
  total_tax?: string;
  note?: string | null;
  email?: string | null;
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
  line_items: Array<{
    title: string;
    sku: string | null;
    quantity: number;
    price: string;
    properties?: Array<{
      name?: string | null;
      value?: string | null;
    }>;
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
  const first = capitalizePersonName(order.customer?.first_name || "");
  const last = capitalizePersonName(order.customer?.last_name || "");
  return [first, last].filter(Boolean).join(" ").trim() || order.customer?.email || order.email || "Shopify Customer";
}

function capitalizePersonName(value: string): string {
  const input = String(value || "").trim();
  if (!input) return "";
  const lower = input.toLowerCase();
  return lower.replace(/(^|[\s\-'])([a-z])/g, (_, sep: string, char: string) => `${sep}${char.toUpperCase()}`);
}

function customerEmail(order: ShopifyOrder) {
  return String(order.customer?.email || order.email || "").trim().toLowerCase();
}

function formatPhoneNumber(value: string): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const local = digits.slice(1);
    return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return String(value || "").trim();
}

function shippingTotal(order: ShopifyOrder) {
  return Number(
    (order.shipping_lines || [])
      .reduce((sum, line) => sum + (Number(line?.price || 0) || 0), 0)
      .toFixed(2)
  );
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

function initialsFromName(value: string): string {
  return String(value || "")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

async function resolveSalesRepRefByName(repName: string): Promise<{ value: string; name: string }> {
  const target = normalizeToken(repName);

  const salesRepQuery = "SELECT * FROM SalesRep MAXRESULTS 1000";
  const salesRepRes = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(salesRepQuery)}&minorversion=65`).catch(() => null);
  const salesReps = Array.isArray(salesRepRes?.QueryResponse?.SalesRep) ? salesRepRes.QueryResponse.SalesRep : [];

  for (const salesRep of salesReps) {
    const refName = String(salesRep?.SalesRepEntityRef?.name || salesRep?.Name || "").trim();
    const refValue = String(salesRep?.SalesRepEntityRef?.value || salesRep?.Id || "").trim();
    if (!refName || !refValue) continue;
    if (normalizeToken(refName) === target) {
      return { value: refValue, name: repName };
    }
  }

  const employeeQuery = "SELECT Id, DisplayName, GivenName, MiddleName, FamilyName FROM Employee MAXRESULTS 1000";
  const employeeRes = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(employeeQuery)}&minorversion=65`).catch(() => null);
  const employees = Array.isArray(employeeRes?.QueryResponse?.Employee) ? employeeRes.QueryResponse.Employee : [];

  for (const emp of employees) {
    const displayName = String(emp?.DisplayName || "").trim();
    const fullName = [emp?.GivenName, emp?.MiddleName, emp?.FamilyName].filter(Boolean).join(" ").trim();
    const candidate = displayName || fullName;
    const empId = String(emp?.Id || "").trim();
    if (!candidate || !empId) continue;
    if (normalizeToken(candidate) === target) {
      return { value: empId, name: repName };
    }
  }

  throw new Error(`QuickBooks Sales Rep '${repName}' not found. Add a Sales Rep/Employee named exactly '${repName}' in QuickBooks.`);
}

async function resolveShopifyPaymentMethodId(storedId: string | null, storedName: string | null): Promise<string | null> {
  if (storedId) return storedId;
  const name = (storedName || "Shopify").toLowerCase().trim();
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

async function resolveMiscAdjustmentItemId(defaultItemId: string | null): Promise<string | null> {
  const query = "SELECT Id, Name FROM Item WHERE Active = true MAXRESULTS 1000";
  const res = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(query)}&minorversion=65`).catch(() => null);
  const items = Array.isArray(res?.QueryResponse?.Item) ? res.QueryResponse.Item : [];
  const targetNames = ["misc", "miscellaneous", "misc charge", "tax adjustment", "sales tax adjustment", "adjustment"];
  for (const targetName of targetNames) {
    const found = items.find((i: any) => normalizeToken(i?.Name) === targetName);
    if (found?.Id) return String(found.Id);
  }
  return defaultItemId;
}

function getTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpSecure = process.env.SMTP_SECURE === "true";

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error("SMTP configuration missing (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)");
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass },
  });
}

function customerPhone(order: ShopifyOrder) {
  return formatPhoneNumber(
    String(order.phone || order.customer?.phone || order.shipping_address?.phone || order.billing_address?.phone || "").trim()
  );
}

function buildQboAddress(
  addr: ShopifyOrder["billing_address"] | ShopifyOrder["shipping_address"] | null | undefined,
  options?: { includeContact?: boolean; email?: string | null; phone?: string | null }
) {
  if (!addr) return undefined;

  const city = String(addr.city || "").trim();
  const state = String(addr.province_code || addr.province || "").trim();
  const postal = String(addr.zip || "").trim();
  const country = String(addr.country || addr.country_code || "").trim();

  const locationLine = [city, [state, postal].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ")
    .trim();

  const lines = [
    [capitalizePersonName(String(addr.name || "")), addr.company].filter(Boolean).join(" - "),
    addr.address1 || "",
    addr.address2 || "",
  ].filter(Boolean) as string[];

  if (options?.includeContact) {
    if (locationLine) {
      lines.push(locationLine);
    }

    if (country) {
      lines.push(country);
    }

    const contactLine = [
      options.phone ? `Phone: ${options.phone}` : null,
      options.email ? `Email: ${options.email}` : "Email: *no customer email*",
    ]
      .filter(Boolean)
      .join(" | ");

    if (contactLine) {
      if (lines.length < 5) {
        lines.push(contactLine);
      } else {
        lines[4] = [lines[4], contactLine].filter(Boolean).join(" | ");
      }
    }

    const out: Record<string, string> = {};
    lines.slice(0, 5).forEach((line, idx) => {
      out[`Line${idx + 1}`] = line;
    });

    return Object.keys(out).length > 0 ? out : undefined;
  }

  const out: Record<string, string> = {
    City: city,
    CountrySubDivisionCode: state,
    PostalCode: postal,
    Country: country,
  };

  lines.slice(0, 5).forEach((line, idx) => {
    out[`Line${idx + 1}`] = line;
  });

  const hasValue = Object.values(out).some((v) => String(v || "").trim().length > 0);
  return hasValue ? out : undefined;
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
      .select("qbo_default_customer_id, qbo_default_item_id, qbo_shipping_item_id, qbo_payment_method_id, qbo_payment_method_name, qbo_deposit_account_id, customer_mapping_json, line_item_mapping_json, create_missing_customers, auto_send_to_email")
      .eq("id", SETTINGS_ID)
      .single();

    settingsData = fullSettings.data;
    settingsError = fullSettings.error;

    if (settingsError && isMissingLineItemMappingColumn(settingsError)) {
      const fallback = await supabase
        .from("shopify_settings")
        .select("qbo_default_customer_id, qbo_default_item_id, qbo_shipping_item_id, qbo_payment_method_id, qbo_payment_method_name, qbo_deposit_account_id, customer_mapping_json, create_missing_customers, auto_send_to_email")
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
      `https://${tokens.shop}/admin/api/${SHOPIFY_API_VERSION}/orders/${shopifyOrderId}.json?fields=id,name,order_number,created_at,total_price,total_tax,note,email,phone,customer,billing_address,shipping_address,line_items,shipping_lines`,
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
      createMissingCustomers: true,
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

    const missingLineTitles = (order.line_items || [])
      .filter((line) => {
        const sku = normalizeToken(line.sku);
        const titleKey = titleMappingKey(line.title);
        const explicitTitleItemId = (titleKey && lineMap[titleKey]) || null;
        const explicitSkuItemId = (sku && lineMap[sku]) || null;
        const priceListItemId = (sku && skuMap[sku]) || null;
        const itemId = explicitTitleItemId || explicitSkuItemId || priceListItemId;
        return !itemId;
      })
      .map((line) => line.title || line.sku || "Shopify line item");

    if (missingLineTitles.length > 0) {
        throw new Error(
          `Invoice not created — the following line items are not mapped to a QBO item: ${Array.from(new Set(missingLineTitles)).join(", ")}. Go to Product Mapping and map them first.`
        );
    }

    const invoiceLines = (order.line_items || []).map((line) => {
      const sku = normalizeToken(line.sku);

      const titleKey = titleMappingKey(line.title);
      const explicitTitleItemId = (titleKey && lineMap[titleKey]) || null;
      const explicitSkuItemId = (sku && lineMap[sku]) || null;
      const priceListItemId = (sku && skuMap[sku]) || null;
      const itemId = explicitTitleItemId || explicitSkuItemId || priceListItemId;

      if (!itemId) {
        throw new Error(`No QBO item mapping for line "${line.title || line.sku || "Shopify line item"}"`);
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

    const shippingItemId = lineMap["title:shipping"] || null;
    const shippingAmt = shippingTotal(order);
    if (shippingAmt > 0 && !shippingItemId) {
      throw new Error("Invoice not created — this Shopify order has a shipping charge, but 'Shipping' is not mapped in Product Mapping.");
    }
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

    const billAddr = buildQboAddress(order.billing_address || null, { includeContact: false });
    const shippingAddrSource = order.shipping_address || order.billing_address || null;
    const shipAddr = buildQboAddress(shippingAddrSource, {
      includeContact: true,
      email: customerEmail(order),
      phone: customerPhone(order),
    });
    const requiresOutOfStateTaxCode = !isDeliveredToWashington(order);
    const outOfStateTaxCodeId = requiresOutOfStateTaxCode ? await resolveOutOfStateTaxCodeId() : null;
    const customFieldDefIds = await resolveTransactionCustomFieldDefIds();
    const salesRepRef = await resolveSalesRepRefByName(SALES_REP_VALUE);
    if (requiresOutOfStateTaxCode && !outOfStateTaxCodeId) {
      throw new Error("QuickBooks tax code 'Out of State' was not found. Create it in QBO before creating non-WA invoices.");
    }

    const invoicePayload: any = {
      CustomerRef: { value: customerId },
      Line: invoiceLines,
      TxnDate: new Date().toISOString().slice(0, 10),
      PONumber: String(order.name || `#${order.order_number}`).replace(/^#/, ""),
      PrivateNote: `Manually created from Shopify Reconcile (${order.id})`,
      SalesRepRef: salesRepRef,
      CustomerMemo: {
        value: [`Shopify Order: ${order.name}`, `Shopify Order ID: ${order.id}`, order.note ? `Note: ${order.note}` : null]
          .filter(Boolean)
          .join(" | "),
      },
    };

    if (customerEmail(order)) {
      invoicePayload.BillEmail = { Address: customerEmail(order) };
    }
    if (billAddr) invoicePayload.BillAddr = billAddr;
    if (shipAddr) invoicePayload.ShipAddr = shipAddr;
    if (outOfStateTaxCodeId) {
      invoicePayload.TxnTaxDetail = {
        TxnTaxCodeRef: { value: outOfStateTaxCodeId },
      };
    }
    const customFields = [
      customFieldDefIds.salesRep
        ? { DefinitionId: customFieldDefIds.salesRep, Name: "Sales Rep", Type: "StringType", StringValue: SALES_REP_VALUE }
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

    let nextDocNumber = await getNextSequentialInvoiceDocNumber();
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
      if (invoice?.Id) break;
    }

    if (!invoice?.Id) {
      throw new Error("QuickBooks did not return created invoice id");
    }

    // WA sales tax adjustment: make QBO invoice total match Shopify total exactly
    let taxAdjustmentWarning: string | null = null;
    if (isDeliveredToWashington(order)) {
      const shopifyTax = parseFloat(Number(order.total_tax || 0).toFixed(2));
      const qboTax = parseFloat(Number(invoice.TxnTaxDetail?.TotalTax || 0).toFixed(2));
      const qboTotal = parseFloat(Number(invoice.TotalAmt || 0).toFixed(2));
      const shopifyTotal = parseFloat(Number(order.total_price).toFixed(2));
      const diff = parseFloat((shopifyTotal - qboTotal).toFixed(2));
      if (Math.abs(diff) >= 0.01) {
        const taxMissing = qboTax < 0.01 && shopifyTax > 0.01;
        if (taxMissing) {
          taxAdjustmentWarning = "Sales Tax Review: no WA tax rate found in QBO for this location";
        }
        const miscItemId = await resolveMiscAdjustmentItemId(settingsData?.qbo_default_item_id || null);
        if (miscItemId) {
          const adjustmentLine: any = {
            DetailType: "SalesItemLineDetail",
            Amount: diff,
            Description: `Sales Tax Adjustment (Shopify tax: $${shopifyTax.toFixed(2)}, QBO tax: $${qboTax.toFixed(2)})`,
            SalesItemLineDetail: {
              ItemRef: { value: miscItemId },
              Qty: 1,
              UnitPrice: diff,
            },
          };
          const updatePayload = {
            ...invoice,
            Line: [...(invoice.Line || []).filter((l: any) => l.DetailType !== "SubTotalLineDetail"), adjustmentLine],
          };
          const updateRes = await authorizedQboFetch<any>("/invoice?minorversion=65&operation=update", {
            method: "POST",
            body: JSON.stringify(updatePayload),
          }).catch(() => null);
          if (updateRes?.Invoice?.Id) {
            invoice = updateRes.Invoice;
          }
        } else if (!taxAdjustmentWarning) {
          taxAdjustmentWarning = `Sales Tax Adjustment of $${diff.toFixed(2)} needed but no misc/adjustment item found in QBO`;
        }
      }
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

    // Record full payment via Shopify payment method
    let paymentId: string | null = null;
    const payAmount = Number(order.total_price);
    if (payAmount > 0) {
      const pmId = await resolveShopifyPaymentMethodId(
        settingsData?.qbo_payment_method_id || null,
        settingsData?.qbo_payment_method_name || null
      );
      const paymentPayload: any = {
        CustomerRef: { value: customerId },
        TotalAmt: payAmount,
        TxnDate: new Date().toISOString().slice(0, 10),
        Line: [{ Amount: payAmount, LinkedTxn: [{ TxnId: invoice.Id, TxnType: "Invoice" }] }],
      };
      if (pmId) paymentPayload.PaymentMethodRef = { value: pmId };
      if (settingsData?.qbo_deposit_account_id) paymentPayload.DepositToAccountRef = { value: settingsData.qbo_deposit_account_id };
      const paymentRes = await authorizedQboFetch<any>("/payment?minorversion=65", {
        method: "POST",
        body: JSON.stringify(paymentPayload),
      });
      paymentId = paymentRes?.Payment?.Id ? String(paymentRes.Payment.Id) : null;
    }

    let sentToEmail: string | null = null;
    let sendWarning: string | null = null;

    try {
      const sendTo = FORCED_INVOICE_SEND_TO_EMAIL;

      const pdfRes = await authorizedQboFetchRaw(`/invoice/${invoice.Id}/pdf`, {
        headers: { Accept: "application/pdf" },
      });

      const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
      const transporter = getTransporter();
      const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;

      await transporter.sendMail({
        from: smtpFrom,
        to: sendTo,
        subject: `Invoice ${invoice.DocNumber || invoice.Id}`,
        text: `Please find attached the invoice.`,
        attachments: [
          {
            filename: `Invoice-${invoice.DocNumber || invoice.Id}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });

      sentToEmail = sendTo;
    } catch (sendErr: any) {
      sendWarning = sendErr?.message || "Invoice email send failed";
    }

    return NextResponse.json({
      ok: true,
      invoiceId: invoice.Id,
      invoiceNumber: invoice.DocNumber || null,
      paymentId,
      sentToEmail,
      sendWarning: sendWarning || taxAdjustmentWarning || null,
      shopifyOrderId: String(order.id),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create QBO invoice from Shopify order" },
      { status: 500 }
    );
  }
}