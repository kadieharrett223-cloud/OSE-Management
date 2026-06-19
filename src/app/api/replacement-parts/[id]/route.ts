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

function normalizeCarrier(value: string | null | undefined): string | null {
  if (!value) return null;
  const carrier = value.trim().toLowerCase();
  if (!carrier) return null;

  if (carrier.includes("ups")) return "ups";
  if (carrier.includes("fedex") || carrier.includes("federal express")) return "fedex";
  if (carrier.includes("usps") || carrier.includes("postal")) return "usps";
  if (carrier.includes("dhl")) return "dhl";

  return null;
}

function buildTrackingUrl(carrierInput: string | null | undefined, trackingNumberInput: string | null | undefined): string | null {
  const trackingNumber = String(trackingNumberInput || "").trim();
  if (!trackingNumber) return null;

  const carrier = normalizeCarrier(carrierInput);
  switch (carrier) {
    case "ups":
      return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
    case "usps":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
    case "dhl":
      return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(trackingNumber)}`;
    default:
      return `https://parcelsapp.com/en/tracking/${encodeURIComponent(trackingNumber)}`;
  }
}

function mapAfterShipTagToStatus(tag: string | null | undefined): string | null {
  switch ((tag || "").toLowerCase()) {
    case "delivered":
      return "Delivered";
    case "intransit":
      return "In Transit";
    case "info_received":
      return "Label Created";
    case "attemptfail":
      return "Delivery Attempt Failed";
    case "exception":
      return "Exception";
    case "pending":
      return "Pending";
    case "expired":
      return "Expired";
    case "notfound":
      return "Not Found";
    default:
      return null;
  }
}

function mapAfterShipTagToWorkflowStatus(tag: string | null | undefined): "SHIPPED" | "DELIVERED" | null {
  switch ((tag || "").toLowerCase()) {
    case "delivered":
      return "DELIVERED";
    case "intransit":
    case "info_received":
    case "attemptfail":
    case "exception":
      return "SHIPPED";
    default:
      return null;
  }
}

function extractDatePart(dateTime: string | null | undefined): string | null {
  if (!dateTime) return null;
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

async function getAfterShipTrackingSnapshot(carrierInput: string | null, trackingNumberInput: string | null) {
  const apiKey = process.env.AFTERSHIP_API_KEY;
  const trackingNumber = String(trackingNumberInput || "").trim();
  const carrier = normalizeCarrier(carrierInput);

  if (!apiKey || !trackingNumber || !carrier) return null;

  const response = await fetch(`https://api.aftership.com/v4/trackings/${carrier}/${encodeURIComponent(trackingNumber)}`, {
    headers: {
      "aftership-api-key": apiKey,
      "content-type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const tracking = payload?.data?.tracking;
  const tag = tracking?.tag || null;
  const deliveredAt = extractDatePart(tracking?.delivery_time || null);
  const shippedAt = extractDatePart(tracking?.shipment_pickup_date || tracking?.shipment_delivery_date || null);

  return {
    tag,
    trackingStatus: mapAfterShipTagToStatus(tag),
    workflowStatus: mapAfterShipTagToWorkflowStatus(tag),
    shippedAt,
    deliveredAt,
  };
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
        "id, created_at, updated_at, part_name, customer_name, request_notes, internal_notes, status, tracking_carrier, tracking_number, tracking_url, tracking_status, shipped_at, delivered_at, qbo_invoice_id, qbo_invoice_number"
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
      .select("internal_notes, status, tracking_carrier, tracking_number, shipped_at, delivered_at")
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

    if (Object.prototype.hasOwnProperty.call(body, "tracking_carrier")) {
      const trackingCarrier = String(body?.tracking_carrier || "").trim();
      updatePayload.tracking_carrier = trackingCarrier || null;
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

    const hasTrackingCarrier = Object.prototype.hasOwnProperty.call(updatePayload, "tracking_carrier");
    const hasTrackingNumber = Object.prototype.hasOwnProperty.call(updatePayload, "tracking_number");
    const trackingFieldsChanged = hasTrackingCarrier || hasTrackingNumber;

    const nextCarrier = hasTrackingCarrier
      ? (updatePayload.tracking_carrier as string | null)
      : (existing?.tracking_carrier as string | null);
    const nextTrackingNumber = hasTrackingNumber
      ? (updatePayload.tracking_number as string | null)
      : (existing?.tracking_number as string | null);

    if (trackingFieldsChanged || refreshTracking) {
      updatePayload.tracking_url = buildTrackingUrl(nextCarrier, nextTrackingNumber);

      const trackingSnapshot = await getAfterShipTrackingSnapshot(nextCarrier, nextTrackingNumber);
      if (trackingSnapshot?.trackingStatus) {
        updatePayload.tracking_status = trackingSnapshot.trackingStatus;
      }

      const nextShippedAt =
        (Object.prototype.hasOwnProperty.call(updatePayload, "shipped_at")
          ? (updatePayload.shipped_at as string | null)
          : (existing?.shipped_at as string | null)) || trackingSnapshot?.shippedAt || null;
      const nextDeliveredAt =
        (Object.prototype.hasOwnProperty.call(updatePayload, "delivered_at")
          ? (updatePayload.delivered_at as string | null)
          : (existing?.delivered_at as string | null)) || trackingSnapshot?.deliveredAt || null;

      updatePayload.shipped_at = nextShippedAt;
      updatePayload.delivered_at = nextDeliveredAt;

      if (!body?.status) {
        if ((existing?.status as string) !== "CANCELLED") {
          const workflowStatus = trackingSnapshot?.workflowStatus;
          if (nextDeliveredAt || workflowStatus === "DELIVERED") {
            updatePayload.status = "DELIVERED";
          } else if (nextShippedAt || nextTrackingNumber || workflowStatus === "SHIPPED") {
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
        "id, created_at, updated_at, part_name, customer_name, request_notes, internal_notes, status, tracking_carrier, tracking_number, tracking_url, tracking_status, shipped_at, delivered_at, qbo_invoice_id, qbo_invoice_number"
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
