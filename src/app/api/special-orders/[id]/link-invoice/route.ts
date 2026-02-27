import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { authorizedQboFetch } from "@/lib/qbo";
import { getServerSupabaseClient } from "@/lib/supabase";

function escapeQboString(value: string) {
  return value.replace(/'/g, "''");
}

function mapInvoiceSummary(invoice: any) {
  const total = Number(invoice?.TotalAmt) || 0;
  const balance = Number(invoice?.Balance) || 0;

  return {
    id: invoice?.Id || null,
    docNumber: invoice?.DocNumber || null,
    txnDate: invoice?.TxnDate || null,
    dueDate: invoice?.DueDate || null,
    customer: invoice?.CustomerRef?.name || null,
    total,
    balance,
    paid: balance <= 0,
    lineItems: (invoice?.Line || [])
      .filter((line: any) => !!line?.SalesItemLineDetail || !!line?.Description)
      .map((line: any) => ({
        description: line.Description || line?.SalesItemLineDetail?.ItemRef?.name || "—",
        quantity: Number(line?.SalesItemLineDetail?.Qty) || 0,
        unitPrice: Number(line?.SalesItemLineDetail?.UnitPrice) || 0,
        amount: Number(line?.Amount) || 0,
      })),
  };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const invoiceNumber = (body?.invoiceNumber || "").toString().trim();

    if (!invoiceNumber) {
      return NextResponse.json({ error: "Invoice number is required" }, { status: 400 });
    }

    const query = `SELECT * FROM Invoice WHERE DocNumber = '${escapeQboString(invoiceNumber)}' MAXRESULTS 1`;
    const qboData = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(query)}&minorversion=65`);

    const invoice = qboData?.QueryResponse?.Invoice?.[0];
    if (!invoice?.Id) {
      return NextResponse.json({ error: "Invoice not found in QuickBooks" }, { status: 404 });
    }

    const supabase = getServerSupabaseClient();
    const { error } = await supabase
      .from("special_orders")
      .update({
        qbo_invoice_id: invoice.Id,
        qbo_invoice_number: invoice.DocNumber || invoiceNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    if (error) throw error;

    return NextResponse.json({ ok: true, invoice: mapInvoiceSummary(invoice) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to link invoice" }, { status: 500 });
  }
}