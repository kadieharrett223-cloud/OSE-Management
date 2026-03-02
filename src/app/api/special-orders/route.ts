import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { authorizedQboFetch } from "@/lib/qbo";
import { getServerSupabaseClient } from "@/lib/supabase";

function escapeQboString(value: string) {
  return value.replace(/'/g, "''");
}

function getSalesRep(invoice: any): string | null {
  if (!invoice) return null;

  if (Array.isArray(invoice.CustomField)) {
    const repField = invoice.CustomField.find(
      (f: any) => f?.Name === "Sales Rep" || f?.Name === "SalesRep" || f?.Name === "Rep"
    );
    if (repField?.StringValue) return String(repField.StringValue).trim();
  }

  const memo = invoice?.CustomerMemo?.value;
  if (memo) {
    const repMatch = String(memo).match(/Rep:\s*([A-Za-z\s/]+)/i);
    if (repMatch?.[1]) return repMatch[1].trim();
  }

  return null;
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
    salesRep: getSalesRep(invoice),
  };
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
    const invoiceId = (body?.invoiceId || "").toString().trim();

    if (!invoiceNumber) {
      return NextResponse.json(
        { error: "Invoice number is required" },
        { status: 400 }
      );
    }

    // Fetch invoice(s) from QBO to get customer name and handle duplicate doc numbers.
    let qboInvoice: any = null;
    let qboInvoiceId: string | null = null;
    let customerName: string | null = null;

    try {
      const query = `SELECT * FROM Invoice WHERE DocNumber = '${escapeQboString(invoiceNumber)}' MAXRESULTS 50`;
      const qboData = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(query)}&minorversion=65`);
      const matches = (qboData?.QueryResponse?.Invoice || []) as any[];

      if (matches.length > 1 && !invoiceId) {
        return NextResponse.json(
          {
            error: "Multiple invoices found for this invoice number. Please select one.",
            requiresSelection: true,
            candidates: matches.map(mapInvoiceCandidate),
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
