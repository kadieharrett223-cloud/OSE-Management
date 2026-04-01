import { NextRequest, NextResponse } from "next/server";
import { shopifyApiFetch, getShopifyTokens } from "@/lib/shopify";

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

    // Paginate through all orders within range
    let allOrders: any[] = [];
    let url = `/orders.json?${params.toString()}`;

    while (url) {
      const data = await shopifyApiFetch<{ orders: any[]; _linkHeader?: string }>(url);
      const page = data?.orders || [];
      allOrders = allOrders.concat(page);

      // Shopify uses Link header for cursor pagination handled by shopifyApiFetch
      // If we got a full page we may need next page; but shopifyApiFetch doesn't expose Link header
      // so we stop when we get fewer than limit (no more pages)
      if (page.length < limit) break;

      // If date range is filtering server-side, try advancing by since_id
      const lastId = page[page.length - 1]?.id;
      if (!lastId) break;

      const nextParams = new URLSearchParams(params);
      nextParams.set("since_id", String(lastId));
      url = `/orders.json?${nextParams.toString()}`;
    }

    const orders: ShopifyOrderSummary[] = allOrders.map((o: any) => {
      const firstName = o.customer?.first_name || "";
      const lastName = o.customer?.last_name || "";
      const customerName = [firstName, lastName].filter(Boolean).join(" ").trim() || o.email || "Unknown";
      // Strip leading # from order name to get numeric string
      const orderNumber = String(o.name || "").replace(/^#/, "").trim();

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
      };
    });

    return NextResponse.json({ ok: true, orders, count: orders.length });
  } catch (err: any) {
    console.error("[shopify/orders] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch Shopify orders" }, { status: 500 });
  }
}
