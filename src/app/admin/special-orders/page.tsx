"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

type StatusValue = "SENT_TO_FACTORY" | "IN_PRODUCTION" | "ON_THE_WAY" | "DELIVERED";

type SpecialOrder = {
  id: string;
  created_at: string;
  updated_at: string;
  order_name: string;
  customer_name: string | null;
  special_colors: string | null;
  factory_notes: string | null;
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
  customer: string | null;
  total: number;
  balance: number;
  paid: boolean;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
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
];

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);

export default function SpecialOrdersPage() {
  const [orders, setOrders] = useState<SpecialOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<SpecialOrderDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newOrderName, setNewOrderName] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [invoiceNumberInput, setInvoiceNumberInput] = useState("");
  const [linkingInvoice, setLinkingInvoice] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadNotes, setUploadNotes] = useState("");

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
      setInvoiceNumberInput(row.qbo_invoice_number || "");
    } catch (error: any) {
      alert(error?.message || "Failed to load special order");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrderName.trim()) return;

    try {
      const res = await fetch("/api/special-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_name: newOrderName.trim(),
          customer_name: newCustomerName.trim() || null,
          status: "SENT_TO_FACTORY",
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to create special order");

      const created = result.data as SpecialOrder;
      setOrders((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setNewOrderName("");
      setNewCustomerName("");
    } catch (error: any) {
      alert(error?.message || "Failed to create special order");
    }
  }

  async function saveDetails() {
    if (!details) return;
    setSaving(true);
    try {
      const payload = {
        order_name: details.order_name,
        customer_name: details.customer_name,
        special_colors: details.special_colors,
        factory_notes: details.factory_notes,
        status: details.status,
        expected_delivery: details.expected_delivery,
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
    } catch (error: any) {
      alert(error?.message || "Failed to save special order");
    } finally {
      setSaving(false);
    }
  }

  async function linkInvoice() {
    if (!details) return;
    if (!invoiceNumberInput.trim()) {
      alert("Enter a QuickBooks invoice number first.");
      return;
    }

    setLinkingInvoice(true);
    try {
      const res = await fetch(`/api/special-orders/${details.id}/link-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceNumber: invoiceNumberInput.trim() }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to link invoice");

      await loadDetails(details.id);
    } catch (error: any) {
      alert(error?.message || "Failed to link invoice");
    } finally {
      setLinkingInvoice(false);
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
                    value={newOrderName}
                    onChange={(e) => setNewOrderName(e.target.value)}
                    placeholder="Order name"
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    required
                  />
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Customer name (optional)"
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <button className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    Add Order
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
                        onClick={() => setSelectedId(order.id)}
                        className={`w-full rounded border px-3 py-2 text-left text-sm ${
                          selectedId === order.id ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"
                        }`}
                      >
                        <p className="font-semibold text-slate-900">{order.order_name}</p>
                        <p className="text-xs text-slate-600">{order.customer_name || "No customer"}</p>
                        <p className="text-xs text-slate-500">{STATUS_OPTIONS.find((s) => s.value === order.status)?.label || order.status}</p>
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
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label className="text-sm text-slate-700">
                        <span className="mb-1 block font-medium">Order name</span>
                        <input
                          value={details.order_name}
                          onChange={(e) => setDetails({ ...details, order_name: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1.5"
                        />
                      </label>
                      <label className="text-sm text-slate-700">
                        <span className="mb-1 block font-medium">Customer</span>
                        <input
                          value={details.customer_name || ""}
                          onChange={(e) => setDetails({ ...details, customer_name: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1.5"
                        />
                      </label>
                      <label className="text-sm text-slate-700">
                        <span className="mb-1 block font-medium">Status</span>
                        <select
                          value={details.status}
                          onChange={(e) => setDetails({ ...details, status: e.target.value as StatusValue })}
                          className="w-full rounded border border-slate-300 px-2 py-1.5"
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
                          onChange={(e) => setDetails({ ...details, expected_delivery: e.target.value || null })}
                          className="w-full rounded border border-slate-300 px-2 py-1.5"
                        />
                      </label>
                    </div>

                    <label className="block text-sm text-slate-700">
                      <span className="mb-1 block font-medium">Special colors with factory</span>
                      <textarea
                        value={details.special_colors || ""}
                        onChange={(e) => setDetails({ ...details, special_colors: e.target.value })}
                        rows={3}
                        className="w-full rounded border border-slate-300 px-2 py-1.5"
                      />
                    </label>

                    <label className="block text-sm text-slate-700">
                      <span className="mb-1 block font-medium">Factory notes</span>
                      <textarea
                        value={details.factory_notes || ""}
                        onChange={(e) => setDetails({ ...details, factory_notes: e.target.value })}
                        rows={3}
                        className="w-full rounded border border-slate-300 px-2 py-1.5"
                      />
                    </label>

                    <div className="flex justify-end">
                      <button
                        onClick={saveDetails}
                        disabled={saving}
                        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>

                    <div className="rounded border border-slate-200 p-3">
                      <p className="text-sm font-semibold text-slate-900">QuickBooks Invoice</p>
                      <div className="mt-2 flex flex-col gap-2 md:flex-row">
                        <input
                          value={invoiceNumberInput}
                          onChange={(e) => setInvoiceNumberInput(e.target.value)}
                          placeholder="Invoice number (DocNumber)"
                          className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                        />
                        <button
                          onClick={linkInvoice}
                          disabled={linkingInvoice}
                          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {linkingInvoice ? "Linking..." : "Link Invoice"}
                        </button>
                      </div>

                      {details.invoiceSummary ? (
                        <div className="mt-3 rounded bg-slate-50 p-3 text-sm">
                          <p><span className="font-semibold">Invoice:</span> {details.invoiceSummary.docNumber || "—"}</p>
                          <p><span className="font-semibold">Customer:</span> {details.invoiceSummary.customer || "—"}</p>
                          <p>
                            <span className="font-semibold">Status:</span>{" "}
                            {details.invoiceSummary.paid ? (
                              <span className="text-emerald-700">Paid off</span>
                            ) : (
                              <span className="text-amber-700">Not paid</span>
                            )}
                          </p>
                          <p><span className="font-semibold">Total:</span> {money(details.invoiceSummary.total)}</p>
                          <p><span className="font-semibold">Balance:</span> {money(details.invoiceSummary.balance)}</p>

                          <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 text-left">
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
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">No linked invoice yet.</p>
                      )}
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
                          className="block w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                        />
                        <textarea
                          value={uploadNotes}
                          onChange={(e) => setUploadNotes(e.target.value)}
                          rows={2}
                          placeholder="Document notes (optional)"
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </div>

                      <div className="mt-3 space-y-2">
                        {(details.documents || []).length === 0 ? (
                          <p className="text-xs text-slate-500">No documents uploaded.</p>
                        ) : (
                          details.documents.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between rounded border border-slate-200 p-2 text-sm">
                              <div>
                                <p className="font-medium text-slate-800">{doc.file_name}</p>
                                {doc.upload_notes ? <p className="text-xs text-slate-500">{doc.upload_notes}</p> : null}
                              </div>
                              <div className="flex items-center gap-2">
                                {doc.signedUrl ? (
                                  <a href={doc.signedUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                    Open
                                  </a>
                                ) : null}
                                <button onClick={() => deleteDocument(doc.id)} className="text-red-600 hover:underline">
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
