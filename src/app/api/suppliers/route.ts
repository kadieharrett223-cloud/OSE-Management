import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const supabase = getServerSupabaseClient();
  try {
    const { data, error } = await supabase
      .from("suppliers")
      .select(
        `id, name, address, city_state_zip, contact_name, representative, email, phone`
      )
      .order("name", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch suppliers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = getServerSupabaseClient();
  const body = await req.json();
  const {
    name,
    address,
    city_state_zip,
    contact_name,
    representative,
    email,
    phone,
  } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        name,
        address,
        city_state_zip,
        contact_name,
        representative,
        email,
        phone,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create supplier" }, { status: 500 });
  }
}
