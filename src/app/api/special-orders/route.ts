import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { authorizedQboFetch } from "@/lib/qbo";
import { getServerSupabaseClient } from "@/lib/supabase";

function escapeQboString(value: string) {
  return value.replace(/'/g, "''");
}

export async function GET() {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from("special_orders")
      .select("id, created_at, updated_at, order_name, customer_name, special_colors, factory_notes, internal_notes, internal_updates, status, expected_delivery, qbo_invoice_id, qbo_invoice_number")
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
    const invoiceNumber = (body?.invoiceNumber || "").toString().trim();

    if (!invoiceNumber) {
      return NextResponse.json(
        { error: "Invoice number is required" },
        { status: 400 }
      );
    }

    // Fetch invoice from QBO to get customer name and other details
    let qboInvoice: any = null;
    let qboInvoiceId: string | null = null;
    let customerName: string | null = null;

    try {
      const query = `SELECT * FROM Invoice WHERE DocNumber = '${escapeQboString(invoiceNumber)}' MAXRESULTS 1`;
      const qboData = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(query)}&minorversion=65`);
      qboInvoice = qboData?.QueryResponse?.Invoice?.[0];
      if (qboInvoice?.Id) {
        qboInvoiceId = qboInvoice.Id;
        customerName = qboInvoice?.CustomerRef?.name || null;
      }
    } catch (err) {
      // If QBO fetch fails, continue without pre-populated data
      console.error("Failed to fetch QBO invoice:", err);
    }

    const supabase = getServerSupabaseClient();
    const orderName = customerName || invoiceNumber;

    const { data, error } = await supabase
      .from("special_orders")
      .insert({
        order_name: orderName,
        customer_name: customerName,
        qbo_invoice_id: qboInvoiceId,
        qbo_invoice_number: invoiceNumber,
        status: "SENT_TO_FACTORY",
        created_by: session.user.email || session.user.id || "Unknown",
      })
      .select(
        "id, created_at, updated_at, order_name, customer_name, special_colors, factory_notes, internal_notes, internal_updates, status, expected_delivery, qbo_invoice_id, qbo_invoice_number"
      )
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create special order" },
      { status: 500 }
    );
  }
}