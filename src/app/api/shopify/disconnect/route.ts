export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { clearShopifyTokens } from "@/lib/shopify";
import { getSession } from "@/lib/auth";

export async function POST(_req: NextRequest) {
  try {
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();

    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    await clearShopifyTokens();

    return NextResponse.json({ ok: true, message: "Shopify disconnected" });
  } catch (error: any) {
    console.error("Shopify disconnect error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to disconnect Shopify" },
      { status: 500 }
    );
  }
}
