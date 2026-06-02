import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

function isMissingDirectLaborColumn(error: { message?: string } | null) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("direct_labor") && message.includes("schema cache");
}

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

    if (error && !isMissingDirectLaborColumn(error)) {
      const status = error.code === "23505" ? 409 : 500;
      return NextResponse.json({ error: error.message || "Failed to create item" }, { status });
    }

    let created: any = data;

    if (error && isMissingDirectLaborColumn(error)) {
      const { direct_labor: _directLabor, ...payloadWithoutDirectLabor } = payload;
      const retry = await supabase
        .from("price_list_items")
        .insert(payloadWithoutDirectLabor)
        .select("id, item_no, description, list_price, shipping_included_per_unit, weight_lbs, fob_cost, indirect_labor, overhead_cost, shopify_variant_id")
        .single();

      if (retry.error) {
        const status = retry.error.code === "23505" ? 409 : 500;
        return NextResponse.json({ error: retry.error.message || "Failed to create item" }, { status });
      }

      created = { ...retry.data, direct_labor: null };
    }

    if (!created) {
      return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
    }

    const item = {
      id: created.id,
      sku: created.item_no,
      description: created.description || "",
      currentSalePricePerUnit: Number(created.list_price || 0),
      shippingIncludedPerUnit: Number(created.shipping_included_per_unit || 0),
      weight_lbs: created.weight_lbs ? Number(created.weight_lbs) : null,
      fob_cost: created.fob_cost ? Number(created.fob_cost) : null,
      indirect_labor: created.indirect_labor ? Number(created.indirect_labor) : null,
      direct_labor: created.direct_labor ? Number(created.direct_labor) : null,
      overhead_cost: created.overhead_cost ? Number(created.overhead_cost) : null,
      shopify_variant_id: created.shopify_variant_id || null,
    };

    return NextResponse.json({ item });
  } catch (error: any) {
    console.error("Create price list item error:", error);
    return NextResponse.json({ error: error.message || "Failed to create item" }, { status: 500 });
  }
}
