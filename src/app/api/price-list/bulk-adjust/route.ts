import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

type BulkAdjustField = "fob_cost" | "zone5_shipping" | "list_price";
type BulkAdjustOperation = "add" | "subtract";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const itemIds = Array.isArray(body?.itemIds) ? body.itemIds.filter((id: unknown) => typeof id === "string") : [];
    const field: BulkAdjustField = body?.field;
    const operation: BulkAdjustOperation = body?.operation;
    const amount = Number(body?.amount);

    if (itemIds.length === 0) {
      return NextResponse.json({ success: false, error: "No items selected" }, { status: 400 });
    }

    if (!["fob_cost", "zone5_shipping", "list_price"].includes(field)) {
      return NextResponse.json({ success: false, error: "Invalid field" }, { status: 400 });
    }

    if (!["add", "subtract"].includes(operation)) {
      return NextResponse.json({ success: false, error: "Invalid operation" }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: "Amount must be greater than 0" }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();

    const { data: rows, error: fetchError } = await supabase
      .from("price_list_items")
      .select(`id, ${field}`)
      .in("id", itemIds)
      .eq("is_active", true);

    if (fetchError) throw fetchError;

    const updates = (rows || []).map((row: any) => {
      const current = Number(row?.[field] || 0);
      const nextValue = operation === "add" ? current + amount : Math.max(0, current - amount);
      return { id: row.id, value: Number(nextValue.toFixed(2)) };
    });

    let updatedCount = 0;
    for (const update of updates) {
      const { error } = await supabase
        .from("price_list_items")
        .update({ [field]: update.value })
        .eq("id", update.id);

      if (error) throw error;
      updatedCount += 1;
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      field,
      operation,
      amount,
    });
  } catch (error: any) {
    console.error("Bulk adjust error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Bulk adjust failed" },
      { status: 500 }
    );
  }
}
