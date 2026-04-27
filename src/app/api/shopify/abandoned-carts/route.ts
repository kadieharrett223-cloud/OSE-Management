import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getShopifyTokens } from "@/lib/shopify";

const SHOPIFY_API_VERSION = "2024-01";
const MIN_ABANDONED_CART_DATE = "2026-04-24T00:00:00Z";

type ShopifyCheckout = {
  id: number;
  token: string;
  created_at: string;
  updated_at: string;
  total_price: string;
  subtotal_price?: string;
  total_tax?: string;
  currency: string;
  email?: string | null;
  abandoned_checkout_url?: string | null;
  shipping_address?: {
    first_name?: string | null;
    last_name?: string | null;
    city?: string | null;
    province_code?: string | null;
    country_code?: string | null;
  } | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
  line_items?: Array<{
    title?: string | null;
    quantity?: number | null;
    price?: string | null;
  }>;
};

function getNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const links = linkHeader.split(",").map((part) => part.trim());
  const next = links.find((link) => /rel=\"next\"/.test(link));
  if (!next) return null;
  const match = next.match(/<([^>]+)>/);
  return match?.[1] || null;
}

function customerName(checkout: ShopifyCheckout): string {
  const fromCustomer = [checkout.customer?.first_name, checkout.customer?.last_name].filter(Boolean).join(" ").trim();
  if (fromCustomer) return fromCustomer;
  const fromShipping = [checkout.shipping_address?.first_name, checkout.shipping_address?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromShipping) return fromShipping;
  return checkout.email || checkout.customer?.email || "Unknown";
}

function isCheckoutScopeApprovalError(status: number, text: string): boolean {
  if (status !== 403) return false;
  const normalized = String(text || "").toLowerCase();
  return normalized.includes("read_checkouts") || normalized.includes("merchant approval");
}

export async function GET(req: NextRequest) {
  try {
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();
    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const tokens = await getShopifyTokens();
    if (!tokens) {
      return NextResponse.json({ error: "Shopify not connected" }, { status: 401 });
    }

    const sp = req.nextUrl.searchParams;
    const daysRaw = Number(sp.get("days") || "7");
    const days = Math.min(Math.max(Number.isFinite(daysRaw) ? Math.floor(daysRaw) : 7, 1), 365);

    const dynamicSinceDate = new Date();
    dynamicSinceDate.setDate(dynamicSinceDate.getDate() - days);

    const minimumDate = new Date(MIN_ABANDONED_CART_DATE);
    const sinceDate = dynamicSinceDate < minimumDate ? minimumDate : dynamicSinceDate;

    const params = new URLSearchParams({
      limit: "250",
      status: "open",
      created_at_min: sinceDate.toISOString(),
      fields:
        "id,token,created_at,updated_at,total_price,subtotal_price,total_tax,currency,email,abandoned_checkout_url,shipping_address,customer,line_items",
    });

    let nextUrl: string | null = `https://${tokens.shop}/admin/api/${SHOPIFY_API_VERSION}/checkouts.json?${params.toString()}`;
    const allCheckouts: ShopifyCheckout[] = [];

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: {
          "X-Shopify-Access-Token": tokens.access_token,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const text = await response.text();
        if (isCheckoutScopeApprovalError(response.status, text)) {
          return NextResponse.json(
            {
              error:
                "Shopify checkout access is not approved for this app. Approve read_checkouts in Shopify and reconnect the store in Settings.",
            },
            { status: 403 }
          );
        }
        throw new Error(`Shopify API error ${response.status}: ${text}`);
      }

      const payload = (await response.json()) as { checkouts?: ShopifyCheckout[] };
      allCheckouts.push(...(payload.checkouts || []));
      nextUrl = getNextPageUrl(response.headers.get("Link"));
    }

    const carts = allCheckouts
      .map((checkout) => ({
        id: Number(checkout.id),
        token: checkout.token,
        created_at: checkout.created_at,
        updated_at: checkout.updated_at,
        total_price: checkout.total_price,
        subtotal_price: checkout.subtotal_price || "0",
        total_tax: checkout.total_tax || "0",
        currency: checkout.currency || "USD",
        customerName: customerName(checkout),
        customerEmail: checkout.email || checkout.customer?.email || "",
        city: checkout.shipping_address?.city || "",
        state: checkout.shipping_address?.province_code || "",
        country: checkout.shipping_address?.country_code || "",
        lineItemCount: Array.isArray(checkout.line_items)
          ? checkout.line_items.reduce((sum, line) => sum + (Number(line?.quantity || 0) || 0), 0)
          : 0,
        abandoned_checkout_url: checkout.abandoned_checkout_url || null,
      }))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

    return NextResponse.json({
      ok: true,
      days,
      minStartDate: MIN_ABANDONED_CART_DATE,
      count: carts.length,
      carts,
    });
  } catch (err: any) {
    console.error("[shopify/abandoned-carts] Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch abandoned carts" }, { status: 500 });
  }
}
