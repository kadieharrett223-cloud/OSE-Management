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

export async function GET(req: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();
    const params = req.nextUrl.searchParams;
    const startDate = params.get("startDate");
    const endDate = params.get("endDate");

    let query = supabase
      .from("purchase_order_payment_schedules")
      .select("id, po_id, po_number, vendor_name, event_date, amount, notes, created_at")
      .eq("is_active", true)
      .order("event_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (startDate) query = query.gte("event_date", startDate);
    if (endDate) query = query.lte("event_date", endDate);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, schedules: (data || []).map(mapSchedule) });
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
      { error: error?.message || "Failed to load payment schedules" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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
      .insert({
        po_id: poId,
        po_number: poNumber,
        vendor_name: vendorName,
        event_date: date,
        amount: Number.isFinite(amountValue) ? amountValue : 0,
        notes,
        created_by: session.user?.email || session.user?.id || "Unknown",
      })
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
      { error: error?.message || "Failed to create payment schedule" },
      { status: 500 }
    );
  }
}
