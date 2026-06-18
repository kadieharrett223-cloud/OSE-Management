import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { authorizedQboFetch } from "@/lib/qbo";
import { getServerSupabaseClient } from "@/lib/supabase";

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

function formatNoteTimestamp(date: Date) {
  const iso = date.toISOString();
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

function mapInvoiceSummary(invoice: any) {
  if (!invoice) return null;
  const total = Number(invoice.TotalAmt) || 0;
  const balance = Number(invoice.Balance) || 0;
  const paid = balance <= 0;

  const lineItems = (invoice.Line || [])
    .filter((line: any) => !!line?.SalesItemLineDetail || !!line?.Description)
    .map((line: any) => ({
      description: line.Description || line?.SalesItemLineDetail?.ItemRef?.name || "-",
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
    salesRep: getSalesRep(invoice),
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
    const { data: row, error } = await supabase
      .from("replacement_parts")
      .select(
        "id, created_at, updated_at, part_name, customer_name, requested_by, request_notes, internal_notes, status, tracking_carrier, tracking_number, tracking_url, tracking_status, shipped_at, delivered_at, qbo_invoice_id, qbo_invoice_number"
      )
      .eq("id", params.id)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "Replacement part record not found" }, { status: 404 });
    }

    let invoiceSummary: any = null;
    if (row.qbo_invoice_id) {
      try {
        const invoiceResponse = await authorizedQboFetch<any>(`/invoice/${row.qbo_invoice_id}?minorversion=65`);
        invoiceSummary = mapInvoiceSummary(invoiceResponse?.Invoice || null);
      } catch {
        invoiceSummary = null;
      }
    }

    return NextResponse.json({ ok: true, data: { ...row, invoiceSummary } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch replacement part" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const noteEntry = String(body?.note_entry || "").trim();

    const supabase = getServerSupabaseClient();
    const { data: existing, error: existingError } = await supabase
      .from("replacement_parts")
      .select("internal_notes")
      .eq("id", params.id)
      .single();

    if (existingError) throw existingError;

    const existingNotes = existing?.internal_notes ? String(existing.internal_notes) : "";
    const stampedNote = noteEntry ? `[${formatNoteTimestamp(new Date())}] ${noteEntry}` : "";
    const nextNotes = stampedNote ? (existingNotes ? `${stampedNote}\n${existingNotes}` : stampedNote) : existingNotes;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      internal_notes: nextNotes || null,
    };

    if (Object.prototype.hasOwnProperty.call(body, "part_name")) {
      const partName = String(body?.part_name || "").trim();
      if (!partName) {
        return NextResponse.json({ error: "Part name is required" }, { status: 400 });
      }
      updatePayload.part_name = partName;
    }

    if (Object.prototype.hasOwnProperty.call(body, "request_notes")) {
      const requestNotes = String(body?.request_notes || "").trim();
      updatePayload.request_notes = requestNotes || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "requested_by")) {
      const requestedBy = String(body?.requested_by || "").trim();
      updatePayload.requested_by = requestedBy || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "tracking_carrier")) {
      const trackingCarrier = String(body?.tracking_carrier || "").trim();
      updatePayload.tracking_carrier = trackingCarrier || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "tracking_number")) {
      const trackingNumber = String(body?.tracking_number || "").trim();
      updatePayload.tracking_number = trackingNumber || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "tracking_url")) {
      const trackingUrl = String(body?.tracking_url || "").trim();
      updatePayload.tracking_url = trackingUrl || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "tracking_status")) {
      const trackingStatus = String(body?.tracking_status || "").trim();
      updatePayload.tracking_status = trackingStatus || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "shipped_at")) {
      const shippedAt = String(body?.shipped_at || "").trim();
      updatePayload.shipped_at = shippedAt || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "delivered_at")) {
      const deliveredAt = String(body?.delivered_at || "").trim();
      updatePayload.delivered_at = deliveredAt || null;
    }

    if (body?.status) {
      updatePayload.status = body.status;
    }

    const { data, error } = await supabase
      .from("replacement_parts")
      .update(updatePayload)
      .eq("id", params.id)
      .select(
        "id, created_at, updated_at, part_name, customer_name, requested_by, request_notes, internal_notes, status, tracking_carrier, tracking_number, tracking_url, tracking_status, shipped_at, delivered_at, qbo_invoice_id, qbo_invoice_number"
      )
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update replacement part" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();
    const { error } = await supabase.from("replacement_parts").delete().eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete replacement part" }, { status: 500 });
  }
}
