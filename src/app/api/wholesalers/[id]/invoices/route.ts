import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getServerSupabaseClient();
    
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('wholesaler_id', id)
      .eq('payment_status', 'paid')
      .order('txn_date', { ascending: false });
    
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
