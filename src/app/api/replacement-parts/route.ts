import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { authorizedQboFetch } from "@/lib/qbo";
import { getServerSupabaseClient } from "@/lib/supabase";

const SELECT_WITH_PRIORITY_NOTE =
  "id, created_at, updated_at, part_name, customer_name, ebay_order_number, priority_note, request_notes, internal_notes, status, fitting, emailed_to_customer, emailed_at, tracking_number, tracking_url, tracking_status, shipped_at, delivered_at, qbo_invoice_id, qbo_invoice_number";
const SELECT_BASE =
  "id, created_at, updated_at, part_name, customer_name, ebay_order_number, request_notes, internal_notes, status, fitting, emailed_to_customer, emailed_at, tracking_number, tracking_url, tracking_status, shipped_at, delivered_at, qbo_invoice_id, qbo_invoice_number";

function escapeQboString(value: string) {
  return value.replace(/'/g, "''");
}

function mapInvoiceCandidate(invoice: any) {
  const total = Number(invoice?.TotalAmt) || 0;
  const balance = Number(invoice?.Balance) || 0;
  return {
    id: String(invoice?.Id || ""),
    docNumber: String(invoice?.DocNumber || ""),
    txnDate: invoice?.TxnDate || null,
    customer: invoice?.CustomerRef?.name || null,
    total,
    balance,
    paid: balance <= 0,
  };
}

export async function GET() {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();
    let { data, error } = await supabase
      .from("replacement_parts")
      .select(SELECT_WITH_PRIORITY_NOTE)
      .order("created_at", { ascending: false });

    if (error?.message?.toLowerCase().includes("priority_note")) {
      const fallback = await supabase
        .from("replacement_parts")
        .select(SELECT_BASE)
        .order("created_at", { ascending: false });
      error = fallback.error;
      data = (fallback.data || []).map((row) => ({ ...row, priority_note: null }));
    }

    if (error) throw error;
    return NextResponse.json({ ok: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch replacement parts" }, { status: 500 });
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
    const invoiceId = (body?.invoiceId || "").toString().trim();
    const ebayOrderNumber = (body?.ebayOrderNumber || "").toString().trim();
    const allowDuplicateCustomer = Boolean(body?.allowDuplicateCustomer);

    if (!invoiceNumber) {
      return NextResponse.json({ error: "Invoice number is required" }, { status: 400 });
    }

    let qboInvoice: any = null;
    let qboInvoiceId: string | null = null;
    let customerName: string | null = null;

    try {
      const query = `SELECT * FROM Invoice WHERE DocNumber = '${escapeQboString(invoiceNumber)}' MAXRESULTS 50`;
      const qboData = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(query)}&minorversion=65`);
      const rawInvoices = qboData?.QueryResponse?.Invoice;
      const matches = Array.isArray(rawInvoices) ? rawInvoices : rawInvoices ? [rawInvoices] : [];

      if (matches.length > 1 && !invoiceId) {
        const candidates = matches.map(mapInvoiceCandidate).filter((c) => c.id);
        return NextResponse.json(
          {
            error: "Multiple invoices found for this invoice number. Please select one.",
            requiresSelection: true,
            candidates,
            duplicateCount: candidates.length,
          },
          { status: 409 }
        );
      }

      if (invoiceId) {
        qboInvoice = matches.find((inv: any) => String(inv?.Id) === invoiceId) || null;
        if (!qboInvoice) {
          return NextResponse.json({ error: "Selected invoice was not found. Please try again." }, { status: 400 });
        }
      } else {
        qboInvoice = matches[0] || null;
      }

      if (qboInvoice?.Id) {
        qboInvoiceId = String(qboInvoice.Id);
        customerName = qboInvoice?.CustomerRef?.name || null;
      }
    } catch (err) {
      console.error("Failed to fetch QBO invoice:", err);
    }

    const supabase = getServerSupabaseClient();
    const partName = customerName ? `${customerName} replacement` : `Replacement for Invoice ${invoiceNumber}`;

    if (customerName && !allowDuplicateCustomer) {
      const { data: existingRows, error: existingRowsError } = await supabase
        .from("replacement_parts")
        .select("id, qbo_invoice_number, status, created_at")
        .ilike("customer_name", customerName)
        .order("created_at", { ascending: false })
        .limit(5);

      if (existingRowsError) throw existingRowsError;

      if ((existingRows || []).length > 0) {
        return NextResponse.json(
          {
            error: `A replacement part already exists for customer \"${customerName}\". Continue anyway?`,
            requiresCustomerConfirmation: true,
            duplicateCustomerName: customerName,
            existingRecords: existingRows,
          },
          { status: 409 }
        );
      }
    }

    let { data, error } = await supabase
      .from("replacement_parts")
      .insert({
        part_name: partName,
        customer_name: customerName,
        ebay_order_number: ebayOrderNumber || null,
        status: "REQUESTED",
        fitting: false,
        emailed_to_customer: false,
        emailed_at: null,
        qbo_invoice_id: qboInvoiceId,
        qbo_invoice_number: invoiceNumber,
        created_by: session.user.email || session.user.id || "Unknown",
      })
      .select(SELECT_WITH_PRIORITY_NOTE)
      .single();

    if (error?.message?.toLowerCase().includes("priority_note")) {
      const fallback = await supabase
        .from("replacement_parts")
        .insert({
          part_name: partName,
          customer_name: customerName,
          ebay_order_number: ebayOrderNumber || null,
          status: "REQUESTED",
          fitting: false,
          emailed_to_customer: false,
          emailed_at: null,
          qbo_invoice_id: qboInvoiceId,
          qbo_invoice_number: invoiceNumber,
          created_by: session.user.email || session.user.id || "Unknown",
        })
        .select(SELECT_BASE)
        .single();

      error = fallback.error;
      data = fallback.data ? { ...fallback.data, priority_note: null } : null;
    }

    if (error) throw error;
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create replacement part" }, { status: 500 });
  }
}
