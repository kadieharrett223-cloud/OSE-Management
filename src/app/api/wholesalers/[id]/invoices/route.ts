import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";
import { canonicalizeRep } from "@/lib/repAliases";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const supabase = getServerSupabaseClient();
    
    // Some invoices store the wholesaler as the sales rep instead of wholesaler_id; include those rep_ids too
    const { data: wholesaler, error: wholesalerError } = await supabase
      .from('wholesalers')
      .select('company_name')
      .eq('id', id)
      .single();
    if (wholesalerError) throw wholesalerError;

    const targetCanonical = canonicalizeRep(wholesaler?.company_name);

    const { data: reps, error: repsError } = await supabase
      .from('reps')
      .select('id, rep_name');
    if (repsError) throw repsError;
    const wholesalerRepIds = (reps || [])
      .filter((r) => canonicalizeRep(r.rep_name) === targetCanonical)
      .map((r) => r.id);
    
    const orFilters = [`wholesaler_id.eq.${id}`];
    if (wholesalerRepIds.length > 0) {
      orFilters.push(`rep_id.in.(${wholesalerRepIds.join(',')})`);
    }
    
    const query = supabase
      .from('invoices')
      .select('*')
      .or(orFilters.join(','));

    if (startDate) query.gte('txn_date', startDate);
    if (endDate) query.lte('txn_date', endDate);

    const { data, error } = await query.order('txn_date', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching wholesaler invoices:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
