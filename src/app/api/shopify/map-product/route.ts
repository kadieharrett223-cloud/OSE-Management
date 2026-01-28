export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();
    
    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const body = await req.json();
    const { variantId, priceListItemId } = body;

    if (!variantId) {
      return NextResponse.json({ error: "variantId is required" }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();

    // Clear any existing mappings for this variant
    await supabase
      .from("price_list_items")
      .update({ shopify_variant_id: null })
      .eq("shopify_variant_id", variantId);

    // Set new mapping if priceListItemId provided
    if (priceListItemId) {
      const { error } = await supabase
        .from("price_list_items")
        .update({ shopify_variant_id: variantId })
        .eq("id", priceListItemId);

      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Map product error:", error);
    return NextResponse.json({ error: error.message || "Failed to save mapping" }, { status: 500 });
  }
}
