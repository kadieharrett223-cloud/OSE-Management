"use client";

import { useState, useMemo, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { usePathname } from "next/navigation";
import { isSalaryRep } from "@/lib/repTypes";
import { isWholesalerName } from "@/lib/repAliases";

interface RepData {
  repName: string;
  totalSales: number;
  commission: number;
  invoiceCount: number;
  commissionRate: number;
}

interface InvoiceLine {
  sku?: string;
  description: string;
  qty: number;
  unitPrice: number;
  lineAmount: number;
  shippingDeducted: number;
  commissionable: number;
  matched: boolean;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  txnDate: string;
  totalAmount: number;
  commission: number;
  commissionable: number;
  shippingDeducted: number;
  lines: InvoiceLine[];
}

// Mock data for fallback
const mockReps = [
  { id: "1", name: "John Smith", qboCode: "JS", commissionMTD: 3250.5, invoiceCount: 12, missingSKUCount: 2 },
  { id: "2", name: "Sarah Johnson", qboCode: "SJ", commissionMTD: 4120.75, invoiceCount: 18, missingSKUCount: 0 },
  { id: "3", name: "Mike Chen", qboCode: "MC", commissionMTD: 2890.0, invoiceCount: 9, missingSKUCount: 1 },
];

const mockInvoices = [
  {
    id: "inv1",
    invoiceNumber: "2024-001",
    txnDate: "2024-01-15",
    totalAmount: 10000,
    commission: 450.25,
    commissionable: 9005,
    shippingDeducted: 125.5,
    lines: [
      { sku: "SKU-A", description: "Product A", qty: 10, unitPrice: 100, lineAmount: 1000, shippingDeducted: 50, commissionable: 950, matched: true },
      { sku: "SKU-B", description: "Product B", qty: 5, unitPrice: 50, lineAmount: 250, shippingDeducted: 25, commissionable: 225, matched: true },
    ],
  },
  {
    id: "inv2",
    invoiceNumber: "2024-002",
    txnDate: "2024-01-20",
    totalAmount: 6400,
    commission: 320.0,
    commissionable: 6400,
    shippingDeducted: 80,
    lines: [
      { sku: "SKU-C", description: "Product C", qty: 8, unitPrice: 80, lineAmount: 640, shippingDeducted: 80, commissionable: 560, matched: true },
    ],
  },
];

const money = (value: number | undefined) => {
  if (value === undefined || value === null) return "0.00";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function CommissionsPage() {
  const [selectedRepId, setSelectedRepId] = useState(mockReps[0]?.id);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [connectError, setConnectError] = useState<string | null>(null);
  const [repSalesData, setRepSalesData] = useState<RepData[]>([]);
  const [repInvoices, setRepInvoices] = useState<InvoiceDetail[]>([]);
  const [loadingReps, setLoadingReps] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [editingRate, setEditingRate] = useState<string>("");
  const [currentRate, setCurrentRate] = useState<number>(0.05);
  const [refreshKey, setRefreshKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<{ok?: boolean; message?: string}>({});
  const [invoiceStatus, setInvoiceStatus] = useState<"paid" | "unpaid" | "all">("paid");

  // Fetch sales reps for current month
  useEffect(() => {
    let isMounted = true;
    const [year, month] = selectedMonth.split("-");
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-${String(new Date(Number(year), Number(month), 0).getDate()).padStart(2, "0")}`;

    fetch(
      `/api/qbo/invoice/sales-by-rep?startDate=${startDate}&endDate=${endDate}&status=${invoiceStatus}&_=${Date.now()}`
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch sales by rep");
        return await res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data.ok && data.reps) {
          setRepSalesData(data.reps);
          // Set first rep as selected
          if (data.reps.length > 0) {
            setSelectedRepId(data.reps[0].repName);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to fetch rep sales:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingReps(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedMonth, invoiceStatus]);

  // Fetch invoices for selected rep
  useEffect(() => {
    if (!selectedRepId) return;

    let isMounted = true;
    setLoadingInvoices(true);
    const [year, month] = selectedMonth.split("-");
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-${String(new Date(Number(year), Number(month), 0).getDate()).padStart(2, "0")}`;

    fetch(
      `/api/qbo/invoice/by-rep?repName=${encodeURIComponent(selectedRepId)}&startDate=${startDate}&endDate=${endDate}&status=${invoiceStatus}&_=${Date.now()}`
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch invoices");
        return await res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data.ok && data.invoices) {
          // Normalize fields for UI (align with API response keys)
          const invoicesWithDefaults = data.invoices.map((inv: any) => ({
            ...inv,
            totalShippingDeducted: inv.totalShippingDeducted ?? inv.shippingDeducted ?? 0,
            totalCommissionable: inv.totalCommissionable ?? inv.commissionable ?? 0,
            commission: inv.commission ?? 0,
          }));
          setRepInvoices(invoicesWithDefaults);
          if (typeof data.commissionRate === "number") {
            setCurrentRate(data.commissionRate);
            setEditingRate(String((data.commissionRate * 100).toFixed(2)));
          }
        }
      })
      .catch((err) => {
        console.error("Failed to fetch rep invoices:", err);
        setRepInvoices([]);
      })
      .finally(() => {
        if (isMounted) setLoadingInvoices(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRepId, selectedMonth, refreshKey, invoiceStatus]);

  // Save commission rate
  const saveCommissionRate = async () => {
    const pct = parseFloat(editingRate);
    if (!isFinite(pct)) return;
    const rate = Math.max(0, pct) / 100;
    try {
      setSaveStatus({});
      const res = await fetch("/api/reps/commission-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repName: selectedRepId, commissionRate: rate }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to save rate");
      }
      setCurrentRate(rate);
      // refresh invoices for updated totals
      setRefreshKey((k) => k + 1);
      setSaveStatus({ ok: true, message: "Saved" });
    } catch (e) {
      console.error(e);
      setSaveStatus({ ok: false, message: e instanceof Error ? e.message : "Failed to save" });
    }
  };


  const filteredReps = useMemo(() => {
    const displayReps = repSalesData.length > 0 ? repSalesData.map(r => ({
      id: r.repName,
      name: r.repName,
      qboCode: r.repName.split(" ")[0][0] + (r.repName.split(" ")[1]?.[0] || ""),
      commissionMTD: r.commission,
      invoiceCount: r.invoiceCount,
      missingSKUCount: 0,
    })) : mockReps;
      // Filter out salary workers - they're shown in the Salary Bonus tab
    const commissionedOnly = displayReps.filter(r => !isSalaryRep(r.name) && !isWholesalerName(r.name));
    // Sort by commission desc by default
    const sorted = [...commissionedOnly].sort((a, b) => (b.commissionMTD || 0) - (a.commissionMTD || 0));
    return sorted.filter((r) => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [repSalesData, searchTerm]);

  const selectedRep = filteredReps.find((r) => r.id === selectedRepId);
  
  // Selected totals
  const selectedTotals = useMemo(() => {
    const totalCommission = repInvoices.reduce((s, i) => s + (i.commission || 0), 0);
    const totalCommissionable = repInvoices.reduce((s, i) => s + (i.commissionable || 0), 0);
    const totalShipping = repInvoices.reduce((s, i) => s + (i.shippingDeducted || 0), 0);
    return { totalCommission, totalCommissionable, totalShipping, count: repInvoices.length };
  }, [repInvoices]);

  const startQboConnect = () => {
    setConnectError(null);
    try {
      window.location.href = "/api/qbo/connect";
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : "Failed to start QuickBooks connect.");
    }
  };

  const toggleInvoiceExpand = (invId: string) => {
    setExpandedInvoices((prev) => {
      const next = new Set(prev);
      if (next.has(invId)) next.delete(invId);
      else next.add(invId);
      return next;
    });
  };

  const monthYearDisplay = new Date(selectedMonth + "-01").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  const pathname = usePathname();
  const tabs = [
    { label: "Commissioned", href: "/commissions" },
    { label: "Salary Bonus", href: "/commissions/salary-bonus" },
    { label: "Wholesalers", href: "/admin/wholesalers" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Commissions" />

        {/* Main Content */}
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

          <div className="mx-auto max-w-7xl px-8 py-8 space-y-6">
            {/* Top Bar */}
            <header>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-blue-700">Commissions</p>
                  <h1 className="mt-1 text-3xl font-semibold text-slate-900">Sales Rep Dashboard</h1>
                  <p className="mt-1 text-sm text-slate-600">Track commissions and invoice details for {monthYearDisplay}.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <label className="block text-xs uppercase text-slate-600">Month</label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-slate-600">Status</label>
                    <select
                      value={invoiceStatus}
                      onChange={(e) => setInvoiceStatus(e.target.value as any)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="all">All</option>
                    </select>
                  </div>
                  <button
                    onClick={startQboConnect}
                    className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-blue-700"
                    type="button"
                  >
                    Connect QuickBooks
                  </button>
                </div>
              </div>
            </header>

            {connectError && (
              <div className="rounded-lg bg-red-50 text-red-900 ring-1 ring-red-200 px-4 py-3 text-sm">
                {connectError}
              </div>
            )}

            {/* Hero Summary Row */}
            <section className="rounded-2xl bg-white/90 shadow-sm ring-1 ring-slate-200 p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                {/* Left: Rep + Owed */}
                <div className="lg:col-span-2">
                  <div className="text-sm text-slate-600">{monthYearDisplay}</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{selectedRep?.name || "Select a rep"}</div>
                  <div className="mt-3 text-slate-600 text-sm">Total Commission Owed</div>
                  <div className="text-5xl font-bold text-emerald-700 tracking-tight">${money(selectedTotals.totalCommission)}</div>
                </div>
                {/* Right: Secondary metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase text-slate-600">Commissionable</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">${money(selectedTotals.totalCommissionable)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase text-slate-600">Invoices</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{selectedTotals.count}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase text-slate-600">Shipping</div>
                    <div className="mt-1 text-lg font-semibold text-blue-700">${money(selectedTotals.totalShipping)}</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Master-Detail */}
            <div className="grid grid-cols-12 gap-6">
              {/* Left: Sales Rep List */}
              <div className="col-span-12 md:col-span-4 lg:col-span-3 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h2 className="text-lg font-semibold text-slate-900">Sales Reps</h2>
                  <input
                    type="text"
                    placeholder="Search reps..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <div className="divide-y divide-slate-100">
                  {filteredReps.map((rep) => (
                    <button
                      key={rep.id}
                      onClick={() => setSelectedRepId(rep.id)}
                      className={`w-full text-left px-4 py-5 transition ${
                        selectedRepId === rep.id
                          ? "bg-blue-50/70 border-l-4 border-blue-600"
                          : "hover:bg-slate-50 border-l-4 border-transparent"
                      }`}
                      type="button"
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{rep.name}</p>
                          <p className="text-xs text-slate-600">{rep.qboCode}</p>
                        </div>
                        <span className="ml-2 shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {rep.invoiceCount}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-4 text-xs">
                        <div>
                          <p className="text-slate-600">Commission</p>
                          <p className="font-semibold text-slate-900">${money(rep.commissionMTD)}</p>
                        </div>
                        <div>
                          <p className="text-slate-600">Invoices</p>
                          <p className="font-semibold text-slate-900">{rep.invoiceCount}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Selected Rep Profile */}
              {selectedRep && (
                <div className="col-span-12 md:col-span-8 lg:col-span-9 space-y-6">
                  {/* Cluster: Earnings */}
                  <div className="rounded-2xl bg-white px-6 py-4 shadow-sm ring-1 ring-slate-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                      <div>
                        <p className="text-xs uppercase text-slate-600">Commission MTD</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">${money(selectedTotals.totalCommission)}</p>
                      </div>
                      <div className="flex items-end gap-3">
                        <div>
                          <p className="text-xs uppercase text-slate-600">Commission Rate (%)</p>
                          <input
                            type="number"
                            step="0.01"
                            value={editingRate}
                            onChange={(e) => setEditingRate(e.target.value)}
                            className="mt-1 w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                          />
                        </div>
                        <button
                          onClick={saveCommissionRate}
                          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-blue-700"
                          type="button"
                        >
                          Save Rate
                        </button>
                        <span className="text-sm text-slate-600">Current: {(currentRate * 100).toFixed(2)}%</span>
                        {saveStatus.message && (
                          <span className={`text-xs ${saveStatus.ok ? "text-emerald-700" : "text-red-600"}`}>
                            {saveStatus.message}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cluster: Volume & Adjustments */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-white px-6 py-4 shadow-sm ring-1 ring-slate-200">
                      <div className="text-xs uppercase text-slate-600">Volume</div>
                      <div className="mt-2 grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-slate-600">Commissionable Sales</div>
                          <div className="text-lg font-semibold text-slate-900">${money(selectedTotals.totalCommissionable)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-600">Invoice Count</div>
                          <div className="text-lg font-semibold text-slate-900">{selectedTotals.count}</div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white px-6 py-4 shadow-sm ring-1 ring-slate-200">
                      <div className="text-xs uppercase text-slate-600">Adjustments</div>
                      <div className="mt-2 grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-slate-600">Shipping Deducted</div>
                          <div className="text-lg font-semibold text-blue-700">${money(selectedTotals.totalShipping)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Invoices Table */}
                  <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                    <div className="border-b border-slate-200 px-6 py-4">
                      <h3 className="text-lg font-semibold text-slate-900">Invoices</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left font-semibold text-slate-600">Invoice #</th>
                            <th className="px-6 py-3 text-left font-semibold text-slate-600">Date</th>
                            <th className="px-6 py-3 text-right font-semibold text-slate-600">Shipping Deducted</th>
                            <th className="px-6 py-3 text-right font-semibold text-slate-600">Commission</th>
                            <th className="px-6 py-3 text-center font-semibold text-slate-600">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {loadingInvoices ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                Loading invoices...
                              </td>
                            </tr>
                          ) : repInvoices.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                No invoices for this rep in the selected month
                              </td>
                            </tr>
                          ) : (
                            repInvoices.map((inv, idx) => (
                              [
                                (
                                  <tr key={inv.id} className={"hover:bg-slate-50 " + (idx % 2 === 1 ? "bg-slate-50/50" : "bg-white") }>
                                    <td className="px-6 py-4 font-medium text-slate-900">{inv.invoiceNumber}</td>
                                    <td className="px-6 py-4 text-slate-600">{new Date(inv.txnDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-right text-slate-600">${money(inv.totalShippingDeducted)}</td>
                                    <td className="px-6 py-4 text-right font-semibold text-emerald-700 text-base">${money(inv.commission)}</td>
                                    <td className="px-6 py-4 text-center">
                                      <button
                                        onClick={() => toggleInvoiceExpand(inv.id)}
                                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                        type="button"
                                      >
                                        {expandedInvoices.has(inv.id) ? "Hide" : "Show"} lines
                                      </button>
                                    </td>
                                  </tr>
                                ),
                                expandedInvoices.has(inv.id) ? (
                                  <tr key={`${inv.id}-detail`} className="bg-blue-50">
                                    <td colSpan={5} className="px-6 py-4">
                                      <p className="mb-3 text-xs font-semibold uppercase text-slate-700">Line Items</p>
                                      <div className="space-y-2">
                                        {inv.lines.map((line, idx2) => (
                                          <div key={idx2} className="flex justify-between rounded-lg bg-white px-4 py-2 text-xs">
                                            <span className="font-medium text-slate-900">{line.sku || line.description}</span>
                                            <span className="text-slate-600">
                                              {line.qty} × ${money(line.unitPrice)} = ${money(line.lineAmount)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                ) : null,
                              ]
                            ))
                          )}
                          
                        </tbody>
                        <tfoot className="bg-white sticky bottom-0">
                          <tr>
                            <td className="px-6 py-3 text-left text-slate-600 font-semibold" colSpan={2}>Totals</td>
                            <td className="px-6 py-3 text-right text-slate-600 font-semibold">${money(selectedTotals.totalShipping)}</td>
                            <td className="px-6 py-3 text-right text-emerald-700 font-bold">${money(selectedTotals.totalCommission)}</td>
                            <td className="px-6 py-3"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
