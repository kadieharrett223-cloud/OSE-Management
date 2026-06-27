import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

const ALLOWED_ORDER_STATUSES = new Set([
  "on_order",
  "urgent",
  "in_warehouse",
  "ready_pickup",
  "delivered",
  "other",
]);

function normalizeOrderStatus(value: unknown) {
  const status = String(value || "").trim().toLowerCase();
  return ALLOWED_ORDER_STATUSES.has(status) ? status : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { orderId: string } }) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const orderStatus = normalizeOrderStatus(body?.orderStatus);

  if (!orderStatus) {
    return NextResponse.json({ error: "Valid orderStatus is required" }, { status: 400 });
  }

  try {
    const supabase = getServerSupabaseClient();

    const { data: updated, error: updateError } = await supabase
      .from("inventory_order_entries")
      .update({
        order_status: orderStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.orderId)
      .select("id, created_at, updated_at, customer_name, invoice_number, order_status")
      .maybeSingle();

    if (updateError) throw updateError;

    if (!updated) {
      return NextResponse.json({ error: "Order entry not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: (updated as any).id,
        createdAt: (updated as any).created_at,
        updatedAt: (updated as any).updated_at,
        customerName: (updated as any).customer_name,
        invoiceNumber: (updated as any).invoice_number,
        orderStatus: (updated as any).order_status,
      },
    });
  } catch (error) {
    console.error("inventory order patch error", error);
    return NextResponse.json({ error: "Failed to update order entry" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { orderId: string } }) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServerSupabaseClient();

    const { data: existing, error: existingError } = await supabase
      .from("inventory_order_entries")
      .select("id")
      .eq("id", params.orderId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
      return NextResponse.json({ error: "Order entry not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("inventory_order_entries")
      .delete()
      .eq("id", params.orderId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("inventory order delete error", error);
    return NextResponse.json({ error: "Failed to delete order entry" }, { status: 500 });
  }
}
