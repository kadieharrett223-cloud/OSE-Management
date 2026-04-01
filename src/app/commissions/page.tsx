"use client";

import { useState, useMemo, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { usePathname } from "next/navigation";
import { getCommissionDateRange, getCurrentCommissionMonth } from "@/lib/commission-dates";

interface RepData {
  repName: string;
  totalSales: number;
  invoiceCount: number;
}

interface InvoiceLine {
  description: string;
  qty: number;
  unitPrice: number;
  lineAmount: number;
  shippingDeducted: number;
  commissionable: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  txnDate: string;
  totalAmount: number;
  totalCommissionable: number;
  totalShippingDeducted: number;
  commission: number;
  lines: InvoiceLine[];
}

interface InvoiceData {
  ok: boolean;
  repName: string;
  invoices: Invoice[];
  count: number;
  commissionRate: number;
  totalCommission: number;
  totalCommissionable: number;
  totalShippingDeducted: number;
}

const mockReps = [
  { id: "1", name: "John Smith", qboCode: "JS", totalSales: 3250.5, invoiceCount: 12 },
  { id: "2", name: "Sarah Johnson", qboCode: "SJ", totalSales: 4120.75, invoiceCount: 18 },
  { id: "3", name: "Mike Chen", qboCode: "MC", totalSales: 2890.0, invoiceCount: 9 },
];

const money = (value: number | undefined) => {
  if (value === undefined || value === null) return "0.00";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function CommissionsPage() {
  const pathname = usePathname();
  const tabs = [
    { label: "Payroll", href: "/payroll" },
    { label: "Commissions", href: "/commissions" },
  ];

  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentCommissionMonth());
  const [connectError, setConnectError] = useState<string | null>(null);
  const [repSalesData, setRepSalesData] = useState<RepData[]>([]);
  const [loadingReps, setLoadingReps] = useState(true);
  const [invoiceStatus, setInvoiceStatus] = useState<"paid" | "unpaid" | "all">("paid");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [commissionData, setCommissionData] = useState<{
    rate: number;
    total: number;
    commissionable: number;
    shippingDeducted: number;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const { startDate, endDate } = getCommissionDateRange(selectedMonth);

    fetch(
      `/api/qbo/invoice/sales-by-rep?startDate=${startDate}&endDate=${endDate}&status=${invoiceStatus}&_=${Date.now()}`
    )
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          console.error("API Error Response:", errorText);
          throw new Error("Failed to fetch sales by rep");
        }
        return await res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data.ok && data.reps) {
          setRepSalesData(data.reps);
          if (data.reps.length > 0) {
            setSelectedRepId(data.reps[0].repName);
          }
        } else {
          console.error("Invalid data structure:", data);
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

  useEffect(() => {
    if (!selectedRepId) {
      setInvoices([]);
      setCommissionData(null);
      return;
    }

    let isMounted = true;
    setLoadingInvoices(true);
    setInvoices([]);
    setCommissionData(null);
    const { startDate, endDate } = getCommissionDateRange(selectedMonth);

    fetch(
      `/api/qbo/invoice/by-rep?repName=${encodeURIComponent(selectedRepId)}&startDate=${startDate}&endDate=${endDate}&status=${invoiceStatus}`
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch invoices");
        return await res.json();
      })
      .then((data: InvoiceData) => {
        if (!isMounted) return;
        if (data.ok && data.invoices) {
          setInvoices(data.invoices);
          setCommissionData({
            rate: data.commissionRate,
            total: data.totalCommission,
            commissionable: data.totalCommissionable,
            shippingDeducted: data.totalShippingDeducted,
          });
        }
      })
      .catch((err) => {
        console.error("Failed to fetch invoices:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingInvoices(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRepId, selectedMonth, invoiceStatus]);

  const startQboConnect = () => {
    setConnectError(null);
    try {
      window.location.href = "/api/qbo/connect";
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : "Failed to start QuickBooks connect.");
    }
  };

  const monthYearDisplay = new Date(selectedMonth + "-01").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  const filteredReps = useMemo(() => {
    const displayReps = repSalesData.length > 0
      ? repSalesData.map((rep) => ({
          id: rep.repName,
          name: rep.repName,
          qboCode: rep.repName.split(" ")[0][0] + (rep.repName.split(" ")[1]?.[0] || ""),
          totalSales: rep.totalSales,
          invoiceCount: rep.invoiceCount,
        }))
      : mockReps;
    const sorted = [...displayReps].sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0));
    return sorted.filter((rep) => rep.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [repSalesData, searchTerm]);

  const selectedRep = filteredReps.find((rep) => rep.id === selectedRepId);

  const selectedTotals = useMemo(() => {
    const totalSales = selectedRep?.totalSales || 0;
    const count = selectedRep?.invoiceCount || 0;
    return { totalSales, count };
  }, [selectedRep]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Commissions" />

        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
          <div className="bg-slate-600 border-b border-slate-500">
            <div className="mx-auto max-w-7xl px-4 md:px-8">
              <div className="flex gap-1">
                {tabs.map((tab) => (
                  <a
                    key={tab.href}
                    href={tab.href}
                    className={`px-4 md:px-6 py-3 text-sm font-medium transition relative whitespace-nowrap ${
                      pathname === tab.href
                        ? "bg-slate-500 text-white rounded-t-lg"
                        : "text-slate-200 hover:text-white hover:bg-slate-700/50"
                    }`}
                  >
                    {tab.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div className="mx-auto max-w-7xl px-4 md:px-8 py-6 md:py-8 space-y-6 md:space-y-8">

            <header>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Commission Tracker</h1>
                  <p className="mt-1 text-sm text-slate-600">Track sales by rep for {monthYearDisplay}</p>
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
                      onChange={(e) => setInvoiceStatus(e.target.value as "paid" | "unpaid" | "all")}
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

            <div className="grid grid-cols-12 gap-6">
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
                  {loadingReps ? (
                    <div className="px-4 py-8 text-center text-slate-600">Loading...</div>
                  ) : filteredReps.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-600">No reps found</div>
                  ) : (
                    filteredReps.map((rep) => (
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
                            <p className="text-slate-600">Sales</p>
                            <p className="font-semibold text-slate-900">${money(rep.totalSales)}</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Invoices</p>
                            <p className="font-semibold text-slate-900">{rep.invoiceCount}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {selectedRep && (
                <div className="col-span-12 md:col-span-8 lg:col-span-9 space-y-6">
                  <div className="rounded-2xl bg-white px-6 py-4 shadow-sm ring-1 ring-slate-200">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs uppercase text-slate-600">Total Sales MTD</p>
                        <p className="mt-1 text-3xl font-semibold text-slate-900">${money(selectedTotals.totalSales)}</p>
                        <p className="mt-2 text-sm text-slate-600">{selectedTotals.count} invoices</p>
                      </div>
                      {commissionData && (
                        <div>
                          <p className="text-xs uppercase text-slate-600">Commission Owed</p>
                          <p className="mt-1 text-3xl font-semibold text-green-600">${money(commissionData.total)}</p>
                          <p className="mt-2 text-sm text-slate-600">
                            Rate: {(commissionData.rate * 100).toFixed(1)}% | Shipping Deducted: ${money(commissionData.shippingDeducted)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {loadingInvoices ? (
                    <div className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-slate-200 text-center text-slate-600">
                      Loading invoices...
                    </div>
                  ) : invoices.length === 0 ? (
                    <div className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-slate-200 text-center text-slate-600">
                      No invoices found
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Invoice #</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Date</th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Items</th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-900">Total</th>
                              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-900">Commission</th>
                              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-900">Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {invoices.map((invoice) => (
                              <>
                                <tr key={invoice.id}>
                                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">{invoice.invoiceNumber}</td>
                                  <td className="px-6 py-4 text-sm text-slate-600">
                                    {new Date(invoice.txnDate).toLocaleDateString("en-US")}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-slate-600">{invoice.lines.length} items</td>
                                  <td className="px-6 py-4 text-sm font-semibold text-slate-900 text-right">
                                    ${money(invoice.totalAmount)}
                                  </td>
                                  <td className="px-6 py-4 text-sm font-semibold text-green-600 text-right">
                                    ${money(invoice.commission)}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <button
                                      onClick={() => setExpandedInvoice(expandedInvoice === invoice.id ? null : invoice.id)}
                                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                      type="button"
                                    >
                                      {expandedInvoice === invoice.id ? "Hide" : "Show"}
                                    </button>
                                  </td>
                                </tr>
                                {expandedInvoice === invoice.id && (
                                  <tr key={`${invoice.id}-details`} className="bg-slate-50">
                                    <td colSpan={6} className="px-6 py-4">
                                      <table className="w-full">
                                        <thead>
                                          <tr className="border-b border-slate-200">
                                            <th className="text-left text-xs font-semibold text-slate-700 py-2">Item</th>
                                            <th className="text-right text-xs font-semibold text-slate-700 py-2">Qty</th>
                                            <th className="text-right text-xs font-semibold text-slate-700 py-2">Unit Price</th>
                                            <th className="text-right text-xs font-semibold text-slate-700 py-2">Amount</th>
                                            <th className="text-right text-xs font-semibold text-slate-700 py-2">Shipping Deducted</th>
                                            <th className="text-right text-xs font-semibold text-slate-700 py-2">Commissionable</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                          {invoice.lines.map((line, idx) => (
                                            <tr key={idx}>
                                              <td className="text-sm text-slate-700 py-2">{line.description}</td>
                                              <td className="text-sm text-slate-700 py-2 text-right">{line.qty}</td>
                                              <td className="text-sm text-slate-700 py-2 text-right">${money(line.unitPrice)}</td>
                                              <td className="text-sm font-semibold text-slate-900 py-2 text-right">${money(line.lineAmount)}</td>
                                              <td className="text-sm text-red-600 py-2 text-right">${money(line.shippingDeducted)}</td>
                                              <td className="text-sm font-semibold text-green-600 py-2 text-right">${money(line.commissionable)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                )}
                              </>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
