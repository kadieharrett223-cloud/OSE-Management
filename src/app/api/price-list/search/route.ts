import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  console.log("[SEARCH] Request received");
  
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q") || "";

    console.log("[SEARCH] Query:", query);

    if (!query || query.trim().length === 0) {
      console.log("[SEARCH] Query empty, returning empty results");
      return NextResponse.json({ results: [] });
    }

    // Use service role key for better permissions
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("[SEARCH] URL check:", url ? "exists" : "MISSING");
    console.log("[SEARCH] Key check:", serviceKey ? "exists" : "MISSING");

    if (!url || !serviceKey) {
      throw new Error(`Missing Supabase credentials: URL=${!!url}, KEY=${!!serviceKey}`);
    }

    const supabase = createClient(url, serviceKey);
    console.log("[SEARCH] Supabase client created with service role");

    // Try a simple query first
    const { data, error } = await supabase
      .from("price_list")
      .select("id, item_no, description, cost_with_shipping, fob_port_cost, list_price, category_id")
      .ilike("item_no", `%${query}%`)
      .limit(10);

    console.log("[SEARCH] Query error:", error?.message || "none");
    console.log("[SEARCH] Data length:", data?.length);

    if (error) {
      console.error("[SEARCH] Supabase error:", error);
      throw error;
    }

    console.log("[SEARCH] Returning", data?.length || 0, "results");
    return NextResponse.json({ results: data || [] });
  } catch (error: any) {
    console.error("[SEARCH] CAUGHT ERROR:", error);
    console.error("[SEARCH] Error message:", error.message);
    
    return NextResponse.json(
      { error: error.message || "Search failed" },
      { status: 500 }
    );
  }
}
