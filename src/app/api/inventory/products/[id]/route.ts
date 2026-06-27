import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

const toInt = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServerSupabaseClient();

    const { data: product, error: productError } = await supabase
      .from("inventory_products")
      .select("id, name, on_floor, sold, available")
      .eq("id", params.id)
      .maybeSingle();

    if (productError) throw productError;

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const { count: orderCount, error: countError } = await supabase
      .from("inventory_order_entries")
      .select("id", { head: true, count: "exact" })
      .eq("product_id", params.id);

    if (countError) throw countError;

    return NextResponse.json({
      data: {
        id: product.id,
        name: product.name,
        onFloor: Number((product as any).on_floor) || 0,
        sold: Number(product.sold) || 0,
        available: Number(product.available) || 0,
        orderCount: orderCount || 0,
      },
    });
  } catch (error) {
    console.error("inventory product details error", error);
    return NextResponse.json({ error: "Failed to load product" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = body?.name === undefined ? undefined : String(body?.name || "").trim();
  const onFloor = body?.onFloor === undefined ? undefined : toInt(body?.onFloor);
  const sold = body?.sold === undefined ? undefined : toInt(body?.sold);
  const available = body?.available === undefined ? undefined : toInt(body?.available);

  if (name !== undefined && !name) {
    return NextResponse.json({ error: "Product name cannot be empty" }, { status: 400 });
  }

  if (name === undefined && onFloor === undefined && sold === undefined && available === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const supabase = getServerSupabaseClient();

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) updatePayload.name = name;
    if (onFloor !== undefined) updatePayload.on_floor = onFloor;
    if (sold !== undefined) updatePayload.sold = sold;
    if (available !== undefined) updatePayload.available = available;

    const { data: updated, error: updateError } = await supabase
      .from("inventory_products")
      .update(updatePayload)
      .eq("id", params.id)
      .select("id, name, on_floor, sold, available")
      .maybeSingle();

    if (updateError) {
      if ((updateError as any).code === "23505") {
        return NextResponse.json({ error: "Product name already exists" }, { status: 409 });
      }
      throw updateError;
    }

    if (!updated) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const { count: orderCount, error: countError } = await supabase
      .from("inventory_order_entries")
      .select("id", { head: true, count: "exact" })
      .eq("product_id", params.id);

    if (countError) throw countError;

    return NextResponse.json({
      data: {
        id: (updated as any).id,
        name: (updated as any).name,
        onFloor: Number((updated as any).on_floor) || 0,
        sold: Number((updated as any).sold) || 0,
        available: Number((updated as any).available) || 0,
        orderCount: orderCount || 0,
      },
    });
  } catch (error) {
    console.error("inventory product update error", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}
