"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { usePathname } from "next/navigation";

interface Wholesaler {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  commission_percentage: number | null;
  notes: string | null;
  is_active: boolean;
}

interface Invoice {
  id: string;
  invoice_number: string;
  txn_date: string;
  total_amount: number;
  commission_total: number;
}

const money = (value: number | null) =>
  value ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";

export default function WholesalersPage() {
  const [wholesalers, setWholesalers] = useState<Wholesaler[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWholesaler, setSelectedWholesaler] = useState<Wholesaler | null>(null);
  const [wholesalerInvoices, setWholesalerInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWholesaler, setEditingWholesaler] = useState<Wholesaler | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [commissionTotals, setCommissionTotals] = useState<{ total: number; invoiceCount: number }>({ total: 0, invoiceCount: 0 });

  useEffect(() => {
    loadData();
    loadCommissionTotals();
  }, []);

  // Load invoices when a wholesaler is selected so totals are ready outside the modal
  useEffect(() => {
    if (selectedWholesaler) {
      loadInvoices(selectedWholesaler.id);
    } else {
      setWholesalerInvoices([]);
    }
  }, [selectedWholesaler]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/wholesalers");
      if (!res.ok) throw new Error("Failed to load wholesalers");
      const data = await res.json();
      setWholesalers(data);
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCommissionTotals = async () => {
    try {
      const res = await fetch("/api/wholesalers/commissions");
      if (!res.ok) throw new Error("Failed to load commission totals");
      const data = await res.json();
      setCommissionTotals({ total: data.commissionTotal || 0, invoiceCount: data.invoiceCount || 0 });
    } catch (error: any) {
      setStatus(`❌ Error loading totals: ${error.message}`);
    }
  };

  const handleSave = async () => {
    if (!editingWholesaler) return;
    
    setIsLoading(true);
    try {
      const url = editingWholesaler.id ? `/api/wholesalers/${editingWholesaler.id}` : "/api/wholesalers";
      const method = editingWholesaler.id ? "PUT" : "POST";
      
      // Remove id field when creating new wholesaler (POST)
      const payload = editingWholesaler.id 
        ? editingWholesaler 
        : { ...editingWholesaler, id: undefined };
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) throw new Error("Failed to save wholesaler");
      
      setStatus("✓ Wholesaler saved successfully");
      setEditingWholesaler(null);
      setShowAddModal(false);
      await loadData();
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this wholesaler?")) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/wholesalers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      
      setStatus("✓ Wholesaler deleted");
      await loadData();
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadInvoices = async (wholesalerId: string) => {
    setLoadingInvoices(true);
    try {
      const res = await fetch(`/api/wholesalers/${wholesalerId}/invoices`);
      if (!res.ok) throw new Error("Failed to load invoices");
      const data = await res.json();
      setWholesalerInvoices(data);
    } catch (error: any) {
      console.error("Error loading invoices:", error);
      setWholesalerInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const filteredWholesalers = wholesalers.filter((w) =>
    searchQuery
      ? w.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (w.contact_name?.toLowerCase() || "").includes(searchQuery.toLowerCase())
      : true
  );

  const pathname = usePathname();
  const tabs = [
    { label: "Overview", href: "/commissions" },
    { label: "Wholesalers", href: "/admin/wholesalers" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Commissions" />
        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
          {/* Chrome-style Tabs */}
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

          <div className="p-8">
            <div className="mx-auto max-w-7xl space-y-6">
              {/* Header */}
              <header className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-semibold text-slate-900">Wholesalers</h1>
                  <p className="mt-2 text-sm text-slate-600">Manage client relationships, terms, and contact information</p>
                </div>
                
                <button
                  onClick={() => {
                    setEditingWholesaler({
                      id: "",
                      company_name: "",
                      contact_name: null,
                      email: null,
                      phone: null,
                      address: null,
                      city: null,
                      state: null,
                      zip: null,
                      commission_percentage: null,
                      notes: null,
                      is_active: true,
                    });
                    setShowAddModal(true);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md transition-colors"
                >
                  Add Wholesaler
                </button>
              </header>

          {/* Status */}
          {status && (
            <div className={`rounded-lg px-4 py-3 text-sm ${status.includes("✓") ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200" : "bg-red-50 text-red-900 ring-1 ring-red-200"}`}>
              {status}
            </div>
          )}

          {/* Global Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">Total Commission Owed</div>
                <div className="text-3xl font-bold text-slate-900 mt-1">${money(commissionTotals.total)}</div>
              </div>
              <div className="text-xs text-slate-500 text-right">Paid invoices across wholesalers</div>
            </div>
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">Paid Invoices</div>
                <div className="text-3xl font-bold text-slate-900 mt-1">{commissionTotals.invoiceCount}</div>
              </div>
              <div className="text-xs text-slate-500 text-right">Count included in the total</div>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search by company or contact name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Clear
              </button>
            )}
          </div>

          {/* Wholesalers List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWholesalers.map((wholesaler) => (
              <div
                key={wholesaler.id}
                className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedWholesaler(wholesaler)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900">{wholesaler.company_name}</h3>
                    {wholesaler.contact_name && (
                      <p className="text-sm text-slate-600 mt-1">{wholesaler.contact_name}</p>
                    )}
                  </div>
                  {!wholesaler.is_active && (
                    <span className="px-2 py-1 text-xs font-semibold text-red-700 bg-red-100 rounded">Inactive</span>
                  )}
                </div>
                
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  {wholesaler.email && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {wholesaler.email}
                    </div>
                  )}
                  {wholesaler.phone && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {wholesaler.phone}
                    </div>
                  )}

                {/* Totals */}
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  {selectedWholesaler?.id === wholesaler.id ? (
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-xs font-semibold uppercase text-slate-600">Total Commission Owed</div>
                      <div className="text-lg font-bold text-slate-900">
                        ${money(wholesalerInvoices.reduce((sum, inv) => sum + (inv.commission_total || 0), 0))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">Select this wholesaler to view commission total</div>
                  )}
                </div>
                  {wholesaler.commission_percentage && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <span className="font-semibold text-slate-700">Commission:</span> {wholesaler.commission_percentage}%
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingWholesaler(wholesaler);
                      setShowAddModal(true);
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(wholesaler.id);
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 rounded hover:bg-red-100 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredWholesalers.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              {searchQuery ? "No wholesalers found matching your search" : "No wholesalers yet. Add one to get started!"}
            </div>
          )}
        </div>
        </div>
      </main>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && editingWholesaler && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-semibold text-slate-900">
                {editingWholesaler.id ? "Edit Wholesaler" : "Add Wholesaler"}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Company Name *</label>
                  <input
                    type="text"
                    value={editingWholesaler.company_name}
                    onChange={(e) => setEditingWholesaler({...editingWholesaler, company_name: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={editingWholesaler.contact_name || ""}
                    onChange={(e) => setEditingWholesaler({...editingWholesaler, contact_name: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editingWholesaler.email || ""}
                    onChange={(e) => setEditingWholesaler({...editingWholesaler, email: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editingWholesaler.phone || ""}
                    onChange={(e) => setEditingWholesaler({...editingWholesaler, phone: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={editingWholesaler.address || ""}
                    onChange={(e) => setEditingWholesaler({...editingWholesaler, address: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={editingWholesaler.city || ""}
                    onChange={(e) => setEditingWholesaler({...editingWholesaler, city: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">State</label>
                    <input
                      type="text"
                      value={editingWholesaler.state || ""}
                      onChange={(e) => setEditingWholesaler({...editingWholesaler, state: e.target.value})}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">ZIP</label>
                    <input
                      type="text"
                      value={editingWholesaler.zip || ""}
                      onChange={(e) => setEditingWholesaler({...editingWholesaler, zip: e.target.value})}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Commission % / Margin</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 5.00"
                    value={editingWholesaler.commission_percentage || ""}
                    onChange={(e) => setEditingWholesaler({...editingWholesaler, commission_percentage: parseFloat(e.target.value) || null})}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
                
                <div></div>
                
                <div className="flex items-center">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={editingWholesaler.is_active}
                      onChange={(e) => setEditingWholesaler({...editingWholesaler, is_active: e.target.checked})}
                      className="rounded border-slate-300"
                    />
                    Active
                  </label>
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Notes</label>
                  <textarea
                    value={editingWholesaler.notes || ""}
                    onChange={(e) => setEditingWholesaler({...editingWholesaler, notes: e.target.value})}
                    rows={4}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleSave}
                disabled={isLoading || !editingWholesaler.company_name}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingWholesaler(null);
                }}
                className="flex-1 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {selectedWholesaler && !showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedWholesaler(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">{selectedWholesaler.company_name}</h2>
                  {selectedWholesaler.contact_name && (
                    <p className="text-slate-600 mt-1">{selectedWholesaler.contact_name}</p>
                  )}
                </div>
                {!selectedWholesaler.is_active && (
                  <span className="px-3 py-1 text-sm font-semibold text-red-700 bg-red-100 rounded">Inactive</span>
                )}
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex">
                <div className="flex-1 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <div className="text-xs font-semibold text-emerald-700 uppercase">Current Commission</div>
                  {loadingInvoices ? (
                    <p className="text-sm text-slate-500 mt-1">Loading invoices...</p>
                  ) : (
                    <p className="text-2xl font-bold text-emerald-900 mt-1">
                      ${money(wholesalerInvoices.reduce((sum, inv) => sum + (inv.commission_total || 0), 0))}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Contact Information</h3>
                <div className="space-y-2 text-sm">
                  {selectedWholesaler.email && <p><span className="text-slate-500">Email:</span> {selectedWholesaler.email}</p>}
                  {selectedWholesaler.phone && <p><span className="text-slate-500">Phone:</span> {selectedWholesaler.phone}</p>}
                  {selectedWholesaler.address && (
                    <p>
                      <span className="text-slate-500">Address:</span> {selectedWholesaler.address}
                      {selectedWholesaler.city && `, ${selectedWholesaler.city}`}
                      {selectedWholesaler.state && `, ${selectedWholesaler.state}`}
                      {selectedWholesaler.zip && ` ${selectedWholesaler.zip}`}
                    </p>
                  )}
                </div>
              </div>
              
              {selectedWholesaler.commission_percentage && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Commission / Margin</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-slate-500">Commission:</span> {selectedWholesaler.commission_percentage}%</p>
                  </div>
                </div>
              )}
              
              {selectedWholesaler.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Notes</h3>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedWholesaler.notes}</p>
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Paid Invoices & Commission</h3>
                {loadingInvoices ? (
                  <p className="text-sm text-slate-500">Loading invoices...</p>
                ) : wholesalerInvoices.length === 0 ? (
                  <p className="text-sm text-slate-500">No paid invoices found</p>
                ) : (
                  <>
                    {/* Next Check Calculation */}
                    {selectedWholesaler.commission_percentage && (() => {
                      const currentMonth = new Date().getMonth();
                      const currentYear = new Date().getFullYear();
                      const thisMonthInvoices = wholesalerInvoices.filter(inv => {
                        const invDate = new Date(inv.txn_date);
                        return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
                      });
                      const totalSales = thisMonthInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
                      const nextCheckAmount = totalSales * (selectedWholesaler.commission_percentage / 100);
                      
                      return thisMonthInvoices.length > 0 && (
                        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <div className="flex items-baseline justify-between">
                            <div>
                              <p className="text-xs font-semibold text-emerald-700 uppercase">Next Check (This Month)</p>
                              <p className="text-2xl font-bold text-emerald-900 mt-1">${money(nextCheckAmount)}</p>
                              <p className="text-xs text-emerald-700 mt-1">
                                {selectedWholesaler.commission_percentage}% of ${money(totalSales)} ({thisMonthInvoices.length} invoice{thisMonthInvoices.length !== 1 ? 's' : ''})
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    
                    <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">Invoice #</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">Date</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700">Total</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700">Commission</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {wholesalerInvoices.map((invoice) => (
                            <tr key={invoice.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-900">{invoice.invoice_number}</td>
                              <td className="px-3 py-2 text-slate-600">{new Date(invoice.txn_date).toLocaleDateString()}</td>
                              <td className="px-3 py-2 text-right text-slate-900">${money(invoice.total_amount)}</td>
                              <td className="px-3 py-2 text-right text-emerald-700 font-semibold">${money(invoice.commission_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-slate-700">All-Time Total</td>
                            <td className="px-3 py-2 text-right text-sm font-semibold text-slate-900">
                              ${money(wholesalerInvoices.reduce((sum, inv) => sum + inv.total_amount, 0))}
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-semibold text-emerald-700">
                              ${money(wholesalerInvoices.reduce((sum, inv) => sum + inv.commission_total, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => {
                  setEditingWholesaler(selectedWholesaler);
                  setSelectedWholesaler(null);
                  setShowAddModal(true);
                }}
                className="flex-1 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => setSelectedWholesaler(null)}
                className="flex-1 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
