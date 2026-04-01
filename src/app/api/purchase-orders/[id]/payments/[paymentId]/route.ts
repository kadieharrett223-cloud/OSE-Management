import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

const normalizeCurrency = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

async function syncPurchaseOrderPaymentStatus(supabase: any, purchaseOrderId: string) {
  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select(`
      id,
      total_amount,
      payments:purchase_order_payments(amount)
    `)
    .eq("id", purchaseOrderId)
    .single();

  if (error) throw error;

  const paidAmount = (po?.payments || []).reduce(
    (sum: number, payment: any) => sum + normalizeCurrency(payment?.amount),
    0
  );
  const totalAmount = normalizeCurrency(po?.total_amount);

  let nextStatus = "TO_BE_PAID";
  if (paidAmount > 0 && (totalAmount <= 0 || paidAmount >= totalAmount - 0.01)) {
    nextStatus = "PAID";
  } else if (paidAmount > 0) {
    nextStatus = "DEPOSIT_DOWN";
  }

  const { error: updateError } = await supabase
    .from("purchase_orders")
    .update({ status: nextStatus })
    .eq("id", purchaseOrderId);

  if (updateError) throw updateError;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; paymentId: string } }) {
  const session: any = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { payment_date, amount, payment_method, reference_number, notes } = body;

  // Validate inputs
  const amountNum = Number(amount);
  if (Number.isNaN(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("purchase_order_payments")
      .update({
        payment_date: payment_date || new Date().toISOString().split("T")[0],
        amount: amountNum,
        payment_method,
        reference_number,
        notes,
      })
      .eq("id", params.paymentId)
      .eq("purchase_order_id", params.id)
      .select()
      .single();

    if (error) throw error;
    await syncPurchaseOrderPaymentStatus(supabase, params.id);
    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error("Update payment error:", error);
    return NextResponse.json({ error: error.message || "Failed to update payment" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; paymentId: string } }) {
  const session: any = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServerSupabaseClient();

  try {
    const { error } = await supabase
      .from("purchase_order_payments")
      .delete()
      .eq("id", params.paymentId)
      .eq("purchase_order_id", params.id);

    if (error) throw error;
    await syncPurchaseOrderPaymentStatus(supabase, params.id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Delete payment error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete payment" }, { status: 500 });
  }
}
