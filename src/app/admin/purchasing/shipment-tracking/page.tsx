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
  { value: "in_transit", label: "In Transit" },
  { value: "arrived", label: "Arrived" },
  { value: "received", label: "Received" },
  { value: "paid", label: "Paid" },
];

export default function ShipmentTrackingPage() {
  const pathname = usePathname();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
                Track which POs are in transit, arriving, or received, and adjust statuses as shipments move.
              </p>
            </header>

            {loading ? (
              <div className="rounded-xl bg-white p-6 shadow-md ring-1 ring-slate-200 text-slate-600">
                Loading shipment data...
              </div>
            ) : (
              <div className="space-y-4">
                {pos.length === 0 ? (
                  <div className="rounded-xl bg-white p-6 shadow-md ring-1 ring-slate-200 text-slate-600">
                    No purchase orders found.
                  </div>
                ) : (
                  pos.map((po) => (
                    <div key={po.id} className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">PO #{po.po_number}</p>
                          <h2 className="text-lg font-semibold text-slate-900">{po.vendor_name}</h2>
                          <p className="text-xs text-slate-500">Order date: {po.order_date}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-semibold text-slate-500">Status</label>
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
                      </div>
                      <div className="px-6 py-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</p>
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          {(po.lines || []).length === 0 ? (
                            <li className="text-slate-500">No line items yet.</li>
                          ) : (
                            po.lines?.map((line) => (
                              <li key={line.id} className="flex flex-wrap items-center justify-between gap-3">
                                <span className="font-medium text-slate-900">{line.sku || "—"}</span>
                                <span className="flex-1 text-slate-600">{line.description}</span>
                                <span className="text-slate-500">Qty: {line.quantity}</span>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
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
