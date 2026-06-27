import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function GET() {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServerSupabaseClient();

    const { data: products, error: productsError } = await supabase
      .from("inventory_products")
      .select("id, name, on_floor, sold, available")
      .order("name", { ascending: true });

    if (productsError) throw productsError;

    const { data: entries, error: entriesError } = await supabase
      .from("inventory_order_entries")
      .select("product_id");

    if (entriesError) throw entriesError;

    const orderCountByProduct = new Map<string, number>();
    for (const row of entries || []) {
      const productId = String((row as any).product_id || "");
      if (!productId) continue;
      orderCountByProduct.set(productId, (orderCountByProduct.get(productId) || 0) + 1);
    }

    return NextResponse.json({
      data: (products || []).map((product: any) => ({
        id: product.id,
        name: product.name,
        onFloor: Number(product.on_floor) || 0,
        sold: Number(product.sold) || 0,
        available: Number(product.available) || 0,
        orderCount: orderCountByProduct.get(product.id) || 0,
      })),
    });
  } catch (error) {
    console.error("inventory products list error", error);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}
