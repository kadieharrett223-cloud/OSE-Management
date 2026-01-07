import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";
import { isWholesalerName } from "@/lib/repAliases";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const supabase = getServerSupabaseClient();

    // Identify rep_ids that belong to wholesalers (for invoices that store the rep instead of wholesaler_id)
    const { data: reps, error: repsError } = await supabase.from("reps").select("id, rep_name");
    if (repsError) throw repsError;
    const wholesalerRepIds = (reps || [])
      .filter((r) => isWholesalerName(r.rep_name))
      .map((r) => r.id);

    const baseQuery = supabase.from("invoices").select("commission_total");

    const orFilters = ["wholesaler_id.not.is.null"];
    if (wholesalerRepIds.length > 0) {
      orFilters.push(`rep_id.in.(${wholesalerRepIds.join(",")})`);
    }

    const query = baseQuery.or(orFilters.join(","));

    if (startDate) query.gte("txn_date", startDate);
    if (endDate) query.lte("txn_date", endDate);

    const { data, error } = await query;

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
