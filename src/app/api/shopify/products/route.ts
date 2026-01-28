export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getShopifyProducts } from "@/lib/shopify";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();
    
    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const products = await getShopifyProducts();
    return NextResponse.json({ ok: true, products });
  } catch (error: any) {
    console.error("Get Shopify products error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch products" }, { status: 500 });
  }
}
