"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

type StatusValue = "SENT_TO_FACTORY" | "IN_PRODUCTION" | "ON_THE_WAY" | "DELIVERED" | "CANCELLED";

type SpecialOrder = {
  id: string;
  created_at: string;
  updated_at: string;
  order_name: string;
  customer_name: string | null;
  special_colors: string | null;
  factory_notes: string | null;
  internal_notes: string | null;
  internal_updates: string | null;
  status: StatusValue;
  expected_delivery: string | null;
  qbo_invoice_id: string | null;
  qbo_invoice_number: string | null;
};

type SpecialOrderDocument = {
  id: string;
  created_at: string;
  file_name: string;
  file_size: number | null;
  file_mime_type: string | null;
  file_path: string;
  upload_notes: string | null;
  signedUrl?: string | null;
};

type InvoiceSummary = {
  id: string | null;
  docNumber: string | null;
  txnDate: string | null;
  dueDate: string | null;
  salesRep: string | null;
  customer: string | null;
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
  salesRep: string | null;
};

type SpecialOrderDetails = SpecialOrder & {
  documents: SpecialOrderDocument[];
  invoiceSummary: InvoiceSummary | null;
};

const STATUS_OPTIONS: Array<{ value: StatusValue; label: string }> = [
  { value: "SENT_TO_FACTORY", label: "sent to factory" },
  { value: "IN_PRODUCTION", label: "in production" },
  { value: "ON_THE_WAY", label: "on the way" },
  { value: "DELIVERED", label: "delivered" },
  { value: "CANCELLED", label: "cancelled" },
];

const STATUS_META: Record<StatusValue, { symbol: string; chipClass: string }> = {
  SENT_TO_FACTORY: { symbol: "S", chipClass: "bg-slate-200 text-slate-700" },
  IN_PRODUCTION: { symbol: "P", chipClass: "bg-amber-100 text-amber-700" },
  ON_THE_WAY: { symbol: "T", chipClass: "bg-sky-100 text-sky-700" },
  DELIVERED: { symbol: "D", chipClass: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { symbol: "X", chipClass: "bg-red-100 text-red-700" },
};

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);

export default function SpecialOrdersPage() {
  const [orders, setOrders] = useState<SpecialOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<SpecialOrderDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [newInvoiceNumber, setNewInvoiceNumber] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadNotes, setUploadNotes] = useState("");
  const [noteEntry, setNoteEntry] = useState("");
  const [invoiceCandidates, setInvoiceCandidates] = useState<InvoiceCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");

  const selectedOrder = useMemo(() => orders.find((o) => o.id === selectedId) || null, [orders, selectedId]);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetails(null);
      return;
    }
    loadDetails(selectedId);
  }, [selectedId]);

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await fetch("/api/special-orders", { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to load special orders");
      const rows = (result.data || []) as SpecialOrder[];
      setOrders(rows);
      if (!selectedId && rows.length > 0) {
        setSelectedId(rows[0].id);
      }
    } catch (error: any) {
      alert(error?.message || "Failed to load special orders");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetails(id: string) {
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/special-orders/${id}`, { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to load special order");
      const row = result.data as SpecialOrderDetails;
      setDetails(row);
      setNoteEntry("");
    } catch (error: any) {
      alert(error?.message || "Failed to load special order");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    await submitCreateOrder();
  }

  async function submitCreateOrder(selectedInvoiceId?: string) {
    const invoiceNumber = newInvoiceNumber.trim();
    if (!invoiceNumber) {
      alert("Enter a QuickBooks invoice number.");
      return;
    }

    setCreatingOrder(true);
    try {
      const res = await fetch("/api/special-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber,
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
      if (!res.ok) throw new Error(result?.error || "Failed to create special order");

      const created = result.data as SpecialOrder;
      setOrders((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setNewInvoiceNumber("");
      setInvoiceCandidates([]);
      setSelectedCandidateId("");
    } catch (error: any) {
      alert(error?.message || "Failed to create special order");
    } finally {
      setCreatingOrder(false);
    }
  }

  async function saveDetails() {
    if (!details) return;
    setSaving(true);
    try {
      const payload = {
        status: details.status,
        expected_delivery: details.expected_delivery,
        note_entry: noteEntry,
      };

      const res = await fetch(`/api/special-orders/${details.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to save special order");

      const updated = result.data as SpecialOrder;
      setOrders((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
      setDetails((prev) => (prev ? { ...prev, ...updated } : prev));
      setNoteEntry("");
    } catch (error: any) {
      alert(error?.message || "Failed to save special order");
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocument(file: File) {
    if (!details) return;

    setUploadingDoc(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("uploadNotes", uploadNotes);

      const res = await fetch(`/api/special-orders/${details.id}/documents`, {
        method: "POST",
        body,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to upload document");

      setDetails((prev) =>
        prev
          ? {
              ...prev,
              documents: [result.data as SpecialOrderDocument, ...(prev.documents || [])],
            }
          : prev
      );
      setUploadNotes("");
    } catch (error: any) {
      alert(error?.message || "Failed to upload document");
    } finally {
      setUploadingDoc(false);
    }
  }

  async function deleteDocument(docId: string) {
    if (!details) return;

    try {
      const res = await fetch(`/api/special-orders/${details.id}/documents/${docId}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to delete document");

      setDetails((prev) =>
        prev
          ? {
              ...prev,
              documents: prev.documents.filter((doc) => doc.id !== docId),
            }
          : prev
      );
    } catch (error: any) {
      alert(error?.message || "Failed to delete document");
    }
  }

  async function deleteOrder() {
    if (!details || deletingOrder) return;

    const orderLabel = details.qbo_invoice_number || details.order_name;
    const confirmed = window.confirm(`Delete special order "${orderLabel}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingOrder(true);
    try {
      const res = await fetch(`/api/special-orders/${details.id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to delete special order");

      const nextOrders = orders.filter((order) => order.id !== details.id);
      setOrders(nextOrders);

      if (nextOrders.length > 0) {
        setSelectedId(nextOrders[0].id);
      } else {
        setSelectedId(null);
        setDetails(null);
      }
    } catch (error: any) {
      alert(error?.message || "Failed to delete special order");
    } finally {
      setDeletingOrder(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Special Orders" />

        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-7xl space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h1 className="text-2xl font-bold text-slate-900">Special Orders</h1>
              <p className="text-sm text-slate-600">Track factory special colors, statuses, documents, and linked QuickBooks invoices.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <form onSubmit={createOrder} className="space-y-2 border-b border-slate-200 pb-4">
                  <p className="text-sm font-semibold text-slate-800">Create Special Order</p>
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
                        disabled={!selectedCandidateId || creatingOrder}
                        onClick={() => submitCreateOrder(selectedCandidateId)}
                        className="w-full rounded bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                      >
                        Use Selected Invoice
                      </button>
                    </div>
                  )}
                  <button
                    disabled={creatingOrder}
                    className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {creatingOrder ? "Creating..." : "Create Order"}
                  </button>
                </form>

                <div className="mt-4 space-y-2">
                  {loading ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                  ) : orders.length === 0 ? (
                    <p className="text-sm text-slate-500">No special orders yet.</p>
                  ) : (
                    orders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => {
                          setSelectedId(order.id);
                          if (selectedId === order.id) {
                            loadDetails(order.id);
                          }
                        }}
                        className={`w-full rounded border px-3 py-2 text-left text-sm ${
                          selectedId === order.id
                            ? order.status === "CANCELLED"
                              ? "border-red-400 bg-red-50"
                              : "border-blue-400 bg-blue-50"
                            : order.status === "CANCELLED"
                              ? "border-red-200 bg-red-50"
                              : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${STATUS_META[order.status].chipClass}`}
                            title={STATUS_OPTIONS.find((s) => s.value === order.status)?.label || order.status}
                          >
                            {STATUS_META[order.status].symbol}
                          </span>
                          <p className={`font-semibold ${order.status === "CANCELLED" ? "text-red-700 line-through" : "text-slate-900"}`}>
                            {order.qbo_invoice_number || order.order_name}
                          </p>
                        </div>
                        <p className={`text-xs ${order.status === "CANCELLED" ? "text-red-700" : "text-slate-600"}`}>{order.customer_name || "No customer"}</p>
                        <p className={`text-xs ${order.status === "CANCELLED" ? "text-red-700 font-medium" : "text-slate-500"}`}>
                          {STATUS_OPTIONS.find((s) => s.value === order.status)?.label || order.status}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                {!selectedOrder ? (
                  <p className="text-sm text-slate-500">Select a special order to view details.</p>
                ) : detailsLoading || !details ? (
                  <p className="text-sm text-slate-500">Loading special order details...</p>
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
                        <span className="mb-1 block font-medium">Status</span>
                        <select
                          value={details.status}
                          onChange={(e) => setDetails({ ...details, status: e.target.value as StatusValue })}
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-900"
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm text-slate-700">
                        <span className="mb-1 block font-medium">Expected delivery</span>
                        <input
                          type="date"
                          value={details.expected_delivery || ""}
                          onChange={(e) =>
                            setDetails({ ...details, expected_delivery: e.target.value || null })
                          }
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-900"
                        />
                      </label>
                    </div>

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

                    <div className="flex justify-between gap-2">
                      <button
                        onClick={deleteOrder}
                        disabled={deletingOrder}
                        className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {deletingOrder ? "Deleting..." : "Delete Order"}
                      </button>
                      <button
                        onClick={saveDetails}
                        disabled={saving}
                        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>

                    <div className="rounded border border-slate-200 p-3">
                      <p className="text-sm font-semibold text-slate-900">Documents</p>
                      <div className="mt-2 space-y-2">
                        <input
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadDocument(file);
                            e.currentTarget.value = "";
                          }}
                          disabled={uploadingDoc}
                          className="block w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                        />
                        <textarea
                          value={uploadNotes}
                          onChange={(e) => setUploadNotes(e.target.value)}
                          rows={2}
                          placeholder="Document notes (optional)"
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder-slate-400"
                        />
                      </div>

                      <div className="mt-3 space-y-2">
                        {(details.documents || []).length === 0 ? (
                          <p className="text-xs text-slate-500">No documents uploaded.</p>
                        ) : (
                          details.documents.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between rounded border border-slate-200 p-2 text-sm"
                            >
                              <div>
                                <p className="font-medium text-slate-800">{doc.file_name}</p>
                                {doc.upload_notes ? (
                                  <p className="text-xs text-slate-500">{doc.upload_notes}</p>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2">
                                {doc.signedUrl ? (
                                  <a
                                    href={doc.signedUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    Open
                                  </a>
                                ) : null}
                                <button
                                  onClick={() => deleteDocument(doc.id)}
                                  className="text-red-600 hover:underline"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
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
