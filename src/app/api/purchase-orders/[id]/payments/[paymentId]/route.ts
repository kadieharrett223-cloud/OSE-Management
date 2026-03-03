import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

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
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Delete payment error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete payment" }, { status: 500 });
  }
}
