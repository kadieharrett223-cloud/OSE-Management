export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getShopifyTokens } from "@/lib/shopify";
import { getSessionOrBypass } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    // Require admin
    const session: any = await getSessionOrBypass();
    const role = (session?.user?.role ?? "").toString().toLowerCase();
    
    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const tokens = await getShopifyTokens();
    
    return NextResponse.json({
      connected: !!tokens,
      shop: tokens?.shop || null,
    });
  } catch (error: any) {
    console.error("Shopify status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check Shopify status" },
      { status: 500 }
    );
  }
}
