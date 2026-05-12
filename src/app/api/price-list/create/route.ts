import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function POST(req: Request) {
  const supabase = getServerSupabaseClient();

  try {
    const body = await req.json();
    const itemNo = String(body.item_no || "").trim();
    const description = String(body.description || "").trim();

    if (!itemNo || !description) {
      return NextResponse.json({ error: "item_no and description are required" }, { status: 400 });
    }

    const payload = {
      item_no: itemNo,
      description,
      category_id: body.category_id || null,
      supplier: body.supplier || null,
      fob_cost: Number.isFinite(body.fob_cost) ? Number(body.fob_cost) : null,
      quantity: Number.isFinite(body.quantity) ? Number(body.quantity) : null,
      ocean_frt: Number.isFinite(body.ocean_frt) ? Number(body.ocean_frt) : null,
      importing: Number.isFinite(body.importing) ? Number(body.importing) : null,
      indirect_labor: Number.isFinite(body.indirect_labor) ? Number(body.indirect_labor) : null,
      direct_labor: Number.isFinite(body.direct_labor) ? Number(body.direct_labor) : null,
      overhead_cost: Number.isFinite(body.overhead_cost) ? Number(body.overhead_cost) : null,
      zone5_shipping: Number.isFinite(body.zone5_shipping) ? Number(body.zone5_shipping) : null,
      multiplier: Number.isFinite(body.multiplier) ? Number(body.multiplier) : 1,
      weight_lbs: Number.isFinite(body.weight_lbs) ? Number(body.weight_lbs) : null,
    };

    const { data, error } = await supabase
      .from("price_list_items")
      .insert(payload)
      .select("id, item_no, description, list_price, shipping_included_per_unit, weight_lbs, fob_cost, indirect_labor, direct_labor, overhead_cost, shopify_variant_id")
      .single();

    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      return NextResponse.json({ error: error.message || "Failed to create item" }, { status });
    }

    const item = {
      id: data.id,
      sku: data.item_no,
      description: data.description || "",
      currentSalePricePerUnit: Number(data.list_price || 0),
      shippingIncludedPerUnit: Number(data.shipping_included_per_unit || 0),
      weight_lbs: data.weight_lbs ? Number(data.weight_lbs) : null,
      fob_cost: data.fob_cost ? Number(data.fob_cost) : null,
      indirect_labor: data.indirect_labor ? Number(data.indirect_labor) : null,
      direct_labor: data.direct_labor ? Number(data.direct_labor) : null,
      overhead_cost: data.overhead_cost ? Number(data.overhead_cost) : null,
      shopify_variant_id: data.shopify_variant_id || null,
    };

    return NextResponse.json({ item });
  } catch (error: any) {
    console.error("Create price list item error:", error);
    return NextResponse.json({ error: error.message || "Failed to create item" }, { status: 500 });
  }
}
