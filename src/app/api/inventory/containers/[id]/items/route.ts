import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

const toInt = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const productId = String(body?.productId || "").trim();
  const quantity = toInt(body?.quantity);

  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  if (quantity <= 0) {
    return NextResponse.json({ error: "quantity must be greater than 0" }, { status: 400 });
  }

  try {
    const supabase = getServerSupabaseClient();

    const { data: container, error: containerError } = await supabase
      .from("inventory_containers")
      .select("id")
      .eq("id", params.id)
      .maybeSingle();

    if (containerError) throw containerError;
    if (!container) return NextResponse.json({ error: "Container not found" }, { status: 404 });

    const { data: product, error: productError } = await supabase
      .from("inventory_products")
      .select("id")
      .eq("id", productId)
      .maybeSingle();

    if (productError) throw productError;
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const { data: existing, error: existingError } = await supabase
      .from("inventory_container_items")
      .select("id, quantity")
      .eq("container_id", params.id)
      .eq("product_id", productId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      const newQuantity = (Number((existing as any).quantity) || 0) + quantity;
      const { data: updated, error: updateError } = await supabase
        .from("inventory_container_items")
        .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
        .eq("id", (existing as any).id)
        .select("id, container_id, product_id, quantity")
        .single();

      if (updateError) throw updateError;

      return NextResponse.json({
        data: {
          id: (updated as any).id,
          containerId: (updated as any).container_id,
          productId: (updated as any).product_id,
          quantity: Number((updated as any).quantity) || 0,
        },
      });
    }

    const { data: created, error: createError } = await supabase
      .from("inventory_container_items")
      .insert({
        container_id: params.id,
        product_id: productId,
        quantity,
      })
      .select("id, container_id, product_id, quantity")
      .single();

    if (createError) throw createError;

    return NextResponse.json(
      {
        data: {
          id: (created as any).id,
          containerId: (created as any).container_id,
          productId: (created as any).product_id,
          quantity: Number((created as any).quantity) || 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("inventory container item upsert error", error);
    return NextResponse.json({ error: "Failed to add item to container" }, { status: 500 });
  }
}
