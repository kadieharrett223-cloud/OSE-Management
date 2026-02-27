import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function GET() {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from("special_orders")
      .select("id, created_at, updated_at, order_name, customer_name, special_colors, factory_notes, status, expected_delivery, qbo_invoice_id, qbo_invoice_number")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ ok: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch special orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const orderName = (body?.order_name || "").toString().trim();

    if (!orderName) {
      return NextResponse.json({ error: "Order name is required" }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from("special_orders")
      .insert({
        order_name: orderName,
        customer_name: body?.customer_name || null,
        special_colors: body?.special_colors || null,
        factory_notes: body?.factory_notes || null,
        status: body?.status || "SENT_TO_FACTORY",
        expected_delivery: body?.expected_delivery || null,
        created_by: session.user.email || session.user.id || "Unknown",
      })
      .select("id, created_at, updated_at, order_name, customer_name, special_colors, factory_notes, status, expected_delivery, qbo_invoice_id, qbo_invoice_number")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create special order" }, { status: 500 });
  }
}