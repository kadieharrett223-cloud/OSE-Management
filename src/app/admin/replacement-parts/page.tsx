"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

type StatusValue = "REQUESTED" | "ORDERED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

type ReplacementPart = {
  id: string;
  created_at: string;
  updated_at: string;
  part_name: string;
  customer_name: string | null;
  ebay_order_number: string | null;
  request_notes: string | null;
  internal_notes: string | null;
  status: StatusValue;
  emailed_to_customer: boolean;
  emailed_at: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  tracking_status: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  qbo_invoice_id: string | null;
  qbo_invoice_number: string | null;
};

type InvoiceSummary = {
  id: string | null;
  docNumber: string | null;
  txnDate: string | null;
  dueDate: string | null;
  salesRep: string | null;
  customer: string | null;
  shippingAddress: string | null;
  total: number;
  balance: number;
  paid: boolean;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
};

type InvoiceCandidate = {
  id: string;
  docNumber: string;
  txnDate: string | null;
  customer: string | null;
  total: number;
  balance: number;
  paid: boolean;
};

type ReplacementPartDetails = ReplacementPart & {
  invoiceSummary: InvoiceSummary | null;
};

const STATUS_OPTIONS: Array<{ value: StatusValue; label: string }> = [
  { value: "REQUESTED", label: "requested" },
  { value: "ORDERED", label: "ordered" },
  { value: "SHIPPED", label: "shipped" },
  { value: "DELIVERED", label: "delivered" },
  { value: "CANCELLED", label: "cancelled" },
];

const STATUS_META: Record<StatusValue, { symbol: string; chipClass: string }> = {
  REQUESTED: { symbol: "R", chipClass: "bg-slate-200 text-slate-700" },
  ORDERED: { symbol: "O", chipClass: "bg-amber-100 text-amber-700" },
  SHIPPED: { symbol: "S", chipClass: "bg-sky-100 text-sky-700" },
  DELIVERED: { symbol: "D", chipClass: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { symbol: "X", chipClass: "bg-red-100 text-red-700" },
};

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);

function buildTrackingKey(item: {
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
}) {
  return [
    item.tracking_number || "",
    item.shipped_at || "",
    item.delivered_at || "",
  ].join("|");
}

export default function ReplacementPartsPage() {
  const [parts, setParts] = useState<ReplacementPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<ReplacementPartDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingPart, setDeletingPart] = useState(false);
  const [newInvoiceNumber, setNewInvoiceNumber] = useState("");
  const [newEbayOrderNumber, setNewEbayOrderNumber] = useState("");
  const [creatingPart, setCreatingPart] = useState(false);
  const [noteEntry, setNoteEntry] = useState("");
  const [invoiceCandidates, setInvoiceCandidates] = useState<InvoiceCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [trackingAutoSaving, setTrackingAutoSaving] = useState(false);
  const [trackingRefreshing, setTrackingRefreshing] = useState(false);
  const trackingSyncKeyRef = useRef<string>("");

  const selectedPart = useMemo(() => parts.find((part) => part.id === selectedId) || null, [parts, selectedId]);

  useEffect(() => {
    loadParts();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetails(null);
      return;
    }
    loadDetails(selectedId);
  }, [selectedId]);

  async function loadParts() {
    setLoading(true);
    try {
      const res = await fetch("/api/replacement-parts", { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to load replacement parts");
      const rows = (result.data || []) as ReplacementPart[];
      setParts(rows);
      if (!selectedId && rows.length > 0) {
        setSelectedId(rows[0].id);
      }
    } catch (error: any) {
      alert(error?.message || "Failed to load replacement parts");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetails(id: string) {
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/replacement-parts/${id}`, { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to load replacement part");
      const row = result.data as ReplacementPartDetails;
      setDetails(row);
      trackingSyncKeyRef.current = buildTrackingKey(row);
      setNoteEntry("");
    } catch (error: any) {
      alert(error?.message || "Failed to load replacement part");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function createPart(e: React.FormEvent) {
    e.preventDefault();
    await submitCreatePart();
  }

  async function submitCreatePart(selectedInvoiceId?: string) {
    const invoiceNumber = newInvoiceNumber.trim();
    if (!invoiceNumber) {
      alert("Enter a QuickBooks invoice number.");
      return;
    }

    setCreatingPart(true);
    try {
      const res = await fetch("/api/replacement-parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber,
          ebayOrderNumber: newEbayOrderNumber.trim() || null,
          ...(selectedInvoiceId ? { invoiceId: selectedInvoiceId } : {}),
        }),
      });
      const result = await res.json();
      if (res.status === 409) {
        const candidates = Array.isArray(result?.candidates) ? (result.candidates as InvoiceCandidate[]) : [];
        if (candidates.length > 0) {
          setInvoiceCandidates(candidates);
          setSelectedCandidateId(candidates[0]?.id || "");
        } else {
          alert(result?.error || "Multiple invoices found but no selectable options were returned.");
        }
        return;
      }
      if (!res.ok) throw new Error(result?.error || "Failed to create replacement part record");

      const created = result.data as ReplacementPart;
      setParts((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setNewInvoiceNumber("");
      setNewEbayOrderNumber("");
      setInvoiceCandidates([]);
      setSelectedCandidateId("");
    } catch (error: any) {
      alert(error?.message || "Failed to create replacement part record");
    } finally {
      setCreatingPart(false);
    }
  }

  async function saveDetails() {
    if (!details) return;
    setSaving(true);
    try {
      const payload = {
        part_name: details.part_name,
        request_notes: details.request_notes || null,
        ebay_order_number: details.ebay_order_number || null,
        emailed_to_customer: details.emailed_to_customer,
        tracking_number: details.tracking_number || null,
        shipped_at: details.shipped_at || null,
        delivered_at: details.delivered_at || null,
        refresh_tracking: true,
        note_entry: noteEntry,
      };

      const res = await fetch(`/api/replacement-parts/${details.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to save replacement part");

      const updated = result.data as ReplacementPart;
      setParts((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
      setDetails((prev) => (prev ? { ...prev, ...updated } : prev));
      trackingSyncKeyRef.current = buildTrackingKey(updated);
      setNoteEntry("");
    } catch (error: any) {
      alert(error?.message || "Failed to save replacement part");
    } finally {
      setSaving(false);
    }
  }

  async function saveTrackingLive(current: ReplacementPartDetails, options?: { silent?: boolean; refreshOnly?: boolean }) {
    if (!current) return;

    if (options?.refreshOnly) {
      setTrackingRefreshing(true);
    } else if (!options?.silent) {
      setTrackingAutoSaving(true);
    }

    try {
      const payload = options?.refreshOnly
        ? { refresh_tracking: true }
        : {
            tracking_number: current.tracking_number || null,
            shipped_at: current.shipped_at || null,
            delivered_at: current.delivered_at || null,
            refresh_tracking: true,
          };

      const res = await fetch(`/api/replacement-parts/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to refresh tracking");

      const updated = result.data as ReplacementPart;
      setParts((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
      setDetails((prev) => (prev ? { ...prev, ...updated } : prev));
      trackingSyncKeyRef.current = buildTrackingKey(updated);
    } catch (error: any) {
      if (!options?.silent) {
        alert(error?.message || "Failed to refresh tracking");
      }
    } finally {
      setTrackingAutoSaving(false);
      setTrackingRefreshing(false);
    }
  }

  useEffect(() => {
    if (!details) return;

    const key = buildTrackingKey(details);
    if (key === trackingSyncKeyRef.current) return;

    const timer = window.setTimeout(() => {
      void saveTrackingLive(details, { silent: true });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [details?.id, details?.tracking_number, details?.shipped_at, details?.delivered_at]);

  useEffect(() => {
    if (!details?.id || !details.tracking_number) return;

    const interval = window.setInterval(() => {
      void saveTrackingLive(details, { silent: true, refreshOnly: true });
    }, 60000);

    return () => window.clearInterval(interval);
  }, [details?.id, details?.tracking_number]);

  async function deletePart() {
    if (!details || deletingPart) return;

    const partLabel = details.qbo_invoice_number || details.part_name;
    const confirmed = window.confirm(`Delete replacement part record "${partLabel}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingPart(true);
    try {
      const res = await fetch(`/api/replacement-parts/${details.id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to delete replacement part");

      const nextParts = parts.filter((part) => part.id !== details.id);
      setParts(nextParts);

      if (nextParts.length > 0) {
        setSelectedId(nextParts[0].id);
      } else {
        setSelectedId(null);
        setDetails(null);
      }
    } catch (error: any) {
      alert(error?.message || "Failed to delete replacement part");
    } finally {
      setDeletingPart(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Replacement Parts" />

        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-7xl space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h1 className="text-2xl font-bold text-slate-900">Replacement Parts</h1>
              <p className="text-sm text-slate-600">Track replacement parts by invoice, update shipping details, and monitor delivery progress.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <form onSubmit={createPart} className="space-y-2 border-b border-slate-200 pb-4">
                  <p className="text-sm font-semibold text-slate-800">Create Replacement Record</p>
                  <input
                    type="text"
                    value={newInvoiceNumber}
                    onChange={(e) => {
                      setNewInvoiceNumber(e.target.value);
                      if (invoiceCandidates.length > 0) {
                        setInvoiceCandidates([]);
                        setSelectedCandidateId("");
                      }
                    }}
                    placeholder="QuickBooks invoice number"
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder-slate-400"
                    required
                  />
                  <input
                    type="text"
                    value={newEbayOrderNumber}
                    onChange={(e) => setNewEbayOrderNumber(e.target.value)}
                    placeholder="eBay order number (optional)"
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder-slate-400"
                  />
                  {invoiceCandidates.length > 0 && (
                    <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-2">
                      <p className="text-xs font-medium text-amber-800">
                        Multiple invoices match this number. Select the exact invoice.
                      </p>
                      <select
                        value={selectedCandidateId}
                        onChange={(e) => setSelectedCandidateId(e.target.value)}
                        className="w-full rounded border border-amber-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                      >
                        {invoiceCandidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.docNumber || "-"} | {candidate.customer || "No customer"} |{" "}
                            {candidate.txnDate || "-"} | {money(candidate.total)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!selectedCandidateId || creatingPart}
                        onClick={() => submitCreatePart(selectedCandidateId)}
                        className="w-full rounded bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                      >
                        Use Selected Invoice
                      </button>
                    </div>
                  )}
                  <button
                    disabled={creatingPart}
                    className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {creatingPart ? "Creating..." : "Create Record"}
                  </button>
                </form>

                <div className="mt-4 space-y-2">
                  {loading ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                  ) : parts.length === 0 ? (
                    <p className="text-sm text-slate-500">No replacement part records yet.</p>
                  ) : (
                    parts.map((part) => (
                      <button
                        key={part.id}
                        onClick={() => {
                          setSelectedId(part.id);
                          if (selectedId === part.id) {
                            loadDetails(part.id);
                          }
                        }}
                        className={`w-full rounded border px-3 py-2 text-left text-sm ${
                          selectedId === part.id
                            ? part.status === "CANCELLED"
                              ? "border-red-400 bg-red-50"
                              : "border-blue-400 bg-blue-50"
                            : part.status === "CANCELLED"
                              ? "border-red-200 bg-red-50"
                              : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${STATUS_META[part.status].chipClass}`}
                            title={STATUS_OPTIONS.find((s) => s.value === part.status)?.label || part.status}
                          >
                            {STATUS_META[part.status].symbol}
                          </span>
                          <p className={`font-semibold ${part.status === "CANCELLED" ? "text-red-700 line-through" : "text-slate-900"}`}>
                            {part.qbo_invoice_number || part.part_name}
                          </p>
                        </div>
                        <p className={`text-xs ${part.status === "CANCELLED" ? "text-red-700" : "text-slate-600"}`}>{part.customer_name || "No customer"}</p>
                        <p className={`text-xs ${part.status === "CANCELLED" ? "text-red-700" : "text-slate-600"}`}>
                          eBay order: {part.ebay_order_number || "-"}
                        </p>
                        <p className={`text-xs ${part.status === "CANCELLED" ? "text-red-700" : part.emailed_to_customer ? "text-emerald-700" : "text-slate-600"}`}>
                          Emailed: {part.emailed_to_customer ? `Yes${part.emailed_at ? ` (${new Date(part.emailed_at).toLocaleString()})` : ""}` : "No"}
                        </p>
                        <p className={`text-xs ${part.status === "CANCELLED" ? "text-red-700 font-medium" : "text-slate-500"}`}>
                          {STATUS_OPTIONS.find((s) => s.value === part.status)?.label || part.status}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                {!selectedPart ? (
                  <p className="text-sm text-slate-500">Select a replacement part record to view details.</p>
                ) : detailsLoading || !details ? (
                  <p className="text-sm text-slate-500">Loading replacement part details...</p>
                ) : (
                  <div className="space-y-5">
                    {details.invoiceSummary && (
                      <div className="rounded border border-slate-200 bg-slate-50 p-4 text-slate-700">
                        <p className="mb-3 text-sm font-semibold text-slate-900">QuickBooks Invoice</p>
                        <div className="space-y-1 text-sm text-slate-700">
                          <p>
                            <span className="font-medium text-slate-900">Invoice:</span> {details.invoiceSummary.docNumber || "-"}
                          </p>
                          <p>
                            <span className="font-medium text-slate-900">Customer:</span> {details.invoiceSummary.customer || "-"}
                          </p>
                          <p>
                            <span className="font-medium text-slate-900">Sales rep:</span> {details.invoiceSummary.salesRep || "-"}
                          </p>
                          <p>
                            <span className="font-medium text-slate-900">Shipping address:</span>{" "}
                            <span className="whitespace-pre-wrap">{details.invoiceSummary.shippingAddress || "-"}</span>
                          </p>
                          <p>
                            <span className="font-medium text-slate-900">Status:</span>{" "}
                            {details.invoiceSummary.paid ? (
                              <span className="text-emerald-700">Paid off</span>
                            ) : (
                              <span className="text-amber-700">Not paid</span>
                            )}
                          </p>
                          <p>
                            <span className="font-medium text-slate-900">Total:</span> {money(details.invoiceSummary.total)}
                          </p>
                          <p>
                            <span className="font-medium text-slate-900">Balance:</span> {money(details.invoiceSummary.balance)}
                          </p>
                        </div>

                        {details.invoiceSummary.lineItems.length > 0 && (
                          <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-xs text-slate-700">
                              <thead>
                                <tr className="border-b border-slate-300 text-left text-slate-900">
                                  <th className="px-2 py-1">Description</th>
                                  <th className="px-2 py-1 text-right">Qty</th>
                                  <th className="px-2 py-1 text-right">Unit</th>
                                  <th className="px-2 py-1 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {details.invoiceSummary.lineItems.map((line, idx) => (
                                  <tr key={`${line.description}-${idx}`} className="border-b border-slate-100">
                                    <td className="px-2 py-1">{line.description}</td>
                                    <td className="px-2 py-1 text-right">{line.quantity}</td>
                                    <td className="px-2 py-1 text-right">{money(line.unitPrice)}</td>
                                    <td className="px-2 py-1 text-right">{money(line.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label className="text-sm text-slate-700">
                        <span className="mb-1 block font-medium">Part Name</span>
                        <input
                          type="text"
                          value={details.part_name}
                          onChange={(e) => setDetails({ ...details, part_name: e.target.value })}
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-900"
                        />
                      </label>
                      <label className="text-sm text-slate-700">
                        <span className="mb-1 block font-medium">Status (Auto)</span>
                        <select
                          value={details.status}
                          disabled
                          className="w-full cursor-not-allowed rounded border border-slate-300 bg-slate-100 px-2 py-1.5 text-slate-900"
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <span className="mt-1 block text-xs text-slate-500">
                          Updated automatically from tracking number and shipped/delivered dates.
                        </span>
                      </label>
                      <label className="text-sm text-slate-700">
                        <span className="mb-1 block font-medium">eBay Order Number</span>
                        <input
                          type="text"
                          value={details.ebay_order_number || ""}
                          onChange={(e) => setDetails({ ...details, ebay_order_number: e.target.value || null })}
                          placeholder="e.g. 12-34567-89012"
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-900"
                        />
                      </label>
                      <label className="text-sm text-slate-700">
                        <span className="mb-1 block font-medium">Email Sent</span>
                        <div className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2 py-2">
                          <input
                            id="emailed-to-customer"
                            type="checkbox"
                            checked={details.emailed_to_customer}
                            onChange={(e) =>
                              setDetails({
                                ...details,
                                emailed_to_customer: e.target.checked,
                                emailed_at: e.target.checked ? details.emailed_at || new Date().toISOString() : null,
                              })
                            }
                            className="h-4 w-4"
                          />
                          <label htmlFor="emailed-to-customer" className="text-sm text-slate-900">
                            Mark as emailed
                          </label>
                        </div>
                        <span className="mt-1 block text-xs text-slate-500">
                          {details.emailed_to_customer
                            ? `Marked emailed${details.emailed_at ? ` at ${new Date(details.emailed_at).toLocaleString()}` : ""}`
                            : "Not emailed yet"}
                        </span>
                      </label>
                      <label className="text-sm text-slate-700">
                        <span className="mb-1 block font-medium">Tracking Number</span>
                        <input
                          type="text"
                          value={details.tracking_number || ""}
                          onChange={(e) => setDetails({ ...details, tracking_number: e.target.value || null })}
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-900"
                        />
                      </label>
                      <label className="text-sm text-slate-700">
                        <span className="mb-1 block font-medium">Tracking Status (Auto)</span>
                        <input
                          type="text"
                          value={details.tracking_status || ""}
                          readOnly
                          className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-1.5 text-slate-900"
                          placeholder="Will update automatically"
                        />
                      </label>
                      <label className="text-sm text-slate-700">
                        <span className="mb-1 block font-medium">Shipped Date</span>
                        <input
                          type="date"
                          value={details.shipped_at || ""}
                          onChange={(e) => setDetails({ ...details, shipped_at: e.target.value || null })}
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-900"
                        />
                      </label>
                      <label className="text-sm text-slate-700">
                        <span className="mb-1 block font-medium">Delivered Date</span>
                        <input
                          type="date"
                          value={details.delivered_at || ""}
                          onChange={(e) => setDetails({ ...details, delivered_at: e.target.value || null })}
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-900"
                        />
                      </label>
                    </div>

                    <label className="block text-sm text-slate-700">
                      <span className="mb-1 block font-medium">Tracking URL (Auto)</span>
                      <div className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-1.5 text-slate-900">
                        {details.tracking_url || "Will be generated from carrier + tracking number"}
                      </div>
                      {details.tracking_url ? (
                        <a
                          href={details.tracking_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                        >
                          Open tracking link
                        </a>
                      ) : null}
                    </label>

                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      {trackingAutoSaving ? <span>Saving tracking updates...</span> : null}
                      {trackingRefreshing ? <span>Refreshing live tracking...</span> : null}
                      {!trackingAutoSaving && !trackingRefreshing ? <span>Tracking auto-refreshes every minute when a tracking number exists.</span> : null}
                    </div>

                    <label className="block text-sm text-slate-700">
                      <span className="mb-1 block font-medium">Request Notes</span>
                      <textarea
                        value={details.request_notes || ""}
                        onChange={(e) => setDetails({ ...details, request_notes: e.target.value || null })}
                        rows={3}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-900 placeholder-slate-400"
                        placeholder="Describe what needs replacing"
                      />
                    </label>

                    <label className="block text-sm text-slate-700">
                      <span className="mb-1 block font-medium">Internal notes</span>
                      <textarea
                        value={noteEntry}
                        onChange={(e) => setNoteEntry(e.target.value)}
                        rows={3}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-900 placeholder-slate-400"
                        placeholder="Add a note (timestamp is added automatically on save)"
                      />
                    </label>

                    <div className="rounded border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-sm font-medium text-slate-900">Notes history</p>
                      {details.internal_notes ? (
                        <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">{details.internal_notes}</pre>
                      ) : (
                        <p className="text-sm text-slate-500">No notes yet.</p>
                      )}
                    </div>

                    <div className="flex flex-wrap justify-between gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={async () => details && saveTrackingLive(details, { refreshOnly: true })}
                          disabled={trackingRefreshing || !details.tracking_number}
                          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {trackingRefreshing ? "Refreshing..." : "Refresh Tracking"}
                        </button>
                        <button
                          onClick={deletePart}
                          disabled={deletingPart}
                          className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          {deletingPart ? "Deleting..." : "Delete Record"}
                        </button>
                      </div>
                      <button
                        onClick={saveDetails}
                        disabled={saving}
                        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
