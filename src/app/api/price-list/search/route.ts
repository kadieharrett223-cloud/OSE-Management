import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q") || "";

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const supabase = getServerSupabaseClient();

    // Search in item_no, description, and category
    const { data, error } = await supabase
      .from("price_list")
      .select("id, item_no, description, cost_with_shipping, fob_port_cost, list_price, category_id")
      .or(
        `item_no.ilike.%${query}%,description.ilike.%${query}%`
      )
      .limit(10);

    if (error) throw error;

    return NextResponse.json({ 
      results: data || [] 
    });
  } catch (error: any) {
    console.error("Price list search error:", error);
    return NextResponse.json(
      { error: error.message || "Search failed" },
      { status: 500 }
    );
  }
}
