import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const supabase = getServerSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("price_list_items")
      .select("id, item_no, description, list_price, shipping_included_per_unit, weight_lbs, fob_cost");

    if (error) throw error;

    // Sort by list_price from lowest to highest (cheapest to most expensive)
    const sortedData = (data || []).sort((a, b) => {
      const priceA = Number(a.list_price || 0);
      const priceB = Number(b.list_price || 0);
      return priceA - priceB;
    });

    // Map to match expected format
    const items = (sortedData || []).map((item: any) => ({
      id: item.id,
      sku: item.item_no,
      description: item.description || "",
      currentSalePricePerUnit: Number(item.list_price || 0),
      shippingIncludedPerUnit: Number(item.shipping_included_per_unit || 0),
      weight_lbs: item.weight_lbs ? Number(item.weight_lbs) : null,
      fob_cost: item.fob_cost ? Number(item.fob_cost) : null,
    }));

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("Fetch price list error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch" }, { status: 500 });
  }
}
