import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabaseClient();
    
    const { data, error } = await supabase
      .from('wholesalers')
      .select('*')
      .order('company_name', { ascending: true });
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching wholesalers:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getServerSupabaseClient();
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('wholesalers')
      .insert([body])
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error creating wholesaler:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
