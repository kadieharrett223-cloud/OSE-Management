import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServerSupabaseClient();
  try {
    const { data, error } = await supabase
      .from("suppliers")
      .select(
        `id, name, address, city_state_zip, contact_name, representative, email, phone`
      )
      .eq("id", params.id)
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Not found" }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServerSupabaseClient();
  const body = await req.json();
  try {
    const { data, error } = await supabase
      .from("suppliers")
      .update({
        name: body.name,
        address: body.address,
        city_state_zip: body.city_state_zip,
        contact_name: body.contact_name,
        representative: body.representative,
        email: body.email,
        phone: body.phone,
      })
      .eq("id", params.id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServerSupabaseClient();
  try {
    const { error } = await supabase
      .from("suppliers")
      .delete()
      .eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete" }, { status: 500 });
  }
}
