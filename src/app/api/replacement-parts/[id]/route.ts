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

function getShippingAddress(invoice: any): string | null {
  const shipAddr = invoice?.ShipAddr;
  if (!shipAddr || typeof shipAddr !== "object") return null;

  const lines = [
    shipAddr.Line1,
    shipAddr.Line2,
    shipAddr.Line3,
    shipAddr.Line4,
    shipAddr.Line5,
  ]
    .map((line: any) => String(line || "").trim())
    .filter(Boolean);

  const city = String(shipAddr.City || "").trim();
  const state = String(shipAddr.CountrySubDivisionCode || "").trim();
  const postalCode = String(shipAddr.PostalCode || "").trim();
  const country = String(shipAddr.Country || "").trim();

  const cityStatePostal = [city, state, postalCode].filter(Boolean).join(", ");
  if (cityStatePostal) lines.push(cityStatePostal);
  if (country) lines.push(country);

  return lines.length > 0 ? lines.join("\n") : null;
}

function buildTrackingUrl(trackingNumberInput: string | null | undefined): string | null {
  const trackingNumber = String(trackingNumberInput || "").trim();
  if (!trackingNumber) return null;

  return `https://parcelsapp.com/en/tracking/${encodeURIComponent(trackingNumber)}`;
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
    shippingAddress: getShippingAddress(invoice),
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
        "id, created_at, updated_at, part_name, customer_name, ebay_order_number, request_notes, internal_notes, status, emailed_to_customer, emailed_at, tracking_number, tracking_url, tracking_status, shipped_at, delivered_at, qbo_invoice_id, qbo_invoice_number"
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
    const refreshTracking = Boolean(body?.refresh_tracking);

    const supabase = getServerSupabaseClient();
    const { data: existing, error: existingError } = await supabase
      .from("replacement_parts")
      .select("internal_notes, status, tracking_number, shipped_at, delivered_at, emailed_to_customer")
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

    if (Object.prototype.hasOwnProperty.call(body, "ebay_order_number")) {
      const ebayOrderNumber = String(body?.ebay_order_number || "").trim();
      updatePayload.ebay_order_number = ebayOrderNumber || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "emailed_to_customer")) {
      const emailedToCustomer = Boolean(body?.emailed_to_customer);
      const wasEmailed = Boolean(existing?.emailed_to_customer);
      updatePayload.emailed_to_customer = emailedToCustomer;
      if (emailedToCustomer && !wasEmailed) {
        updatePayload.emailed_at = new Date().toISOString();
      } else if (!emailedToCustomer) {
        updatePayload.emailed_at = null;
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "tracking_number")) {
      const trackingNumber = String(body?.tracking_number || "").trim();
      updatePayload.tracking_number = trackingNumber || null;
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

    const hasTrackingNumber = Object.prototype.hasOwnProperty.call(updatePayload, "tracking_number");
    const trackingFieldsChanged = hasTrackingNumber;

    const nextTrackingNumber = hasTrackingNumber
      ? (updatePayload.tracking_number as string | null)
      : (existing?.tracking_number as string | null);

    if (trackingFieldsChanged || refreshTracking) {
      updatePayload.tracking_url = buildTrackingUrl(nextTrackingNumber);

      const nextShippedAt =
        (Object.prototype.hasOwnProperty.call(updatePayload, "shipped_at")
          ? (updatePayload.shipped_at as string | null)
          : (existing?.shipped_at as string | null)) || null;
      const nextDeliveredAt =
        (Object.prototype.hasOwnProperty.call(updatePayload, "delivered_at")
          ? (updatePayload.delivered_at as string | null)
          : (existing?.delivered_at as string | null)) || null;

      updatePayload.shipped_at = nextShippedAt;
      updatePayload.delivered_at = nextDeliveredAt;

      if (!Object.prototype.hasOwnProperty.call(body, "tracking_status")) {
        if (nextDeliveredAt) {
          updatePayload.tracking_status = "Delivered";
        } else if (nextShippedAt || nextTrackingNumber) {
          updatePayload.tracking_status = "In Transit";
        } else {
          updatePayload.tracking_status = null;
        }
      }

      if (!body?.status) {
        if ((existing?.status as string) !== "CANCELLED") {
          if (nextDeliveredAt) {
            updatePayload.status = "DELIVERED";
          } else if (nextShippedAt || nextTrackingNumber) {
            updatePayload.status = "SHIPPED";
          }
        }
      }
    }

    if (body?.status) {
      updatePayload.status = body.status;
    }

    const { data, error } = await supabase
      .from("replacement_parts")
      .update(updatePayload)
      .eq("id", params.id)
      .select(
        "id, created_at, updated_at, part_name, customer_name, ebay_order_number, request_notes, internal_notes, status, emailed_to_customer, emailed_at, tracking_number, tracking_url, tracking_status, shipped_at, delivered_at, qbo_invoice_id, qbo_invoice_number"
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
