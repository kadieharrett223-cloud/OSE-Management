import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { authorizedQboFetch } from "@/lib/qbo";
import { getServerSupabaseClient } from "@/lib/supabase";

function mapInvoiceSummary(invoice: any) {
  if (!invoice) return null;
  const total = Number(invoice.TotalAmt) || 0;
  const balance = Number(invoice.Balance) || 0;
  const paid = balance <= 0;

  const lineItems = (invoice.Line || [])
    .filter((line: any) => !!line?.SalesItemLineDetail || !!line?.Description)
    .map((line: any) => ({
      description: line.Description || line?.SalesItemLineDetail?.ItemRef?.name || "—",
      quantity: Number(line?.SalesItemLineDetail?.Qty) || 0,
      unitPrice: Number(line?.SalesItemLineDetail?.UnitPrice) || 0,
      amount: Number(line?.Amount) || 0,
    }));

  return {
    id: invoice.Id,
    docNumber: invoice.DocNumber,
    txnDate: invoice.TxnDate,
    dueDate: invoice.DueDate,
    total,
    balance,
    paid,
    customer: invoice?.CustomerRef?.name || null,
    lineItems,
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();
    const { data: order, error } = await supabase
      .from("special_orders")
      .select("id, created_at, updated_at, order_name, customer_name, special_colors, factory_notes, internal_notes, internal_updates, status, expected_delivery, qbo_invoice_id, qbo_invoice_number")
      .eq("id", params.id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Special order not found" }, { status: 404 });
    }

    const { data: docs } = await supabase
      .from("special_order_documents")
      .select("id, created_at, file_name, file_size, file_mime_type, file_path, upload_notes")
      .eq("special_order_id", params.id)
      .order("created_at", { ascending: false });

    const documents = await Promise.all(
      (docs || []).map(async (doc: any) => {
        const { data: signed, error: signError } = await supabase.storage
          .from("special-order-documents")
          .createSignedUrl(doc.file_path, 24 * 60 * 60);

        return {
          ...doc,
          signedUrl: signError ? null : signed?.signedUrl,
        };
      })
    );

    let invoiceSummary: any = null;
    if (order.qbo_invoice_id) {
      try {
        const invoiceResponse = await authorizedQboFetch<any>(`/invoice/${order.qbo_invoice_id}?minorversion=65`);
        invoiceSummary = mapInvoiceSummary(invoiceResponse?.Invoice || null);
      } catch {
        invoiceSummary = null;
      }
    }

    return NextResponse.json({ ok: true, data: { ...order, documents, invoiceSummary } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch special order" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from("special_orders")
      .update({
        status: body?.status,
        expected_delivery: body?.expected_delivery || null,
        internal_notes: body?.internal_notes || null,
        internal_updates: body?.internal_updates || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select("id, created_at, updated_at, order_name, customer_name, special_colors, factory_notes, internal_notes, internal_updates, status, expected_delivery, qbo_invoice_id, qbo_invoice_number")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update special order" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();
    const { error } = await supabase.from("special_orders").delete().eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete special order" }, { status: 500 });
  }
}