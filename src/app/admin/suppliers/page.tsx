"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

type Supplier = {
  id: string;
  name: string;
  address?: string;
  city_state_zip?: string;
  contact_name?: string;
  representative?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

const emptyForm: Supplier = {
  id: "",
  name: "",
  address: "",
  city_state_zip: "",
  contact_name: "",
  representative: "",
  email: "",
  phone: "",
  notes: "",
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState<Supplier>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [poDatesBySupplier, setPoDatesBySupplier] = useState<Record<string, string>>({});

  useEffect(() => { fetchSuppliers(); }, []);
  useEffect(() => { fetchPurchaseOrders(); }, []);

  async function fetchSuppliers() {
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers");
      const payload = await res.json();
      if (payload.ok) setSuppliers(payload.data || []);
    } finally { setLoading(false); }
  }

  async function fetchPurchaseOrders() {
    try {
      const res = await fetch("/api/purchase-orders");
      const payload = await res.json();
      if (!payload.ok) return;
      const map: Record<string, string> = {};
      (payload.data || []).forEach((po: any) => {
        const name = (po.vendor_name || "").toLowerCase();
        if (!name) return;
        const date = po.order_date || "";
        if (!map[name] || date > map[name]) {
          map[name] = date;
        }
      });
      setPoDatesBySupplier(map);
    } catch (error) {
      console.error("Failed to fetch purchase orders:", error);
    }
  }

  async function saveSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { alert("Name is required"); return; }
    const method = form.id ? "PATCH" : "POST";
    const url = form.id ? `/api/suppliers/${form.id}` : "/api/suppliers";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const payload = await res.json();
    if (!res.ok) { alert(payload.error || "Failed"); return; }
    setForm(emptyForm);
    fetchSuppliers();
  }

  function editSupplier(s: Supplier) { setForm({ ...s }); }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Purchasing" />
        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900">

          <div className="mx-auto max-w-5xl px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-8">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl md:text-2xl font-semibold">Suppliers</h1>
                <p className="text-sm text-slate-600">Track supplier details and recent activity.</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(emptyForm)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Add Supplier
              </button>
            </header>

            <form onSubmit={saveSupplier} className="rounded-xl bg-white p-6 shadow ring-1 ring-slate-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Name" value={form.name} onChange={(e)=>setForm({ ...form, name: e.target.value })} />
                <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Supplier Contact" value={form.contact_name||""} onChange={(e)=>setForm({ ...form, contact_name: e.target.value })} />
                <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Representative" value={form.representative||""} onChange={(e)=>setForm({ ...form, representative: e.target.value })} />
                <input className="rounded border border-slate-300 px-3 py-2 text-sm col-span-2" placeholder="Address" value={form.address||""} onChange={(e)=>setForm({ ...form, address: e.target.value })} />
                <input className="rounded border border-slate-300 px-3 py-2 text-sm col-span-2" placeholder="City, State, ZIP" value={form.city_state_zip||""} onChange={(e)=>setForm({ ...form, city_state_zip: e.target.value })} />
                <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Email" value={form.email||""} onChange={(e)=>setForm({ ...form, email: e.target.value })} />
                <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Phone" value={form.phone||""} onChange={(e)=>setForm({ ...form, phone: e.target.value })} />
                <textarea className="rounded border border-slate-300 px-3 py-2 text-sm col-span-2" placeholder="Notes" value={form.notes||""} onChange={(e)=>setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setForm(emptyForm)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Clear</button>
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Save Supplier</button>
              </div>
            </form>

            <div className="rounded-xl bg-white shadow ring-1 ring-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Supplier</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Last PO</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Notes</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      Array.from({ length: 6 }).map((_, idx) => (
                        <tr key={`supplier-skeleton-${idx}`} className="animate-pulse">
                          <td className="px-6 py-4"><div className="h-3 w-32 rounded bg-slate-200" /></td>
                          <td className="px-6 py-4"><div className="h-3 w-24 rounded bg-slate-200" /></td>
                          <td className="px-6 py-4"><div className="h-3 w-24 rounded bg-slate-200" /></td>
                          <td className="px-6 py-4"><div className="h-3 w-40 rounded bg-slate-200" /></td>
                          <td className="px-6 py-4 text-right"><div className="ml-auto h-3 w-16 rounded bg-slate-200" /></td>
                        </tr>
                      ))
                    ) : suppliers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-slate-600">
                          <div className="text-lg font-semibold text-slate-900">No suppliers yet</div>
                          <div className="mt-2 text-sm text-slate-600">Add your first supplier to start tracking orders.</div>
                        </td>
                      </tr>
                    ) : (
                      suppliers.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-6 py-3 font-medium text-slate-900">{s.name}</td>
                          <td className="px-6 py-3 text-slate-600">{s.contact_name||"—"}</td>
                          <td className="px-6 py-3 text-slate-600">
                            {formatDate(poDatesBySupplier[(s.name || "").toLowerCase()])}
                          </td>
                          <td className="px-6 py-3 text-slate-600">{s.notes || "—"}</td>
                          <td className="px-6 py-3 text-right">
                            <button onClick={()=>editSupplier(s)} className="text-sm font-semibold text-blue-600 hover:text-blue-700">Edit</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
