"use client";

import { useEffect, useState } from "react";

type Supplier = {
  id: string;
  name: string;
  address?: string;
  city_state_zip?: string;
  contact_name?: string;
  representative?: string;
  email?: string;
  phone?: string;
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
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState<Supplier>(emptyForm);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchSuppliers(); }, []);

  async function fetchSuppliers() {
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers");
      const payload = await res.json();
      if (payload.ok) setSuppliers(payload.data || []);
    } finally { setLoading(false); }
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Suppliers</h1>
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
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={()=>setForm(emptyForm)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Clear</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Save Supplier</button>
          </div>
        </form>

        <div className="rounded-xl bg-white shadow ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold">All Suppliers</h2>
          </div>
          {loading ? (
            <div className="px-6 py-8 text-center text-slate-600">Loading...</div>
          ) : suppliers.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-600">No suppliers yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Supplier Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Representative</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Phone</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium text-slate-900">{s.name}</td>
                      <td className="px-6 py-3 text-slate-600">{s.contact_name||"—"}</td>
                      <td className="px-6 py-3 text-slate-600">{s.representative||"—"}</td>
                      <td className="px-6 py-3 text-slate-600">{s.email||"—"}</td>
                      <td className="px-6 py-3 text-slate-600">{s.phone||"—"}</td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={()=>editSupplier(s)} className="text-sm font-semibold text-blue-600 hover:text-blue-700">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
