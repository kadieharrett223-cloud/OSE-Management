import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getServerSupabaseClient();

    const { data, error } = await supabase
      .from("invoices")
      .select("commission_total")
      .eq("payment_status", "paid");

    if (error) throw error;

    const commissionTotal = (data || []).reduce((sum, row) => sum + (row.commission_total || 0), 0);

    return NextResponse.json({
      commissionTotal,
      invoiceCount: data?.length || 0,
    });
  } catch (error: any) {
    console.error("Error fetching commission totals:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
