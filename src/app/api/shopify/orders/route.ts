import { NextRequest, NextResponse } from "next/server";
import { getShopifyTokens } from "@/lib/shopify";
import { getSession } from "@/lib/auth";
import { syncShopifyOrdersToQbo } from "@/lib/shopify-qbo-sync";

const SHOPIFY_API_VERSION = "2024-01";

function getNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  const links = linkHeader.split(",").map((part) => part.trim());
  const next = links.find((link) => /rel="next"/.test(link));
  if (!next) return null;

  const match = next.match(/<([^>]+)>/);
  return match?.[1] || null;
}

export interface ShopifyOrderSummary {
  id: number;
  /** e.g. "#1108" */
  name: string;
  /** Numeric order number extracted from name, e.g. "1108" */
  orderNumber: string;
  created_at: string;
  total_price: string;
  financial_status: string;
  fulfillment_status: string | null;
  customerName: string;
  customerEmail: string;
  note: string | null;
  deliveryStateCode: string | null;
  isWashingtonDelivery: boolean;
}

function getDeliveryStateCode(order: any): string {
  const raw =
    order?.shipping_address?.province_code ||
    order?.shipping_address?.province ||
    order?.billing_address?.province_code ||
    order?.billing_address?.province ||
    "";
  return String(raw).trim();
}

function isWashingtonState(value: string): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "wa" || normalized === "washington";
}

export async function GET(req: NextRequest) {
  try {
    const tokens = await getShopifyTokens();
    if (!tokens) {
      return NextResponse.json({ error: "Shopify not connected" }, { status: 401 });
    }

    const sp = req.nextUrl.searchParams;
    const startDate = sp.get("startDate"); // ISO date YYYY-MM-DD
    const endDate = sp.get("endDate");
    const limit = Math.min(Number(sp.get("limit") || "250"), 250);

    const params = new URLSearchParams({
      limit: String(limit),
      status: "any",
    });
    if (startDate) params.set("created_at_min", `${startDate}T00:00:00-00:00`);
    if (endDate) params.set("created_at_max", `${endDate}T23:59:59-00:00`);

    let allOrders: any[] = [];
    let nextUrl: string | null = `https://${tokens.shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json?${params.toString()}`;

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

      const data = (await response.json()) as { orders: any[] };
      const page = data?.orders || [];
      allOrders = allOrders.concat(page);
      nextUrl = getNextPageUrl(response.headers.get("Link"));
    }

    const orders: ShopifyOrderSummary[] = allOrders.map((o: any) => {
      const firstName = o.customer?.first_name || "";
      const lastName = o.customer?.last_name || "";
      const customerName = [firstName, lastName].filter(Boolean).join(" ").trim() || o.email || "Unknown";
      // Strip leading # from order name to get numeric string
      const orderNumber = String(o.name || "").replace(/^#/, "").trim();
      const deliveryStateCode = getDeliveryStateCode(o);

      return {
        id: Number(o.id),
        name: o.name,
        orderNumber,
        created_at: o.created_at,
        total_price: o.total_price,
        financial_status: o.financial_status,
        fulfillment_status: o.fulfillment_status || null,
        customerName,
        customerEmail: o.customer?.email || o.email || "",
        note: o.note || null,
        deliveryStateCode: deliveryStateCode || null,
        isWashingtonDelivery: isWashingtonState(deliveryStateCode),
      };
    });

    return NextResponse.json({ ok: true, orders, count: orders.length });
  } catch (err: any) {
    console.error("[shopify/orders] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch Shopify orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const providedSecret = bearer || req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
    const cronAuthorized = !!cronSecret && providedSecret === cronSecret;

    if (!cronAuthorized) {
      const session: any = await getSession();
      const role = (session?.user?.role ?? "").toString().toLowerCase();
      if (role !== "admin") {
        return NextResponse.json({ error: "Admin role required" }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const since = typeof body?.since === "string" ? body.since : undefined;
    const force = Boolean(body?.force || body?.manualImport);

    const result = await syncShopifyOrdersToQbo({
      since,
      force,
      triggerSource: cronAuthorized ? "cron" : "manual",
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[shopify/orders] POST sync error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to sync Shopify orders to QuickBooks" },
      { status: 500 }
    );
  }
}
