export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, saveShopifyTokens } from "@/lib/shopify";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const shop = searchParams.get("shop");
    const hmac = searchParams.get("hmac");
    const state = searchParams.get("state");

    if (!code || !shop) {
      return NextResponse.json(
        { error: "Missing authorization code or shop" },
        { status: 400 }
      );
    }

    // Exchange code for access token
    const tokens = await exchangeCodeForToken(shop, code);

    // Save tokens to Supabase
    await saveShopifyTokens(tokens);

    console.log(`Shopify connected successfully for shop: ${shop}`);

    // Redirect to settings page with success message
    return NextResponse.redirect(
      new URL("/settings?shopify=connected", req.nextUrl.origin)
    );
  } catch (error: any) {
    console.error("Shopify callback error:", error);
    return NextResponse.redirect(
      new URL(`/settings?shopify=error&message=${encodeURIComponent(error.message)}`, req.nextUrl.origin)
    );
  }
}
