"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

type ProductDetails = {
  id: string;
  name: string;
  onFloor: number;
  sold: number;
  available: number;
  orderCount: number;
};

type ProductOrder = {
  id: string;
  customerName: string;
  invoiceNumber: string;
  createdAt: string;
  orderStatus?: string;
};

const ORDER_STATUS_OPTIONS = [
  { value: "on_order", label: "On Order" },
  { value: "urgent", label: "Urgent" },
  { value: "in_warehouse", label: "In Warehouse" },
  { value: "ready_pickup", label: "Ready Pickup" },
  { value: "delivered", label: "Delivered" },
  { value: "other", label: "Other" },
];

function statusLabel(value?: string) {
  const normalized = String(value || "on_order").trim().toLowerCase();
  const match = ORDER_STATUS_OPTIONS.find((option) => option.value === normalized);
  return match ? match.label : "On Order";
}

export default function ProductOrdersPage() {
  const params = useParams<{ id: string }>();
  const productId = params?.id || "";

  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [newOrderStatus, setNewOrderStatus] = useState("on_order");

  useEffect(() => {
    if (!productId) return;
    loadAll();
  }, [productId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [productRes, ordersRes] = await Promise.all([
        fetch(`/api/inventory/products/${productId}`, { cache: "no-store" }),
        fetch(`/api/inventory/products/${productId}/orders`, { cache: "no-store" }),
      ]);

      const productResult = await productRes.json();
      if (!productRes.ok) throw new Error(productResult?.error || "Failed to load product");

      const ordersResult = await ordersRes.json();
      if (!ordersRes.ok) throw new Error(ordersResult?.error || "Failed to load order entries");

      setProduct(productResult.data as ProductDetails);
      setOrders((ordersResult.data || []) as ProductOrder[]);
    } catch (error: any) {
      alert(error?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function addOrder(e: React.FormEvent) {
    e.preventDefault();
    const customer = customerName.trim();
    const invoice = invoiceNumber.trim();

    if (!invoice) {
      alert("Invoice number is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/inventory/products/${productId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: customer, invoiceNumber: invoice, orderStatus: newOrderStatus }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to add order entry");

      setCustomerName("");
      setInvoiceNumber("");
      setNewOrderStatus("on_order");
      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Failed to add order entry");
    } finally {
      setSaving(false);
    }
  }

  async function updateOrderStatus(orderId: string, orderStatus: string) {
    setUpdatingStatusId(orderId);
    try {
      const res = await fetch(`/api/inventory/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderStatus }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to update order status");

      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, orderStatus: result?.data?.orderStatus || orderStatus } : order))
      );
    } catch (error: any) {
      alert(error?.message || "Failed to update order status");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function removeOrder(orderId: string) {
    if (!confirm("Remove this customer order entry?")) return;

    try {
      const res = await fetch(`/api/inventory/orders/${orderId}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to delete order entry");

      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Failed to delete order entry");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:flex">
      <Sidebar activePage="Inventory Tracker" />

      <main className="w-full px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">Product Orders</h1>
                <p className="mt-1 text-sm text-slate-600">Track customers and invoice numbers that currently have this product on order.</p>
              </div>
              <Link href="/admin/inventory-tracker" className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
                Back to Inventory
              </Link>
            </div>
          </header>

          {loading ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-600">Loading product...</p>
            </section>
          ) : !product ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-600">Product was not found.</p>
            </section>
          ) : (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold">{product.name}</h2>
                <div className="mt-2 grid gap-3 text-sm text-slate-700 sm:grid-cols-4">
                  <div className="rounded-md border border-slate-200 p-3">On floor: {product.onFloor}</div>
                  <div className="rounded-md border border-slate-200 p-3">Sold: {product.sold}</div>
                  <div className="rounded-md border border-slate-200 p-3">Available: {product.available}</div>
                  <div className="rounded-md border border-slate-200 p-3">Orders: {orders.length}</div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold">Add Customer Order</h2>
                <p className="mt-1 text-sm text-slate-600">Invoice number is verified against QuickBooks when you add it.</p>
                <form onSubmit={addOrder} className="mt-3 grid gap-3 sm:grid-cols-[1fr_220px_180px_auto]">
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer name (optional)"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-400 focus:ring"
                  />
                  <input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Invoice number"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-400 focus:ring"
                  />
                  <select
                    value={newOrderStatus}
                    onChange={(e) => setNewOrderStatus(e.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-400 focus:ring"
                  >
                    {ORDER_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Add"}
                  </button>
                </form>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold">Current Orders</h2>
                {orders.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">No customer orders listed yet.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-slate-600">
                          <th className="px-2 py-2 font-medium">Customer</th>
                          <th className="px-2 py-2 font-medium">Invoice #</th>
                          <th className="px-2 py-2 font-medium">Status</th>
                          <th className="px-2 py-2 font-medium">Added</th>
                          <th className="px-2 py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((order) => (
                          <tr key={order.id} className="border-b border-slate-100">
                            <td className="px-2 py-2">{order.customerName}</td>
                            <td className="px-2 py-2">{order.invoiceNumber}</td>
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-2">
                                <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs">
                                  {statusLabel(order.orderStatus)}
                                </span>
                                <select
                                  value={String(order.orderStatus || "on_order")}
                                  onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                  disabled={updatingStatusId === order.id}
                                  className="rounded border border-slate-300 px-2 py-1 text-xs"
                                >
                                  {ORDER_STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className="px-2 py-2">{new Date(order.createdAt).toLocaleString()}</td>
                            <td className="px-2 py-2">
                              <button
                                onClick={() => removeOrder(order.id)}
                                className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
