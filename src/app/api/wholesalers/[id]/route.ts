import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getServerSupabaseClient();
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('wholesalers')
      .update(body)
      .eq('id', params.id)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error updating wholesaler:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getServerSupabaseClient();
    
    const { error } = await supabase
      .from('wholesalers')
      .delete()
      .eq('id', params.id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting wholesaler:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
