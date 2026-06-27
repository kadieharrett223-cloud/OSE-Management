import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

const toInt = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
};

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

export async function POST(req: Request) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = String(body?.name || "").trim();
  const onFloor = toInt(body?.onFloor);
  const sold = toInt(body?.sold);
  const available = toInt(body?.available);

  if (!name) {
    return NextResponse.json({ error: "Product name is required" }, { status: 400 });
  }

  try {
    const supabase = getServerSupabaseClient();

    const { data: created, error: createError } = await supabase
      .from("inventory_products")
      .insert({
        name,
        on_floor: onFloor,
        sold,
        available,
      })
      .select("id, name, on_floor, sold, available")
      .single();

    if (createError) {
      if ((createError as any).code === "23505") {
        return NextResponse.json({ error: "Product already exists" }, { status: 409 });
      }
      throw createError;
    }

    return NextResponse.json(
      {
        data: {
          id: (created as any).id,
          name: (created as any).name,
          onFloor: Number((created as any).on_floor) || 0,
          sold: Number((created as any).sold) || 0,
          available: Number((created as any).available) || 0,
          orderCount: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("inventory product create error", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
