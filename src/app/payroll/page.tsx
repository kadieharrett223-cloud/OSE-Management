"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { getCommissionDateRange, getCurrentCommissionMonth } from "@/lib/commission-dates";

type PayrollMeta = {
  payFrequency: string;
  nextPayrollDate: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  approvalsDue: string;
  payrollRun: string;
};

type PayrollMember = {
  id: string;
  fullName: string;
  role: string;
  type: "Hourly" | "Salary";
  rate: number;
  status: string;
  lastIncreaseDate: string | null;
  lastIncreaseAmount: number;
  perPayrollCost: number;
};

type PayrollResponse = {
  ok: boolean;
  period: { startDate: string; endDate: string };
  payrollMeta: PayrollMeta;
  team: PayrollMember[];
};

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

type OpenInvoice = {
  Id: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  TotalAmt?: number;
  Balance?: number;
  CustomerRef?: { name?: string };
};

const mockReps = [
  { id: "1", name: "John Smith", qboCode: "JS", totalSales: 3250.5, invoiceCount: 12 },
  { id: "2", name: "Sarah Johnson", qboCode: "SJ", totalSales: 4120.75, invoiceCount: 18 },
  { id: "3", name: "Mike Chen", qboCode: "MC", totalSales: 2890.0, invoiceCount: 9 },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

const formatShortDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getFirstName = (fullName: string) => fullName.split(" ")[0] || fullName;

const money = (value: number | undefined) => {
  if (value === undefined || value === null) return "0.00";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const withinDays = (value?: string | null, days = 120) => {
  if (!value) return false;
  const today = new Date();
  const target = new Date(`${value}T00:00:00`);
  const diff = today.getTime() - target.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
};

const getDefaultPeriod = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 13);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
};

export default function PayrollPage() {
  const { startDate: defaultStart, endDate: defaultEnd } = getDefaultPeriod();
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payrollMeta, setPayrollMeta] = useState<PayrollMeta | null>(null);
  const [team, setTeam] = useState<PayrollMember[]>([]);
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
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [loadingOpenInvoices, setLoadingOpenInvoices] = useState(false);
  const [openInvoiceError, setOpenInvoiceError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPayroll = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/qbo/payroll/overview?startDate=${startDate}&endDate=${endDate}`);
        const data = (await res.json()) as PayrollResponse;
        if (!res.ok || !data.ok) {
          throw new Error((data as any)?.error || "Failed to load payroll data");
        }
        setPayrollMeta(data.payrollMeta);
        setTeam(data.team || []);
      } catch (err: any) {
        setError(err?.message || "Failed to load payroll data from QBO");
        setPayrollMeta(null);
        setTeam([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPayroll();
  }, [startDate, endDate]);

  useEffect(() => {
    let isMounted = true;
    const { startDate: commissionStart, endDate: commissionEnd } = getCommissionDateRange(selectedMonth);

    fetch(
      `/api/qbo/invoice/sales-by-rep?startDate=${commissionStart}&endDate=${commissionEnd}&status=${invoiceStatus}&_=${Date.now()}`
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
    const { startDate: commissionStart, endDate: commissionEnd } = getCommissionDateRange(selectedMonth);

    fetch(
      `/api/qbo/invoice/by-rep?repName=${encodeURIComponent(selectedRepId)}&startDate=${commissionStart}&endDate=${commissionEnd}&status=${invoiceStatus}`
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

  const handlePrintOpenInvoices = async () => {
    setLoadingOpenInvoices(true);
    setOpenInvoiceError(null);
    try {
      const res = await fetch("/api/qbo/invoice/query?status=unpaid");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || "Failed to load open invoices");
      }
      setOpenInvoices(data.invoices || []);
      setTimeout(() => window.print(), 150);
    } catch (error: any) {
      setOpenInvoiceError(error?.message || "Failed to load open invoices");
    } finally {
      setLoadingOpenInvoices(false);
    }
  };

  const totalPayrollCost = useMemo(
    () => team.reduce((sum, member) => sum + (Number(member.perPayrollCost) || 0), 0),
    [team]
  );

  const recentIncreases = useMemo(
    () => team.filter((member) => withinDays(member.lastIncreaseDate, 120)),
    [team]
  );

  const daysUntilPayroll = useMemo(() => {
    if (!payrollMeta?.nextPayrollDate) return 0;
    const today = new Date();
    const next = new Date(`${payrollMeta.nextPayrollDate}T00:00:00`);
    const diffDays = Math.ceil((next.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    return Math.max(diffDays, 0);
  }, [payrollMeta]);

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
      <style jsx global>{`
        @media print {
          .print-hidden {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
        }
      `}</style>
      <div className="flex min-h-screen">
        <Sidebar activePage="Payroll" />

        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
          <div className="mx-auto max-w-7xl px-8 py-8 space-y-10 print-hidden">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-blue-700">Payroll Overview</p>
                <h1 className="mt-2 text-3xl font-semibold text-slate-900">Payroll Costs & Team Members</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Live payroll view from QBO for the selected pay period.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs uppercase text-slate-500">Period start</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase text-slate-500">Period end</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
            </header>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <section className="lg:col-span-2 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Payroll Costs</h2>
                    <p className="text-xs text-slate-500">First names only • per-payroll estimate</p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {team.length} team members
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Member</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Type</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">Rate</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">Per Payroll</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading && (
                        <tr>
                          <td className="px-6 py-6 text-sm text-slate-500" colSpan={5}>
                            Loading payroll data from QBO…
                          </td>
                        </tr>
                      )}
                      {!loading && team.length === 0 && (
                        <tr>
                          <td className="px-6 py-6 text-sm text-slate-500" colSpan={5}>
                            No payroll data found for this period.
                          </td>
                        </tr>
                      )}
                      {!loading &&
                        team.map((member) => (
                          <tr key={member.id}>
                            <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                              {getFirstName(member.fullName)}
                              <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-600">
                                {member.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{member.role}</td>
                            <td className="px-6 py-4 text-sm text-slate-600">{member.type}</td>
                            <td className="px-6 py-4 text-sm text-right text-slate-700">
                              {member.rate > 0
                                ? member.type === "Hourly"
                                  ? `${formatCurrency(member.rate)}/hr`
                                  : `${formatCurrency(member.rate)}/yr`
                                : "—"}
                            </td>
                            <td className="px-6 py-4 text-sm text-right font-semibold text-slate-900">
                              {formatCurrency(member.perPayrollCost || 0)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="space-y-6">
                <section className="rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">Next Payroll</h2>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Pay period</span>
                      <span className="font-semibold text-slate-900">
                        {formatShortDate(payrollMeta?.payPeriodStart)} - {formatShortDate(payrollMeta?.payPeriodEnd)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Approvals due</span>
                      <span className="font-semibold text-slate-900">{formatShortDate(payrollMeta?.approvalsDue)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Payroll run</span>
                      <span className="font-semibold text-slate-900">{formatShortDate(payrollMeta?.payrollRun)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Next payroll</span>
                      <span className="font-semibold text-slate-900">
                        {formatShortDate(payrollMeta?.nextPayrollDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Estimated total</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(totalPayrollCost)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Cycle</span>
                      <span className="font-semibold text-slate-900">{payrollMeta?.payFrequency || "—"}</span>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      {daysUntilPayroll} days until payroll
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">Wage Increases</h2>
                  <p className="text-xs text-slate-500">Recent employee updates in QBO.</p>
                  <div className="mt-4 space-y-3">
                    {recentIncreases.map((member) => (
                      <div key={member.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-900">{getFirstName(member.fullName)}</p>
                          <span className="text-xs text-emerald-600 font-semibold">
                            {member.rate > 0
                              ? member.type === "Hourly"
                                ? `+${formatCurrency(member.rate)}/hr`
                                : `+${formatCurrency(member.rate)}/yr`
                              : "Updated"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{member.role}</p>
                        <p className="text-xs text-slate-400">Updated {formatShortDate(member.lastIncreaseDate)}</p>
                      </div>
                    ))}
                    {!loading && recentIncreases.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                        No recent wage updates found in QBO.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>

            <section id="commissions" className="scroll-mt-24 space-y-6">
              <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-blue-700">Commissions</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">Sales Commission Tracker</h2>
                  <p className="mt-1 text-sm text-slate-600">Track sales by rep for {monthYearDisplay}.</p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs uppercase text-slate-600">Month</label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-slate-600">Status</label>
                    <select
                      value={invoiceStatus}
                      onChange={(e) => setInvoiceStatus(e.target.value as "paid" | "unpaid" | "all")}
                      className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="all">All</option>
                    </select>
                  </div>
                  <button
                    onClick={startQboConnect}
                    className="mt-5 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-blue-700"
                    type="button"
                  >
                    Connect QuickBooks
                  </button>
                  <button
                    onClick={handlePrintOpenInvoices}
                    className="mt-5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-400"
                    type="button"
                  >
                    {loadingOpenInvoices ? "Loading Open Invoices…" : "Print Open Invoices"}
                  </button>
                </div>
              </header>

              {connectError && (
                <div className="rounded-lg bg-red-50 text-red-900 ring-1 ring-red-200 px-4 py-3 text-sm">
                  {connectError}
                </div>
              )}

              {openInvoiceError && (
                <div className="rounded-lg bg-red-50 text-red-900 ring-1 ring-red-200 px-4 py-3 text-sm">
                  {openInvoiceError}
                </div>
              )}

              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 md:col-span-4 lg:col-span-3 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <h3 className="text-lg font-semibold text-slate-900">Sales Reps</h3>
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
                          <p className="mt-1 text-3xl font-semibold text-slate-900">
                            ${money(selectedTotals.totalSales)}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">{selectedTotals.count} invoices</p>
                        </div>
                        {commissionData && (
                          <div>
                            <p className="text-xs uppercase text-slate-600">Commission Owed</p>
                            <p className="mt-1 text-3xl font-semibold text-green-600">
                              ${money(commissionData.total)}
                            </p>
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
            </section>
          </div>
          <div className="print-only hidden bg-white px-8 py-6 text-slate-900">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold">Open Invoices</h1>
              <p className="text-sm text-slate-600">Pulled from QBO • {openInvoices.length} invoices</p>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2">Invoice</th>
                  <th className="py-2">Customer</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Due</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {openInvoices.map((invoice) => (
                  <tr key={invoice.Id} className="text-sm">
                    <td className="py-2 font-semibold text-slate-900">{invoice.DocNumber || invoice.Id}</td>
                    <td className="py-2 text-slate-700">{invoice.CustomerRef?.name || "—"}</td>
                    <td className="py-2 text-slate-700">{formatDate(invoice.TxnDate)}</td>
                    <td className="py-2 text-slate-700">{formatDate(invoice.DueDate)}</td>
                    <td className="py-2 text-right text-slate-900">${money(invoice.TotalAmt)}</td>
                    <td className="py-2 text-right text-slate-900">${money(invoice.Balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {openInvoices.length === 0 && (
              <div className="py-6 text-sm text-slate-500">No open invoices found.</div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
