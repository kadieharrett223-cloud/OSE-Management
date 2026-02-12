import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function GET() {
  const supabase = getServerSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("price_list_categories")
      .select("id, category_name, display_order")
      .order("display_order", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ items: data || [] });
  } catch (error: any) {
    console.error("Fetch price list categories error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch categories" }, { status: 500 });
  }
}
