import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

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
