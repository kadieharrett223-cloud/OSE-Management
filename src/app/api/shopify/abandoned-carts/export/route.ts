import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getShopifyTokens } from "@/lib/shopify";
import PDFDocument from "pdfkit";

export const runtime = "nodejs";

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

function buildPdf(checkout: CheckoutDetail): Promise<Buffer> {
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

  const doc = new PDFDocument({ margin: 40, size: "LETTER" });
  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text("Shopify Abandoned Cart", { underline: true });
    doc.moveDown(0.7);
    doc.fontSize(10);

    const rows: Array<[string, string]> = [
      ["Checkout ID", String(checkout.id || "")],
      ["Checkout Token", checkout.token || ""],
      ["Created At", checkout.created_at || ""],
      ["Updated At", checkout.updated_at || ""],
      ["Customer Name", shippingName || ""],
      ["Customer Email", checkout.email || ""],
      ["Shipping Address", shippingAddress || ""],
      ["Subtotal", checkout.subtotal_price || "0"],
      ["Sales Tax", checkout.total_tax || "0"],
      ["Total", checkout.total_price || "0"],
      ["Currency", checkout.currency || "USD"],
      ["Recovery URL", checkout.abandoned_checkout_url || ""],
    ];

    for (const [label, value] of rows) {
      doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
      doc.font("Helvetica").text(value || "-");
    }

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(12).text("Line Items");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica");

    if (!checkout.line_items || checkout.line_items.length === 0) {
      doc.text("No line items.");
    } else {
      for (const [index, lineItem] of checkout.line_items.entries()) {
        const qty = Number(lineItem.quantity || 0) || 0;
        const unitPrice = Number(lineItem.price || 0) || 0;
        const lineTotal = (qty * unitPrice).toFixed(2);
        doc.font("Helvetica-Bold").text(`${index + 1}. ${lineItem.title || "Item"}`);
        doc.font("Helvetica").text(`SKU: ${lineItem.sku || "-"}`);
        doc.text(`Qty: ${qty}    Unit Price: ${unitPrice.toFixed(2)}    Line Total: ${lineTotal}`);
        doc.moveDown(0.35);
      }
    }

    doc.end();
  });
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

    const pdfContent = await buildPdf(checkout);
    const safeToken = checkout.token.replace(/[^a-zA-Z0-9_-]/g, "");

    return new NextResponse(new Uint8Array(pdfContent), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=abandoned-cart-${safeToken || "checkout"}.pdf`,
      },
    });
  } catch (err: any) {
    console.error("[shopify/abandoned-carts/export] Error:", err);
    return NextResponse.json({ error: err?.message || "Failed to export abandoned cart" }, { status: 500 });
  }
}
