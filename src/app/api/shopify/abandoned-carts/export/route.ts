import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getShopifyTokens } from "@/lib/shopify";

const SHOPIFY_API_VERSION = "2024-01";

type CheckoutLineItem = {
  title?: string | null;
  sku?: string | null;
  quantity?: number | null;
  price?: string | null;
};

type CheckoutDetail = {
  id: number;
  token: string;
  created_at: string;
  updated_at: string;
  email?: string | null;
  subtotal_price?: string;
  total_tax?: string;
  total_price?: string;
  currency?: string;
  abandoned_checkout_url?: string | null;
  shipping_address?: {
    first_name?: string | null;
    last_name?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    province?: string | null;
    province_code?: string | null;
    zip?: string | null;
    country?: string | null;
    country_code?: string | null;
  } | null;
  line_items?: CheckoutLineItem[];
};

function csv(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(checkout: CheckoutDetail): string {
  const shippingName = [checkout.shipping_address?.first_name, checkout.shipping_address?.last_name].filter(Boolean).join(" ").trim();
  const shippingAddress = [
    checkout.shipping_address?.address1,
    checkout.shipping_address?.address2,
    checkout.shipping_address?.city,
    checkout.shipping_address?.province_code || checkout.shipping_address?.province,
    checkout.shipping_address?.zip,
    checkout.shipping_address?.country_code || checkout.shipping_address?.country,
  ]
    .filter(Boolean)
    .join(", ");

  const lines: string[] = [];
  lines.push("Field,Value");
  lines.push(`Checkout ID,${csv(checkout.id)}`);
  lines.push(`Checkout Token,${csv(checkout.token)}`);
  lines.push(`Created At,${csv(checkout.created_at)}`);
  lines.push(`Updated At,${csv(checkout.updated_at)}`);
  lines.push(`Customer Name,${csv(shippingName)}`);
  lines.push(`Customer Email,${csv(checkout.email || "")}`);
  lines.push(`Shipping Address,${csv(shippingAddress)}`);
  lines.push(`Subtotal,${csv(checkout.subtotal_price || "0")}`);
  lines.push(`Sales Tax,${csv(checkout.total_tax || "0")}`);
  lines.push(`Total,${csv(checkout.total_price || "0")}`);
  lines.push(`Currency,${csv(checkout.currency || "USD")}`);
  lines.push(`Recovery URL,${csv(checkout.abandoned_checkout_url || "")}`);
  lines.push("");
  lines.push("Line Item,SKU,Qty,Unit Price,Line Total");

  for (const lineItem of checkout.line_items || []) {
    const qty = Number(lineItem.quantity || 0) || 0;
    const unitPrice = Number(lineItem.price || 0) || 0;
    const lineTotal = (qty * unitPrice).toFixed(2);
    lines.push(
      [
        csv(lineItem.title || ""),
        csv(lineItem.sku || ""),
        csv(qty),
        csv(unitPrice.toFixed(2)),
        csv(lineTotal),
      ].join(",")
    );
  }

  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  try {
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();
    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const token = String(req.nextUrl.searchParams.get("token") || "").trim();
    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    const tokens = await getShopifyTokens();
    if (!tokens) {
      return NextResponse.json({ error: "Shopify not connected" }, { status: 401 });
    }

    const fields =
      "id,token,created_at,updated_at,email,subtotal_price,total_tax,total_price,currency,abandoned_checkout_url,shipping_address,line_items";

    const url = `https://${tokens.shop}/admin/api/${SHOPIFY_API_VERSION}/checkouts/${encodeURIComponent(token)}.json?fields=${encodeURIComponent(fields)}`;

    const response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": tokens.access_token,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify API error ${response.status}: ${text}`);
    }

    const payload = (await response.json()) as { checkout?: CheckoutDetail };
    const checkout = payload.checkout;
    if (!checkout?.token) {
      return NextResponse.json({ error: "Checkout not found" }, { status: 404 });
    }

    const csvContent = buildCsv(checkout);
    const safeToken = checkout.token.replace(/[^a-zA-Z0-9_-]/g, "");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=abandoned-cart-${safeToken || "checkout"}.csv`,
      },
    });
  } catch (err: any) {
    console.error("[shopify/abandoned-carts/export] Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to export abandoned cart" }, { status: 500 });
  }
}
