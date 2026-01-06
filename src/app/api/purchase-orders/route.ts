import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  // In development, allow GET without a session to avoid blocking UI while auth is configured
  if (!session && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServerSupabaseClient();
  const params = req.nextUrl.searchParams;
  const status = params.get("status");

  try {
    let query = supabase
      .from("purchase_orders")
      .select(`
        *,
        lines:purchase_order_lines(*),
        payments:purchase_order_payments(*)
      `)
      .order("order_date", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error("Fetch purchase orders error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    po_number,
    vendor_name,
    vendor_address,
    vendor_city_state_zip,
    vendor_contact_name,
    vendor_email,
    vendor_phone,
    ship_to_name,
    ship_to_address,
    ship_to_city_state_zip,
    representative,
    authorized_by,
    destination,
    terms,
    payment_method,
    order_date,
    expected_delivery,
    status,
    notes,
    lines,
  } = body;

  // Normalize dates to avoid empty-string failures when the client sends ""
  const orderDate = order_date || new Date().toISOString().split("T")[0];
  const expectedDelivery = expected_delivery || null;

  if (!po_number || !vendor_name || !orderDate || !Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json(
      { error: "po_number, vendor_name, order_date, and lines are required" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabaseClient();

  try {
    // Calculate total
    const total_amount = lines.reduce((sum: number, line: any) => {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unit_price) || 0;
      return sum + qty * price;
    }, 0);

    // Create PO
    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .insert({
        po_number,
        vendor_name,
        vendor_address,
        vendor_city_state_zip,
        vendor_contact_name,
        vendor_email,
        vendor_phone,
        ship_to_name,
        ship_to_address,
        ship_to_city_state_zip,
        representative,
        authorized_by,
        destination,
        terms,
        payment_method,
        order_date: orderDate,
        expected_delivery: expectedDelivery,
        total_amount,
        status: status || "DRAFT",
        notes,
        created_by_user_id: session.user?.id || null,
      })
      .select()
      .single();

    if (poError) throw poError;

    // Create lines
    const linesData = lines.map((line: any, index: number) => {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unit_price) || 0;
      return {
        purchase_order_id: po.id,
        line_number: index + 1,
        sku: line.sku || "",
        description: line.description || "",
        quantity: qty,
        unit_price: price,
        line_total: qty * price,
        weight_lbs: line.weight_lbs ? Number(line.weight_lbs) : null,
      };
    });

    const { error: linesError } = await supabase.from("purchase_order_lines").insert(linesData);
    if (linesError) throw linesError;

    return NextResponse.json({ ok: true, data: po }, { status: 201 });
  } catch (error: any) {
    console.error("Create purchase order error:", error);
    return NextResponse.json({ error: error.message || "Failed to create" }, { status: 500 });
  }
}
