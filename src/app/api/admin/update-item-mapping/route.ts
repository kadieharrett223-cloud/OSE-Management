import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { qbo_item_id, qbo_item_name, price_list_sku, shipping_included_per_unit } = body;

    if (!qbo_item_id || !price_list_sku || shipping_included_per_unit === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await getServerSupabaseClient();

    // Update the price list item with QBO mapping and shipping amount
    const { data, error } = await supabase
      .from("price_list_items")
      .update({
        qbo_item_id,
        qbo_item_name,
        shipping_included_per_unit: parseFloat(shipping_included_per_unit),
        last_synced_with_qbo: new Date().toISOString(),
      })
      .eq("item_no", price_list_sku)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
