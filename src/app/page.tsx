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

interface VendorPaymentSummary {
  vendorName: string;
  totalPaid: number;
  paymentCount: number;
  lastTxnDate: string;
}

interface CustomerPayment {
  id: string;
  customerName: string;
  appliedAmount: number;
  totalAmount: number;
  txnDate: string;
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
  const [monthlyTotal, setMonthlyTotal] = useState<number>(0);
  const [loadingMonthlyTotal, setLoadingMonthlyTotal] = useState(true);
  const [partialPaidCount, setPartialPaidCount] = useState<number>(0);
  const [partialPaidRemaining, setPartialPaidRemaining] = useState<number>(0);
  const [paymentsTotal, setPaymentsTotal] = useState<number>(0);
  const [customerPaymentsToday, setCustomerPaymentsToday] = useState<CustomerPayment[]>([]);
  const [loadingCustomerPayments, setLoadingCustomerPayments] = useState(true);
  const [vendorPaymentsTotal, setVendorPaymentsTotal] = useState<number>(0);
  const [vendorPaymentsToday, setVendorPaymentsToday] = useState<VendorPaymentSummary[]>([]);
  const [loadingVendorPayments, setLoadingVendorPayments] = useState(true);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [loadingRecentInvoices, setLoadingRecentInvoices] = useState(true);
  const [recentPurchases, setRecentPurchases] = useState<RecentPurchase[]>([]);
  const [loadingRecentPurchases, setLoadingRecentPurchases] = useState(true);
  const [qboSyncStatus, setQboSyncStatus] = useState<"idle" | "ok" | "error">("idle");
  const [currentMonthTrend, setCurrentMonthTrend] = useState<number[]>([]);
  const [lastMonthTrend, setLastMonthTrend] = useState<number[]>([]);

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

  // Fetch sales for current month
  useEffect(() => {
    const fetchMonthlySales = async () => {
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
        const endDate = `${year}-${month}-${lastDay}`;

        const response = await fetch(
          `/api/qbo/invoice/query?startDate=${startDate}&endDate=${endDate}`
        );
        
        if (!response.ok) throw new Error("Failed to fetch monthly sales");
        
        const data = await response.json();
        const invoices = data.invoices || [];
        const totalSales = invoices.reduce((sum: number, inv: any) => sum + (Number(inv.TotalAmt) || 0), 0);

        console.log(`[dashboard] Monthly sales fetched: ${invoices.length} invoices, Total: $${totalSales}`);
        setMonthlyTotal(totalSales);
      } catch (error) {
        console.error("Error fetching monthly sales:", error);
        setMonthlyTotal(0);
      } finally {
        setLoadingMonthlyTotal(false);
      }
    };

    fetchMonthlySales();
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

  // Monthly performance comparison (last month vs this month)
  useEffect(() => {
    let isMounted = true;

    const buildCumulativeSeries = (invoices: any[], days: number, startDate: Date) => {
      const dailyTotals = Array.from({ length: days }, () => 0);

      invoices.forEach((inv: any) => {
        const date = new Date(inv.TxnDate);
        const dayIndex = Math.max(0, Math.min(days - 1, date.getDate() - 1));
        const total = Number(inv.TotalAmt) || 0;
        dailyTotals[dayIndex] += total;
      });

      const cumulative: number[] = [];
      let running = 0;
      for (let i = 0; i < days; i += 1) {
        running += dailyTotals[i];
        cumulative.push(running);
      }

      return cumulative;
    };

    const fetchMonthlyComparison = async () => {
      try {
        const today = new Date();
        const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const currentMonthEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const daysSoFar = today.getDate();

        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        const lastMonthDays = lastMonthEnd.getDate();
        const compareDays = Math.min(daysSoFar, lastMonthDays);

        const currentStart = currentMonthStart.toISOString().slice(0, 10);
        const currentEnd = currentMonthEnd.toISOString().slice(0, 10);
        const lastStart = lastMonthStart.toISOString().slice(0, 10);
        const lastEnd = new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth(), compareDays)
          .toISOString()
          .slice(0, 10);

        const [currentRes, lastRes] = await Promise.all([
          fetch(`/api/qbo/invoice/query?startDate=${currentStart}&endDate=${currentEnd}&status=paid&_=${Date.now()}`),
          fetch(`/api/qbo/invoice/query?startDate=${lastStart}&endDate=${lastEnd}&status=paid&_=${Date.now()}`),
        ]);

        if (!currentRes.ok || !lastRes.ok) {
          console.error("Monthly comparison fetch failed:", currentRes.status, lastRes.status);
          throw new Error("Failed to fetch monthly comparison");
        }

        const currentData = await currentRes.json();
        const lastData = await lastRes.json();

        const currentInvoices = currentData.invoices || [];
        const lastInvoices = lastData.invoices || [];

        console.log(`[dashboard] Monthly data - current: ${currentInvoices.length} invoices, last month: ${lastInvoices.length} invoices`);

        const currentSeries = buildCumulativeSeries(currentInvoices, daysSoFar, currentMonthStart);
        const lastSeries = buildCumulativeSeries(lastInvoices, compareDays, lastMonthStart);

        if (isMounted) {
          setCurrentMonthTrend(currentSeries);
          setLastMonthTrend(lastSeries);
        }
      } catch (error) {
        console.error("Failed to fetch monthly comparison:", error);
        if (isMounted) {
          setCurrentMonthTrend([]);
          setLastMonthTrend([]);
        }
      }
    };

    fetchMonthlyComparison();
    const interval = setInterval(fetchMonthlyComparison, 60000); // Refresh every minute

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch payments made today (live tracking)
  useEffect(() => {
    let isMounted = true;

    const fetchPaymentsToday = async () => {
      setLoadingCustomerPayments(true);
      try {
        const today = new Date().toLocaleDateString("en-CA");
        const res = await fetch(`/api/qbo/payment/query?startDate=${today}&endDate=${today}&_=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to fetch payments");
        const data = await res.json();
        const payments = data.payments || [];

        let totalApplied = 0;
        const itemizedPayments: CustomerPayment[] = [];

        payments.forEach((payment: any) => {
          const total = Number(payment.TotalAmt) || 0;
          const unapplied = Number(payment.UnappliedAmt) || 0;
          const applied = Math.max(total - unapplied, 0);
          if (applied <= 0) return;
          totalApplied += applied;
          const customerName = payment.CustomerRef?.name || payment.CustomerRef?.value || 'Unknown';
          itemizedPayments.push({
            id: payment.Id,
            customerName: customerName,
            appliedAmount: applied,
            totalAmount: total,
            txnDate: payment.TxnDate || today,
          });
        });

        if (isMounted) {
          setPaymentsTotal(totalApplied);
          setCustomerPaymentsToday(itemizedPayments);
          setLoadingCustomerPayments(false);
        }
      } catch (error) {
        console.error("Failed to fetch payments today:", error);
        if (isMounted) {
          setPaymentsTotal(0);
          setCustomerPaymentsToday([]);
          setLoadingCustomerPayments(false);
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
      setLoadingVendorPayments(true);
      try {
        const today = new Date().toLocaleDateString("en-CA");
        const res = await fetch(`/api/qbo/bill-payment/query?startDate=${today}&endDate=${today}&_=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to fetch vendor payments");
        const data = await res.json();
        const payments = data.payments || [];

        const summaryMap = new Map<string, VendorPaymentSummary>();
        let totalPaid = 0;

        payments.forEach((payment: any) => {
          const paid = Number(payment.TotalAmt) || 0;
          if (paid <= 0) return;

          const vendorName =
            payment.VendorRef?.name ||
            payment.PayeeRef?.name ||
            "Unknown Vendor";

          totalPaid += paid;

          const existing = summaryMap.get(vendorName);
          if (existing) {
            existing.totalPaid += paid;
            existing.paymentCount += 1;
            if (payment.TxnDate && payment.TxnDate > existing.lastTxnDate) {
              existing.lastTxnDate = payment.TxnDate;
            }
          } else {
            summaryMap.set(vendorName, {
              vendorName,
              totalPaid: paid,
              paymentCount: 1,
              lastTxnDate: payment.TxnDate || today,
            });
          }
        });

        const summary = Array.from(summaryMap.values()).sort((a, b) => b.totalPaid - a.totalPaid);

        if (isMounted) {
          setVendorPaymentsToday(summary);
          setVendorPaymentsTotal(totalPaid);
        }
      } catch (error) {
        console.error("Failed to fetch vendor payments today:", error);
        if (isMounted) {
          setVendorPaymentsToday([]);
          setVendorPaymentsTotal(0);
        }
      } finally {
        if (isMounted) setLoadingVendorPayments(false);
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
          <div className="mx-auto max-w-7xl px-8 py-4 space-y-8">
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
                <div className="text-xs uppercase font-semibold text-slate-500">Sales This Month</div>
                <div className="mt-2 text-2xl font-bold text-emerald-700">
                  {loadingMonthlyTotal ? <span className="text-slate-400">Loading...</span> : `$${money(monthlyTotal)}`}
                </div>
                <div className="mt-1 text-xs text-slate-600">{(monthlyTotal / monthlyGoal * 100).toFixed(1)}% of goal</div>
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
                    <p className="text-sm text-slate-600">Last month vs this month (so far)</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    {money(totalSales)} of {money(monthlyGoal)}
                  </div>
                </div>
                <div className="mt-6">
                  {currentMonthTrend.length === 0 && lastMonthTrend.length === 0 ? (
                    <div className="h-32 flex items-center justify-center bg-slate-50 rounded-lg text-sm text-slate-500">
                      Loading trend data...
                    </div>
                  ) : (
                    <>
                      <svg viewBox="0 0 320 140" className="h-32 w-full">
                        {lastMonthTrend.length > 0 && (
                          <path
                            d={buildLinePath(lastMonthTrend, Math.max(...lastMonthTrend.filter(v => v !== null && v !== undefined), 1), 320, 140, 12)}
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth="3"
                          />
                        )}
                        {currentMonthTrend.length > 0 && (
                          <path
                            d={buildLinePath(currentMonthTrend, Math.max(...currentMonthTrend.filter(v => v !== null && v !== undefined), 1), 320, 140, 12)}
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="3"
                          />
                        )}
                      </svg>
                      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-slate-400" />
                          Last month
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-600" />
                          This month
                        </span>
                      </div>
                    </>
                  )}
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
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
                <div className="border-b border-slate-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-slate-900">Customer Payments Today</h2>
                  <p className="text-sm text-slate-600">Payments received from customers today</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Customer</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Applied</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingCustomerPayments ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-6 text-center text-slate-500">Loading...</td>
                        </tr>
                      ) : customerPaymentsToday.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-6 text-center text-slate-500">No customer payments received today</td>
                        </tr>
                      ) : (
                        customerPaymentsToday.map((payment) => (
                          <tr key={payment.id} className="hover:bg-slate-50">
                            <td className="px-6 py-3 font-medium text-slate-900">{payment.customerName}</td>
                            <td className="px-6 py-3 text-right font-semibold text-emerald-700">${money(payment.appliedAmount)}</td>
                            <td className="px-6 py-3 text-right text-slate-600">${money(payment.totalAmount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
                <div className="border-b border-slate-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-slate-900">Vendors Paid Today</h2>
                  <p className="text-sm text-slate-600">Payments our company made today</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Vendor</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Payments</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Amount Paid</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Last Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingVendorPayments ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-6 text-center text-slate-500">Loading...</td>
                        </tr>
                      ) : vendorPaymentsToday.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-6 text-center text-slate-500">No vendor payments recorded today</td>
                        </tr>
                      ) : (
                        vendorPaymentsToday.map((payment) => (
                          <tr key={payment.vendorName} className="hover:bg-slate-50">
                            <td className="px-6 py-3 font-medium text-slate-900">{payment.vendorName}</td>
                            <td className="px-6 py-3 text-right text-slate-600">{payment.paymentCount}</td>
                            <td className="px-6 py-3 text-right font-semibold text-indigo-700">${money(payment.totalPaid)}</td>
                            <td className="px-6 py-3 text-right text-slate-600">{payment.lastTxnDate}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
