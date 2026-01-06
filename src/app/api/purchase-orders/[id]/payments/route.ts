import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { payment_date, amount, payment_method, reference_number, notes } = body;

  // Normalize fields
  const paymentDate: string = payment_date || new Date().toISOString().split("T")[0];
  const amountNum = Number(amount);

  if (!paymentDate) {
    return NextResponse.json({ error: "payment_date is required" }, { status: 400 });
  }
  if (Number.isNaN(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("purchase_order_payments")
      .insert({
        purchase_order_id: params.id,
        payment_date: paymentDate,
        amount: amountNum,
        payment_method,
        reference_number,
        notes,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error: any) {
    console.error("Create payment error:", error);
    return NextResponse.json({ error: error.message || "Failed to create payment" }, { status: 500 });
  }
}
