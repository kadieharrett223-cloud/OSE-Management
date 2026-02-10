import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q") || "";

    if (!query || query.length < 1) {
      return NextResponse.json({ results: [] });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );

    console.log("Searching price_list for:", query);

    // First try searching by item_no
    let { data, error } = await supabase
      .from("price_list")
      .select("id, item_no, description, cost_with_shipping, fob_port_cost, list_price, category_id")
      .ilike("item_no", `%${query}%`)
      .limit(10);

    if (error) {
      console.error("Item_no search error:", error);
      // Try description search as fallback
      const { data: descData, error: descError } = await supabase
        .from("price_list")
        .select("id, item_no, description, cost_with_shipping, fob_port_cost, list_price, category_id")
        .ilike("description", `%${query}%`)
        .limit(10);
      
      if (descError) {
        console.error("Description search error:", descError);
        throw descError;
      }
      data = descData;
    } else if (!data || data.length === 0) {
      // If no item_no matches, try description
      const { data: descData, error: descError } = await supabase
        .from("price_list")
        .select("id, item_no, description, cost_with_shipping, fob_port_cost, list_price, category_id")
        .ilike("description", `%${query}%`)
        .limit(10);
      
      if (!descError) {
        data = descData;
      }
    }

    console.log("Found results:", data?.length || 0);
    
    return NextResponse.json({ 
      results: data || [] 
    });
  } catch (error: any) {
    console.error("Price list search error:", error);
    return NextResponse.json(
      { error: error.message || "Search failed", details: error },
      { status: 500 }
    );
  }
}
