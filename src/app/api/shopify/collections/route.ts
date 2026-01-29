export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getShopifyCollections } from "@/lib/shopify";

export async function GET(req: NextRequest) {
  try {
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();

    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const collections = await getShopifyCollections();
    return NextResponse.json({ ok: true, collections });
  } catch (error: any) {
    console.error("Get Shopify collections error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch collections" }, { status: 500 });
  }
}
