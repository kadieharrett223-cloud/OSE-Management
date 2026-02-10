"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { getCommissionDateRange, getCurrentCommissionMonth } from "@/lib/commission-dates";

const money = (value: number | undefined) => {
  if (value === undefined || value === null || isNaN(value)) return "0.00";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface RepData {
  repName: string;
  isPrimary: boolean;
  totalSales: number;
  commission: number;
  invoiceCount: number;
  commissionRate: number;
  bonusProgress?: {
    salesAmount: number;
    bonusThreshold: number;
    percentToThreshold: number;
    hasEarnedBonus: boolean;
  };
}

interface RecentInvoice {
  id: string;
  docNumber: string;
  customerName: string;
  totalAmt: number;
  balance: number;
  txnDate: string;
  status: "Paid" | "Open";
}

interface RecentPurchase {
  id: string;
  poNumber: string;
  vendorName: string;
  totalAmount: number;
  status: string;
  orderDate: string;
}

const mockReps = [
  {
    id: 1,
    name: "Sarah Johnson",
    region: "East Coast",
    sales: 125000,
    commission: 6250,
    orders: 42,
  },
  {
    id: 2,
    name: "Mike Chen",
    region: "West Coast",
    sales: 98500,
    commission: 4925,
    orders: 35,
  },
  {
    id: 3,
    name: "Jessica Martinez",
    region: "South",
    sales: 102300,
    commission: 5115,
    orders: 38,
  },
  {
    id: 4,
    name: "James Wilson",
    region: "Midwest",
    sales: 87600,
    commission: 4380,
    orders: 29,
  },
];

type LineSeries = Array<number | null>;

const buildLinePath = (values: LineSeries, maxValue: number, width: number, height: number, padding: number) => {
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const stepX = values.length > 1 ? usableWidth / (values.length - 1) : 0;

  let path = "";
  values.forEach((val, idx) => {
    if (val === null || val === undefined) return;
    const x = padding + stepX * idx;
    const y = padding + (1 - (maxValue > 0 ? val / maxValue : 0)) * usableHeight;
    if (!path) {
      path = `M ${x.toFixed(2)} ${y.toFixed(2)}`;
    } else {
      path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
  });

  return path;
};

export default function Dashboard() {
  const [monthlyGoal, setMonthlyGoal] = useState<number>(430000);
  const [qboSales, setQboSales] = useState<number | null>(null);
  const [ytdSales, setYtdSales] = useState<number | null>(null);
  const [loadingYtd, setLoadingYtd] = useState(true);
  const [repSalesData, setRepSalesData] = useState<RepData[]>([]);
  const [outstandingTotal, setOutstandingTotal] = useState<number>(0);
  const [outstandingCount, setOutstandingCount] = useState<number>(0);
  const [partialPaidCount, setPartialPaidCount] = useState<number>(0);
  const [partialPaidRemaining, setPartialPaidRemaining] = useState<number>(0);
  const [paymentsTotal, setPaymentsTotal] = useState<number>(0);
  const [vendorPaymentsTotal, setVendorPaymentsTotal] = useState<number>(0);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [loadingRecentInvoices, setLoadingRecentInvoices] = useState(true);
  const [recentPurchases, setRecentPurchases] = useState<RecentPurchase[]>([]);
  const [loadingRecentPurchases, setLoadingRecentPurchases] = useState(true);
  const [qboSyncStatus, setQboSyncStatus] = useState<"idle" | "ok" | "error">("idle");
  const [salesTrend, setSalesTrend] = useState<number[]>([]);

  // Fetch monthly goal
  useEffect(() => {
    let isMounted = true;
    fetch(`/api/goals/monthly`)
      .then(async (res) => {
        if (!res.ok) return null;
        const payload = await res.json().catch(() => null);
        return payload?.goal ?? null;
      })
      .then((goal) => {
        if (!isMounted || !goal?.goal_amount) return;
        const value = Number(goal.goal_amount);
        setMonthlyGoal(value);
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch QuickBooks invoice data for current month
  useEffect(() => {
    let isMounted = true;
    const currentMonth = getCurrentCommissionMonth();
    const { startDate, endDate } = getCommissionDateRange(currentMonth);
    
    // Fetch total sales
    fetch(`/api/qbo/invoice/query?startDate=${startDate}&endDate=${endDate}&status=paid`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch invoices');
        return await res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data.ok) {
          setQboSales(data.totalPaid || 0);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch QBO invoices:', err);
      })
      .finally(() => undefined);

    // Fetch sales by rep (for totals)
    fetch(`/api/qbo/invoice/sales-by-rep?startDate=${startDate}&endDate=${endDate}&status=paid`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch sales by rep');
        return await res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data.ok && data.reps) {
          setRepSalesData(data.reps);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch rep sales:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const totalSales = qboSales !== null ? qboSales : mockReps.reduce((sum, rep) => sum + rep.sales, 0);
  const totalCommission = repSalesData.length > 0
    ? repSalesData.reduce((sum, rep) => sum + rep.commission, 0)
    : mockReps.reduce((sum, rep) => sum + rep.commission, 0);
  const percentOfGoal = monthlyGoal > 0 ? Math.round((totalSales / monthlyGoal) * 100) : 0;
  const attentionItems = [
    outstandingCount > 0
      ? `Outstanding invoices: $${money(outstandingTotal)} across ${outstandingCount} open invoices.`
      : null,
    partialPaidCount > 0
      ? `Partially paid invoices: ${partialPaidCount} open with $${money(partialPaidRemaining)} remaining.`
      : null,
    qboSyncStatus === "error" ? "QuickBooks sync needs attention. Check connection." : null,
    paymentsTotal > 0 ? `Payments received today: $${money(paymentsTotal)}.` : null,
    vendorPaymentsTotal > 0 ? `Vendor payments sent today: $${money(vendorPaymentsTotal)}.` : null,
  ].filter(Boolean) as string[];

  // Fetch unpaid invoices for current month
  useEffect(() => {
    const fetchUnpaidInvoices = async () => {
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
        const endDate = `${year}-${month}-${lastDay}`;

        const response = await fetch(
          `/api/qbo/invoice/query?startDate=${startDate}&endDate=${endDate}&status=unpaid`
        );
        
        if (!response.ok) throw new Error("Failed to fetch unpaid invoices");
        
        const data = await response.json();
        const invoices = data.invoices || [];
        const totalOutstanding = invoices.reduce((sum: number, inv: any) => sum + (Number(inv.Balance) || 0), 0);

        console.log(`[dashboard] Unpaid invoices fetched: ${invoices.length} invoices`);
        setOutstandingCount(invoices.length);
        setOutstandingTotal(totalOutstanding);
      } catch (error) {
        console.error("Error fetching unpaid invoices:", error);
        setOutstandingCount(0);
        setOutstandingTotal(0);
      }
    };

    fetchUnpaidInvoices();
  }, []);

  // Fetch partially paid invoices for current month
  useEffect(() => {
    const fetchPartialPaidInvoices = async () => {
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
        const endDate = `${year}-${month}-${lastDay}`;

        const response = await fetch(
          `/api/qbo/invoice/query?startDate=${startDate}&endDate=${endDate}&status=unpaid`
        );

        if (!response.ok) throw new Error("Failed to fetch invoices");

        const data = await response.json();
        const invoices = data.invoices || [];

        let count = 0;
        let remaining = 0;

        invoices.forEach((inv: any) => {
          const total = Number(inv.TotalAmt) || 0;
          const balance = Number(inv.Balance) || 0;
          const paid = total - balance;
          if (paid > 0 && balance > 0) {
            count += 1;
            remaining += balance;
          }
        });

        setPartialPaidCount(count);
        setPartialPaidRemaining(remaining);
      } catch (error) {
        console.error("Error fetching partial paid invoices:", error);
        setPartialPaidCount(0);
        setPartialPaidRemaining(0);
      }
    };

    fetchPartialPaidInvoices();
  }, []);

  // Fetch year-to-date paid sales
  useEffect(() => {
    let isMounted = true;
    const fetchYtdSales = async () => {
      setLoadingYtd(true);
      try {
        const now = new Date();
        const year = now.getFullYear();
        const startDate = `${year}-01-01`;
        const endDate = now.toISOString().slice(0, 10);
        const res = await fetch(`/api/qbo/invoice/query?startDate=${startDate}&endDate=${endDate}&status=paid`);
        if (!res.ok) throw new Error("Failed to fetch YTD sales");
        const data = await res.json();
        if (isMounted) {
          setYtdSales(Number(data.totalPaid || 0));
        }
      } catch (error) {
        console.error("Failed to fetch YTD sales:", error);
        if (isMounted) setYtdSales(null);
      } finally {
        if (isMounted) setLoadingYtd(false);
      }
    };

    fetchYtdSales();
    return () => {
      isMounted = false;
    };
  }, []);

  // QuickBooks connectivity status check
  useEffect(() => {
    let isMounted = true;

    const checkQboStatus = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const res = await fetch(`/api/qbo/invoice/query?startDate=${today}&endDate=${today}`);
        if (!res.ok) throw new Error("QBO status check failed");
        if (isMounted) setQboSyncStatus("ok");
      } catch (error) {
        console.error("Failed QBO status check:", error);
        if (isMounted) setQboSyncStatus("error");
      }
    };

    checkQboStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  // Recent invoices (last 30 days)
  useEffect(() => {
    let isMounted = true;

    const fetchRecentInvoices = async () => {
      setLoadingRecentInvoices(true);
      try {
        const endDate = new Date().toISOString().slice(0, 10);
        const start = new Date();
        start.setDate(start.getDate() - 30);
        const startDate = start.toISOString().slice(0, 10);
        const res = await fetch(`/api/qbo/invoice/query?startDate=${startDate}&endDate=${endDate}`);
        if (!res.ok) throw new Error("Failed to fetch recent invoices");
        const data = await res.json();
        const invoices = (data.invoices || []).slice(0, 5).map((inv: any) => {
          const balance = Number(inv.Balance) || 0;
          return {
            id: inv.Id,
            docNumber: inv.DocNumber,
            customerName: inv.CustomerRef?.name || "Unknown",
            totalAmt: Number(inv.TotalAmt) || 0,
            balance,
            txnDate: inv.TxnDate,
            status: balance <= 0 ? "Paid" : "Open",
          } as RecentInvoice;
        });

        if (isMounted) setRecentInvoices(invoices);
      } catch (error) {
        console.error("Failed to fetch recent invoices:", error);
        if (isMounted) setRecentInvoices([]);
      } finally {
        if (isMounted) setLoadingRecentInvoices(false);
      }
    };

    fetchRecentInvoices();
    return () => {
      isMounted = false;
    };
  }, []);

  // Recent purchases (latest purchase orders)
  useEffect(() => {
    let isMounted = true;

    const fetchRecentPurchases = async () => {
      setLoadingRecentPurchases(true);
      try {
        const res = await fetch(`/api/purchase-orders`);
        if (!res.ok) throw new Error("Failed to fetch recent purchases");
        const data = await res.json();
        const purchases = (data.data || []).slice(0, 5).map((po: any) => ({
          id: po.id,
          poNumber: po.po_number,
          vendorName: po.vendor_name || "Unknown",
          totalAmount: Number(po.total_amount) || 0,
          status: po.status || "UNKNOWN",
          orderDate: po.order_date,
        })) as RecentPurchase[];

        if (isMounted) setRecentPurchases(purchases);
      } catch (error) {
        console.error("Failed to fetch recent purchases:", error);
        if (isMounted) setRecentPurchases([]);
      } finally {
        if (isMounted) setLoadingRecentPurchases(false);
      }
    };

    fetchRecentPurchases();
    return () => {
      isMounted = false;
    };
  }, []);

  // Monthly sales trend (last 8 months)
  useEffect(() => {
    let isMounted = true;

    const fetchSalesTrend = async () => {
      try {
        const end = new Date();
        const endDate = end.toISOString().slice(0, 10);
        const start = new Date(end.getFullYear(), end.getMonth() - 7, 1);
        const startDate = start.toISOString().slice(0, 10);
        const res = await fetch(`/api/qbo/invoice/monthly?startDate=${startDate}&endDate=${endDate}`);
        if (!res.ok) throw new Error("Failed to fetch monthly trend");
        const data = await res.json();
        const monthlyPaid = data.monthlyPaid || {};

        const series: number[] = [];
        for (let i = 7; i >= 0; i -= 1) {
          const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          series.push(Number(monthlyPaid[key] || 0));
        }

        if (isMounted) setSalesTrend(series);
      } catch (error) {
        console.error("Failed to fetch sales trend:", error);
        if (isMounted) setSalesTrend([]);
      }
    };

    fetchSalesTrend();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch payments made today (live tracking)
  useEffect(() => {
    let isMounted = true;

    const fetchPaymentsToday = async () => {
      try {
        const today = new Date().toLocaleDateString("en-CA");
        const res = await fetch(`/api/qbo/payment/query?startDate=${today}&endDate=${today}&_=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to fetch payments");
        const data = await res.json();
        const payments = data.payments || [];

        let totalApplied = 0;

        payments.forEach((payment: any) => {
          const total = Number(payment.TotalAmt) || 0;
          const unapplied = Number(payment.UnappliedAmt) || 0;
          const applied = Math.max(total - unapplied, 0);
          if (applied <= 0) return;
          totalApplied += applied;
        });

        if (isMounted) {
          setPaymentsTotal(totalApplied);
        }
      } catch (error) {
        console.error("Failed to fetch payments today:", error);
        if (isMounted) {
          setPaymentsTotal(0);
        }
      }
    };

    fetchPaymentsToday();
    const interval = setInterval(fetchPaymentsToday, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch payments made to vendors today (live tracking)
  useEffect(() => {
    let isMounted = true;

    const fetchVendorPaymentsToday = async () => {
      try {
        const today = new Date().toLocaleDateString("en-CA");
        const res = await fetch(`/api/qbo/bill-payment/query?startDate=${today}&endDate=${today}&_=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to fetch vendor payments");
        const data = await res.json();
        const payments = data.payments || [];

        let totalPaid = 0;

        payments.forEach((payment: any) => {
          const paid = Number(payment.TotalAmt) || 0;
          if (paid <= 0) return;
          totalPaid += paid;
        });

        if (isMounted) {
          setVendorPaymentsTotal(totalPaid);
        }
      } catch (error) {
        console.error("Failed to fetch vendor payments today:", error);
        if (isMounted) {
          setVendorPaymentsTotal(0);
        }
      }
    };

    fetchVendorPaymentsToday();
    const interval = setInterval(fetchVendorPaymentsToday, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Dashboard" />
        {/* Main Content */}
        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900">
          <div className="mx-auto max-w-7xl px-8 py-10 space-y-8">
            {/* Header */}
            <header className="flex flex-col gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-700">Dashboard</p>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold text-slate-900">Company Performance</h1>
                  <p className="max-w-2xl text-sm text-slate-600">
                    Business health at a glance with monthly trends, action items, and recent activity.
                  </p>
                </div>
              </div>
            </header>

            {/* Business Health Snapshot */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
                <div className="text-xs uppercase font-semibold text-slate-500">YTD Sales</div>
                <div className="mt-2 text-2xl font-bold text-emerald-700">
                  {loadingYtd ? <span className="text-slate-400">Loading...</span> : `$${money(ytdSales ?? 0)}`}
                </div>
                <div className="mt-1 text-xs text-slate-600">{percentOfGoal}% of goal pace</div>
              </div>

              <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
                <div className="text-xs uppercase font-semibold text-slate-500">Outstanding Invoices</div>
                <div className="mt-2 text-2xl font-bold text-amber-700">${money(outstandingTotal)}</div>
                <div className="mt-1 text-xs text-slate-600">{outstandingCount} open invoices</div>
              </div>

              <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
                <div className="text-xs uppercase font-semibold text-slate-500">Customer Payments Today</div>
                <div className="mt-2 text-2xl font-bold text-emerald-700">${money(paymentsTotal)}</div>
                <div className="mt-1 text-xs text-slate-600">Customers paying us today</div>
              </div>


              <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
                <div className="text-xs uppercase font-semibold text-slate-500">Last Sync Status</div>
                <div className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-900">
                  <span className={`h-2.5 w-2.5 rounded-full ${qboSyncStatus === "ok" ? "bg-emerald-500" : qboSyncStatus === "error" ? "bg-red-500" : "bg-slate-300"}`} />
                  {qboSyncStatus === "ok" ? "QB Sync ✅" : qboSyncStatus === "error" ? "QB Sync ⚠️" : "Checking"}
                </div>
                <div className="mt-1 text-xs text-slate-600">Data reliability check</div>
              </div>
            </div>

            {/* Main Visual + Action Required */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl bg-white p-6 shadow-md ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Monthly Performance</h2>
                    <p className="text-sm text-slate-600">Sales trend (last 8 months)</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    {money(totalSales)} of {money(monthlyGoal)}
                  </div>
                </div>
                <div className="mt-6">
                  <svg viewBox="0 0 320 140" className="h-32 w-full">
                    <path
                      d={buildLinePath(salesTrend, Math.max(...salesTrend, 1), 320, 140, 12)}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="3"
                    />
                  </svg>
                </div>
              </div>

              <div className="rounded-xl bg-white p-6 shadow-md ring-1 ring-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">Needs Attention</h2>
                <p className="text-sm text-slate-600">What matters right now</p>
                <div className="mt-4 space-y-3">
                  {attentionItems.length === 0 ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      All clear. No urgent items.
                    </div>
                  ) : (
                    attentionItems.map((item, idx) => (
                      <div key={`${item}-${idx}`} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        {item}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Quick Tables */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
                <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Recent Invoices</h2>
                    <p className="text-sm text-slate-600">Last 30 days</p>
                  </div>
                  <a href="/commissions" className="text-sm text-blue-600 hover:text-blue-700">View all →</a>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-6 py-3 text-left font-semibold">Invoice</th>
                        <th className="px-6 py-3 text-left font-semibold">Customer</th>
                        <th className="px-6 py-3 text-right font-semibold">Total</th>
                        <th className="px-6 py-3 text-right font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingRecentInvoices ? (
                        <tr><td colSpan={4} className="px-6 py-6 text-center text-slate-500">Loading...</td></tr>
                      ) : recentInvoices.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-6 text-center text-slate-500">No recent invoices</td></tr>
                      ) : (
                        recentInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="px-6 py-3 font-mono text-slate-700">{inv.docNumber}</td>
                            <td className="px-6 py-3 text-slate-700">{inv.customerName}</td>
                            <td className="px-6 py-3 text-right text-slate-700">${money(inv.totalAmt)}</td>
                            <td className="px-6 py-3 text-right">
                              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${inv.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
                <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Recent Purchases</h2>
                    <p className="text-sm text-slate-600">Latest purchase orders</p>
                  </div>
                  <a href="/admin/purchasing" className="text-sm text-blue-600 hover:text-blue-700">View all →</a>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-6 py-3 text-left font-semibold">PO</th>
                        <th className="px-6 py-3 text-left font-semibold">Vendor</th>
                        <th className="px-6 py-3 text-right font-semibold">Total</th>
                        <th className="px-6 py-3 text-right font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingRecentPurchases ? (
                        <tr><td colSpan={4} className="px-6 py-6 text-center text-slate-500">Loading...</td></tr>
                      ) : recentPurchases.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-6 text-center text-slate-500">No recent purchases</td></tr>
                      ) : (
                        recentPurchases.map((po) => (
                          <tr key={po.id} className="hover:bg-slate-50">
                            <td className="px-6 py-3 font-mono text-slate-700">{po.poNumber}</td>
                            <td className="px-6 py-3 text-slate-700">{po.vendorName}</td>
                            <td className="px-6 py-3 text-right text-slate-700">${money(po.totalAmount)}</td>
                            <td className="px-6 py-3 text-right">
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                {po.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Bottom Listed Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
                <div className="text-xs uppercase font-semibold text-slate-500">Vendors Paid Today</div>
                <div className="mt-2 text-2xl font-bold text-indigo-700">${money(vendorPaymentsTotal)}</div>
                <div className="mt-1 text-xs text-slate-600">Payments we made today</div>
              </div>
              <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
                <div className="text-xs uppercase font-semibold text-slate-500">Partial Paid Remaining</div>
                <div className="mt-2 text-2xl font-bold text-amber-700">${money(partialPaidRemaining)}</div>
                <div className="mt-1 text-xs text-slate-600">{partialPaidCount} invoices still open</div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
