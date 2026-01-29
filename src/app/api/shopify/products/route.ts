export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getShopifyProductsByCollectionIds } from "@/lib/shopify";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export async function GET(req: NextRequest) {
  try {
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();
    
    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const supabase = getServerSupabaseClient();
    const { data: settings } = await supabase
      .from("shopify_settings")
      .select("allowed_collection_ids")
      .eq("id", SETTINGS_ID)
      .maybeSingle();

    const allowedCollectionIds = (settings?.allowed_collection_ids || []) as string[];
    const products = await getShopifyProductsByCollectionIds(allowedCollectionIds);
    return NextResponse.json({ ok: true, products });
  } catch (error: any) {
    console.error("Get Shopify products error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch products" }, { status: 500 });
  }
}
