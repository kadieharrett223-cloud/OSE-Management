export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { buildShopifyAuthUrl } from "@/lib/shopify";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Require admin to connect Shopify
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();
    
    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const body = await req.json();
    const { shop } = body;

    if (!shop) {
      return NextResponse.json({ error: "Shop domain required" }, { status: 400 });
    }

    // Validate shop format (should be like: mystore.myshopify.com)
    const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;

    const authUrl = buildShopifyAuthUrl(shopDomain);
    return NextResponse.json({ authUrl });
  } catch (error: any) {
    console.error("Shopify connect error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initiate Shopify connection" },
      { status: 500 }
    );
  }
}
