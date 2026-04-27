import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

function isMissingPaymentSchedulesTableError(error: any): boolean {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("purchase_order_payment_schedules") &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
}

function mapSchedule(row: any) {
  return {
    id: row.id,
    poId: row.po_id,
    poNumber: row.po_number,
    vendorName: row.vendor_name,
    date: row.event_date,
    amount: Number(row.amount || 0),
    notes: row.notes || "",
    createdAt: row.created_at,
  };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const poId = (body?.poId || "").toString().trim();
    const poNumber = (body?.poNumber || "").toString().trim();
    const vendorName = (body?.vendorName || "").toString().trim();
    const date = (body?.date || "").toString().trim();
    const amountValue = Number(body?.amount || 0);
    const notes = (body?.notes || "").toString();

    if (!poId || !poNumber || !vendorName || !date) {
      return NextResponse.json(
        { error: "poId, poNumber, vendorName, and date are required" },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from("purchase_order_payment_schedules")
      .update({
        po_id: poId,
        po_number: poNumber,
        vendor_name: vendorName,
        event_date: date,
        amount: Number.isFinite(amountValue) ? amountValue : 0,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("is_active", true)
      .select("id, po_id, po_number, vendor_name, event_date, amount, notes, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, schedule: mapSchedule(data) });
  } catch (error: any) {
    if (isMissingPaymentSchedulesTableError(error)) {
      return NextResponse.json(
        {
          error:
            "Payment schedule table is missing in Supabase. Run the latest migrations (including 069_ensure_purchase_order_payment_schedules_exists.sql).",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: error?.message || "Failed to update payment schedule" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();
    const { error } = await supabase
      .from("purchase_order_payment_schedules")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("is_active", true);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (isMissingPaymentSchedulesTableError(error)) {
      return NextResponse.json(
        {
          error:
            "Payment schedule table is missing in Supabase. Run the latest migrations (including 069_ensure_purchase_order_payment_schedules_exists.sql).",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: error?.message || "Failed to delete payment schedule" },
      { status: 500 }
    );
  }
}
