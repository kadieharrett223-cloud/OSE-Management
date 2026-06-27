import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

type InventoryImportRow = {
  name: string;
  onFloor: number;
  sold: number;
  available: number;
};

const toInt = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
};

export async function POST(req: Request) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "rows array required" }, { status: 400 });
  }

  const mode = body.mode === "append" ? "append" : "replace";

  const rows = (body.rows as any[])
    .map((row): InventoryImportRow => ({
      name: String(row?.name || "").trim(),
      onFloor: toInt(row?.onFloor),
      sold: toInt(row?.sold),
      available: toInt(row?.available),
    }))
    .filter((row) => row.name.length > 0);

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows found to import" }, { status: 400 });
  }

  try {
    const supabase = getServerSupabaseClient();

    if (mode === "replace") {
      const { data: existingProducts, error: existingProductsError } = await supabase
        .from("inventory_products")
        .select("id");

      if (existingProductsError) throw existingProductsError;

      const productIds = (existingProducts || []).map((row: any) => row.id).filter(Boolean);

      if (productIds.length > 0) {
        const { error: deleteOrdersError } = await supabase
          .from("inventory_order_entries")
          .delete()
          .in("product_id", productIds);

        if (deleteOrdersError) throw deleteOrdersError;

        const { error: deleteProductsError } = await supabase
          .from("inventory_products")
          .delete()
          .in("id", productIds);

        if (deleteProductsError) throw deleteProductsError;
      }

      const { error: insertError } = await supabase.from("inventory_products").insert(
        rows.map((row) => ({
          name: row.name,
          on_floor: row.onFloor,
          sold: row.sold,
          available: row.available,
        }))
      );

      if (insertError) throw insertError;
    } else {
      const { error: upsertError } = await supabase.from("inventory_products").upsert(
        rows.map((row) => ({
          name: row.name,
          on_floor: row.onFloor,
          sold: row.sold,
          available: row.available,
        })),
        { onConflict: "name" }
      );

      if (upsertError) throw upsertError;
    }

    const { count: total, error: countError } = await supabase
      .from("inventory_products")
      .select("id", { head: true, count: "exact" });

    if (countError) throw countError;

    return NextResponse.json({ imported: rows.length, totalProducts: total, mode });
  } catch (error) {
    console.error("inventory import error", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
