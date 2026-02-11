"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

type LineItem = {
  id: string;
  sku: string | null;
  description: string;
  quantity: number;
  unit_price: number;
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  vendor_name: string;
  order_date: string;
  status: string;
  lines?: LineItem[];
};

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Sent" },
  { value: "shipped", label: "Shipped" },
  { value: "received", label: "Received" },
  { value: "paid", label: "Paid" },
];

const getStatusColor = (status: string) => {
  const s = status?.toLowerCase() || "draft";
  if (s === "paid") return "bg-indigo-100 text-indigo-800";
  if (s === "received") return "bg-emerald-100 text-emerald-800";
  if (s === "shipped") return "bg-blue-100 text-blue-800";
  if (s === "submitted") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-800";
};

export default function ShipmentTrackingPage() {
  const pathname = usePathname();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const tabs = [
    { label: "Purchase Orders", href: "/admin/purchasing" },
    { label: "Shipment Tracking", href: "/admin/purchasing/shipment-tracking" },
    { label: "Suppliers", href: "/admin/suppliers" },
  ];

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/purchase-orders");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load purchase orders");
        setPos(data.data || []);
      } catch (error) {
        console.error("Failed to load shipment tracking:", error);
        setPos([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleStatusChange = async (poId: string, status: string) => {
    setUpdatingId(poId);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      setPos((prev) => prev.map((po) => (po.id === poId ? data.data : po)));
    } catch (error) {
      console.error("Status update failed:", error);
      alert("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleExpanded = (poId: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(poId)) {
      newExpanded.delete(poId);
    } else {
      newExpanded.add(poId);
    }
    setExpandedIds(newExpanded);
  };

  const filteredPos = pos.filter((po) => {
    const query = searchQuery.toLowerCase();
    return (
      po.po_number.toLowerCase().includes(query) ||
      po.vendor_name.toLowerCase().includes(query) ||
      po.lines?.some((line) => line.sku?.toLowerCase().includes(query) || line.description.toLowerCase().includes(query))
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Purchasing" />
        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900">
          <div className="bg-slate-800 border-b border-slate-700 px-8">
            <div className="flex gap-1">
              {tabs.map((tab) => (
                <a
                  key={tab.href}
                  href={tab.href}
                  className={`px-6 py-3 text-sm font-medium transition relative ${
                    pathname === tab.href
                      ? "bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900 rounded-t-lg"
                      : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                  }`}
                >
                  {tab.label}
                </a>
              ))}
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-8 py-6 space-y-6">
            <header>
              <p className="text-xs uppercase tracking-[0.2em] text-blue-700">Purchasing</p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-900">Shipment Tracking</h1>
              <p className="mt-2 text-sm text-slate-600">
                Track POs, adjust statuses as shipments move. Click to expand details.
              </p>
            </header>

            {/* Search Bar */}
            <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200 p-4">
              <input
                type="text"
                placeholder="Search by PO #, vendor name, or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-2">{filteredPos.length} of {pos.length} shipments</p>
            </div>

            {loading ? (
              <div className="rounded-xl bg-white p-6 shadow-md ring-1 ring-slate-200 text-slate-600">
                Loading shipment data...
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPos.length === 0 ? (
                  <div className="rounded-xl bg-white p-6 shadow-md ring-1 ring-slate-200 text-slate-600">
                    {searchQuery ? "No shipments match your search." : "No purchase orders found."}
                  </div>
                ) : (
                  filteredPos.map((po) => (
                    <div key={po.id} className="rounded-lg bg-white shadow-md ring-1 ring-slate-200 overflow-hidden">
                      {/* Header (Always Visible) */}
                      <button
                        onClick={() => toggleExpanded(po.id)}
                        className="w-full px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left border-b border-slate-200"
                      >
                        <div className="flex-1 flex items-center gap-4">
                          <div className="flex-shrink-0">
                            <svg
                              className={`w-5 h-5 text-slate-600 transition-transform ${
                                expandedIds.has(po.id) ? "rotate-90" : ""
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">PO #{po.po_number}</p>
                            <p className="text-xs text-slate-600">{po.vendor_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(po.status)}`}
                          >
                            {statusOptions.find((opt) => opt.value === po.status?.toLowerCase())?.label || po.status}
                          </span>
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {expandedIds.has(po.id) && (
                        <div className="px-6 py-4 space-y-4 border-t border-slate-200 bg-slate-50/50">
                          {/* Status Selector */}
                          <div className="flex items-center gap-3">
                            <label className="text-xs font-semibold text-slate-600">Update Status:</label>
                            <select
                              value={po.status?.toLowerCase() || "draft"}
                              onChange={(e) => handleStatusChange(po.id, e.target.value)}
                              disabled={updatingId === po.id}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Order Info */}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-xs font-semibold text-slate-600">Order Date</p>
                              <p className="text-slate-900">{po.order_date}</p>
                            </div>
                          </div>

                          {/* Line Items */}
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">Items ({(po.lines || []).length})</p>
                            <div className="space-y-1.5 text-sm">
                              {(po.lines || []).length === 0 ? (
                                <p className="text-slate-500">No line items.</p>
                              ) : (
                                po.lines?.map((line) => (
                                  <div key={line.id} className="flex items-start gap-3 p-2 bg-white rounded border border-slate-200">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-slate-900">{line.sku || "—"}</p>
                                      <p className="text-xs text-slate-600">{line.description}</p>
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                      <p className="text-slate-900 font-medium">Qty: {line.quantity}</p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
