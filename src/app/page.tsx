"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopSkuChart } from "@/components/TopSkuChart";
import { getCommissionDateRange, getCurrentCommissionMonth } from "@/lib/commission-dates";

const money = (value: number | undefined) => {
  if (value === undefined || value === null || isNaN(value)) return "0.00";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const normalizePayoutStatus = (status: string | null | undefined) =>
  String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

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

interface PartialPaidInvoice {
  id: string;
  docNumber: string;
  customerName: string;
  txnDate: string;
  totalAmt: number;
  paidAmt: number;
  balance: number;
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

interface IncomingDeposit {
  id: string;
  created: string;
  status: string;
  amount: number;
  currency: string;
  cardName: string;
  cardLast4: string;
  cardType: string;
}

interface ShopifyPayout {
  id: number;
  date: string;
  currency: string;
  amount: string;
  status: string;
}

interface ShopifyOrderWithDeposit {
  id: number;
  name: string;
  created_at: string;
  total_price: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer?: { first_name?: string; last_name?: string; email?: string };
  pendingDepositId: number | null;
  pendingDepositStatus: string | null;
  netAmount: string | null;
  fee: string | null;
  processedAt: string | null;
  payoutDate: string | null;
  payoutAmount: string | null;
  payoutCurrency: string | null;
  transactionType: string | null;
}

type SalesReportRange = "ytd" | "this-week" | "last-week" | "this-month" | "last-month";

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

const buildAreaPath = (values: LineSeries, maxValue: number, width: number, height: number, padding: number) => {
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const stepX = values.length > 1 ? usableWidth / (values.length - 1) : 0;

  let path = "";
  let firstX = 0;
  let lastX = 0;

  values.forEach((val, idx) => {
    if (val === null || val === undefined) return;
    const x = padding + stepX * idx;
    const y = padding + (1 - (maxValue > 0 ? val / maxValue : 0)) * usableHeight;
    if (!path) {
      path = `M ${x.toFixed(2)} ${y.toFixed(2)}`;
      firstX = x;
    } else {
      path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    lastX = x;
  });

  if (!path) return "";
  const bottomY = padding + usableHeight;
  path += ` L ${lastX.toFixed(2)} ${bottomY.toFixed(2)} L ${firstX.toFixed(2)} ${bottomY.toFixed(2)} Z`;
  return path;
};

const getInitials = (name: string) => {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const useCountUp = (value: number, duration = 200) => {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const from = previousValue.current;
    const to = value;
    previousValue.current = value;

    if (from === to) {
      setDisplayValue(value);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const next = from + (to - from) * progress;
      setDisplayValue(next);
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return displayValue;
};

const toYmdLocal = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function Dashboard() {
  const [qboSales, setQboSales] = useState<number | null>(null);
  const [repSalesData, setRepSalesData] = useState<RepData[]>([]);
  const [outstandingTotal, setOutstandingTotal] = useState<number>(0);
  const [outstandingCount, setOutstandingCount] = useState<number>(0);
  const [monthlyTotal, setMonthlyTotal] = useState<number>(0);
  const [salesTodayTotal, setSalesTodayTotal] = useState<number>(0);
  const [salesWeekTotal, setSalesWeekTotal] = useState<number>(0);
  const [loadingMonthlyTotal, setLoadingMonthlyTotal] = useState(true);
  const [lastMonthTotal, setLastMonthTotal] = useState<number>(0);
  const [loadingLastMonthTotal, setLoadingLastMonthTotal] = useState(true);
  const [paidExpensesTotal, setPaidExpensesTotal] = useState<number>(0);
  const [loadingProfit, setLoadingProfit] = useState(true);
  const [topExpenses, setTopExpenses] = useState<Array<{ name: string; total: number }>>([]);
  const [partialPaidCount, setPartialPaidCount] = useState<number>(0);
  const [partialPaidRemaining, setPartialPaidRemaining] = useState<number>(0);
  const [partialPaidInvoices, setPartialPaidInvoices] = useState<PartialPaidInvoice[]>([]);
  const [loadingPartialPaidInvoices, setLoadingPartialPaidInvoices] = useState(true);
  const [paymentsTotal, setPaymentsTotal] = useState<number>(0);
  const [customerPaymentsToday, setCustomerPaymentsToday] = useState<CustomerPayment[]>([]);
  const [loadingCustomerPayments, setLoadingCustomerPayments] = useState(true);
  const [showCustomerPaymentsModal, setShowCustomerPaymentsModal] = useState(false);
  const [vendorPaymentsTotal, setVendorPaymentsTotal] = useState<number>(0);
  const [vendorPaymentsToday, setVendorPaymentsToday] = useState<VendorPaymentSummary[]>([]);
  const [loadingVendorPayments, setLoadingVendorPayments] = useState(true);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [loadingRecentInvoices, setLoadingRecentInvoices] = useState(true);
  const [showOpenInvoicesModal, setShowOpenInvoicesModal] = useState(false);
  const [showPartialPaidModal, setShowPartialPaidModal] = useState(false);
  const [printingOpenInvoices, setPrintingOpenInvoices] = useState(false);
  const [printingPartialPaid, setPrintingPartialPaid] = useState(false);
  const [printPartialPaidError, setPrintPartialPaidError] = useState<string | null>(null);
  const [printOpenInvoicesError, setPrintOpenInvoicesError] = useState<string | null>(null);
  const [recentPurchases, setRecentPurchases] = useState<RecentPurchase[]>([]);
  const [loadingRecentPurchases, setLoadingRecentPurchases] = useState(true);
  const [qboSyncStatus, setQboSyncStatus] = useState<"idle" | "ok" | "error">("idle");
  const [currentMonthTrend, setCurrentMonthTrend] = useState<number[]>([]);
  const [lastMonthTrend, setLastMonthTrend] = useState<number[]>([]);
  const [expenseTrend, setExpenseTrend] = useState<number[]>([]);

  // Incoming deposits state
  const [incomingDepositsTotal, setIncomingDepositsTotal] = useState<number>(0);
  const [incomingDeposits, setIncomingDeposits] = useState<IncomingDeposit[]>([]);
  const [loadingIncomingDeposits, setLoadingIncomingDeposits] = useState(true);
  const [showIncomingDepositsModal, setShowIncomingDepositsModal] = useState(false);

  const [showDepositsModal, setShowDepositsModal] = useState(false);

  // Shopify payouts state
  const [shopifyPayouts, setShopifyPayouts] = useState<ShopifyPayout[]>([]);
  const [shopifyOrders, setShopifyOrders] = useState<ShopifyOrderWithDeposit[]>([]);
  const [shopifyBalance, setShopifyBalance] = useState<{ amount: string; currency: string } | null>(null);
  const [shopifyPaymentsEnabled, setShopifyPaymentsEnabled] = useState(true);
  const [loadingShopifyPayouts, setLoadingShopifyPayouts] = useState(true);
  const [showShopifyPayoutsModal, setShowShopifyPayoutsModal] = useState(false);
  const [shopifyPayoutDiagnostics, setShopifyPayoutDiagnostics] = useState<string | null>(null);
  const [printReportError, setPrintReportError] = useState<string | null>(null);
  const [salesReportRange, setSalesReportRange] = useState<SalesReportRange>("ytd");

  const scheduledShopifyPayouts = shopifyPayouts.filter((payout) => {
    const status = normalizePayoutStatus(payout.status);
    return status === "scheduled" || status === "in_transit";
  });

  // Compute derived values first (needed for animated count-ups)
  const totalExpenses = paidExpensesTotal;
  const profitThisMonth = monthlyTotal - totalExpenses;

  // Animated values using count-up hook
  const animatedSalesTodayTotal = useCountUp(salesTodayTotal);
  const animatedMonthlyTotal = useCountUp(monthlyTotal);
  const animatedSalesWeekTotal = useCountUp(salesWeekTotal);
  const animatedProfitThisMonth = useCountUp(profitThisMonth);
  const animatedTotalExpenses = useCountUp(totalExpenses);

  const getLocalDateYmd = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Single consolidated dashboard fetch — replaces all individual QBO useEffects
  useEffect(() => {
    let isMounted = true;

    const fetchSummary = async () => {
      try {
        setLoadingMonthlyTotal(true);
        setLoadingLastMonthTotal(true);
        setLoadingProfit(true);
        setLoadingPartialPaidInvoices(true);
        setLoadingRecentInvoices(true);
        setLoadingRecentPurchases(true);
        setLoadingCustomerPayments(true);
        setLoadingVendorPayments(true);

        const res = await fetch(`/api/dashboard/summary?_=${Date.now()}`);
        if (!res.ok) throw new Error("Dashboard summary fetch failed");
        const data = await res.json();
        if (!isMounted || !data.ok) return;

        // Use the combined total (Payment records + fully-paid invoices dated today)
        // so this card matches what "Customer Payments Today" shows.
        setSalesTodayTotal(data.paymentsTotal ?? data.salesToday ?? 0);
        setSalesWeekTotal(data.salesWeek ?? 0);
        setMonthlyTotal(data.salesMonth ?? 0);
        setLastMonthTotal(data.salesLastMonth ?? 0);
        setCurrentMonthTrend(data.currentMonthTrend ?? []);
        setLastMonthTrend(data.lastMonthTrend ?? []);
        setExpenseTrend(data.expenseTrend ?? []);
        setPaidExpensesTotal(data.paidExpensesTotal ?? 0);
        setTopExpenses(data.topExpenses ?? []);
        setVendorPaymentsTotal(data.vendorPaymentsTotal ?? 0);
        setVendorPaymentsToday(data.vendorPaymentsToday ?? []);
        setOutstandingCount(data.outstandingCount ?? 0);
        setOutstandingTotal(data.outstandingTotal ?? 0);
        setPartialPaidInvoices(data.partialPaid ?? []);
        setPartialPaidCount((data.partialPaid ?? []).length);
        setPartialPaidRemaining((data.partialPaid ?? []).reduce((s: number, i: any) => s + i.balance, 0));
        setRecentInvoices(data.recentInvoices ?? []);
        setPaymentsTotal(data.paymentsTotal ?? 0);
        setCustomerPaymentsToday(data.customerPaymentsToday ?? []);
        setRecentPurchases(data.recentPurchases ?? []);
        setQboSyncStatus("ok");
      } catch (err) {
        console.error("Dashboard summary error:", err);
        if (isMounted) setQboSyncStatus("error");
      } finally {
        if (isMounted) {
          setLoadingMonthlyTotal(false);
          setLoadingLastMonthTotal(false);
          setLoadingProfit(false);
          setLoadingPartialPaidInvoices(false);
          setLoadingRecentInvoices(false);
          setLoadingRecentPurchases(false);
          setLoadingCustomerPayments(false);
          setLoadingVendorPayments(false);
        }
      }
    };

    fetchSummary();
    const interval = setInterval(fetchSummary, 30000);
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 1, 0);
    const msUntilMidnight = Math.max(nextMidnight.getTime() - now.getTime(), 1000);
    const midnightRefresh = setTimeout(fetchSummary, msUntilMidnight);

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearTimeout(midnightRefresh);
    };
  }, []);

  // Derived display values (depend on state set by summary fetch)
  const fallbackSales = qboSales !== null ? qboSales : mockReps.reduce((sum, rep) => sum + rep.sales, 0);
  const totalSales = loadingMonthlyTotal ? fallbackSales : monthlyTotal;
  const totalCommission = repSalesData.length > 0
    ? repSalesData.reduce((sum, rep) => sum + rep.commission, 0)
    : mockReps.reduce((sum, rep) => sum + rep.commission, 0);
  const monthlyTrendMax = Math.max(...currentMonthTrend, ...lastMonthTrend, ...expenseTrend, 1);
  const topExpenseSeries = topExpenses.map((expense) => expense.total);
  const maxTopExpense = Math.max(...topExpenseSeries, 1);
  const profitVsExpenseMax = Math.max(Math.abs(profitThisMonth), totalExpenses, 1);

  const handlePrintOpenInvoices = () => {
    if (loadingRecentInvoices) return;
    if (recentInvoices.length === 0) {
      setPrintOpenInvoicesError("No open invoices to print.");
      return;
    }
    setPrintOpenInvoicesError(null);
    setPrintingOpenInvoices(true);
    setTimeout(() => {
      window.print();
      setPrintingOpenInvoices(false);
    }, 150);
  };

  const handlePrintPartialPaidInvoices = () => {
    if (loadingPartialPaidInvoices) return;
    if (partialPaidInvoices.length === 0) {
      setPrintPartialPaidError("No partially paid invoices to print.");
      return;
    }
    setPrintPartialPaidError(null);
    setPrintingPartialPaid(true);
    setTimeout(() => {
      window.print();
      setPrintingPartialPaid(false);
    }, 150);
  };

  const handleOpenPrintableReport = (type: string, range?: SalesReportRange) => {
    setPrintReportError(null);
    const rangeQuery = range ? `&range=${encodeURIComponent(range)}` : "";
    const url = `/api/reports/print?type=${encodeURIComponent(type)}${rangeQuery}&_=${Date.now()}`;
    const reportWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!reportWindow) {
      setPrintReportError("Popup blocked. Please allow popups and try printing again.");
    }
  };

  // Fetch customer payments made today in QuickBooks Payments
  useEffect(() => {
    let isMounted = true;
    const fetchIncomingDeposits = async () => {
      setLoadingIncomingDeposits(true);
      try {
        const res = await fetch(`/api/qbo/pending-charges?today=true&_=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to fetch pending charges");
        const data = await res.json();
        if (isMounted) {
          setIncomingDepositsTotal(Number(data.totalAmount || 0));
          setIncomingDeposits(
            (data.charges || []).map((c: any) => ({
              id: c.id,
              created: c.created,
              status: c.status,
              amount: Number(c.amount || 0),
              currency: c.currency || "USD",
              cardName: c.card?.name || "",
              cardLast4: c.card?.last4 || "",
              cardType: c.card?.cardType || "",
            }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch pending charges:", err);
        if (isMounted) {
          setIncomingDepositsTotal(0);
          setIncomingDeposits([]);
        }
      } finally {
        if (isMounted) setLoadingIncomingDeposits(false);
      }
    };
    fetchIncomingDeposits();
    const interval = setInterval(fetchIncomingDeposits, 120000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch Shopify payouts + recent orders with deposit linkage
  useEffect(() => {
    let isMounted = true;
    const fetchShopifyPayouts = async () => {
      setLoadingShopifyPayouts(true);
      try {
        const res = await fetch(`/api/shopify/payouts?_=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to fetch Shopify payouts");
        const data = await res.json();
        if (isMounted) {
          if (data.shopifyPaymentsNotEnabled) {
            setShopifyPaymentsEnabled(false);
          } else {
            setShopifyPaymentsEnabled(true);
          }
          setShopifyPayouts(data.allPayouts || []);
          setShopifyOrders(data.recentOrders || []);
          setShopifyBalance(data.balance || null);
          const diagnosticsParts: string[] = [];
          if (data?.diagnostics?.payoutFetchErrors?.length) {
            diagnosticsParts.push(`API errors: ${data.diagnostics.payoutFetchErrors.join(" | ")}`);
          }
          if (data?.diagnostics?.tokenScope) {
            diagnosticsParts.push(`Scopes: ${data.diagnostics.tokenScope}`);
          }
          setShopifyPayoutDiagnostics(diagnosticsParts.length > 0 ? diagnosticsParts.join(" â€¢ ") : null);
        }
      } catch (err) {
        console.error("Failed to fetch Shopify payouts:", err);
        if (isMounted) {
          setShopifyPayouts([]);
          setShopifyOrders([]);
          setShopifyPayoutDiagnostics(err instanceof Error ? err.message : "Failed to fetch Shopify payouts");
        }
      } finally {
        if (isMounted) setLoadingShopifyPayouts(false);
      }
    };
    fetchShopifyPayouts();
    const interval = setInterval(fetchShopifyPayouts, 120000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <style jsx global>{`
        @media print {
          aside {
            display: none !important;
          }
          .print-hidden {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
        }
      `}</style>
      <div className="flex min-h-screen">
        <Sidebar activePage="Dashboard" />
        {/* Main Content */}
        <main className="flex-1 bg-slate-50 text-slate-900">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 print-hidden space-y-8">
            {/* Header */}
            <header className="">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">Dashboard</p>
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
                <div>
                  <h1 className="text-[28px] font-semibold text-slate-900 leading-tight">Company Performance</h1>
                  <p className="mt-1.5 max-w-2xl text-sm text-slate-600 leading-relaxed">
                    Business health at a glance with monthly trends, action items, and recent activity.
                  </p>
                </div>
              </div>
            </header>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Printable Reports</h2>
                  <p className="mt-0.5 text-xs text-slate-600">Open a printer-friendly report in a new tab.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => handleOpenPrintableReport("open-invoices")} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700 transition">Open Invoices</button>
                  <button type="button" onClick={() => handleOpenPrintableReport("estimates")} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700 transition">Estimates</button>
                  <button type="button" onClick={() => handleOpenPrintableReport("accepted-estimates-unpaid")} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700 transition">Accepted Estimates</button>
                  <select
                    value={salesReportRange}
                    onChange={(event) => setSalesReportRange(event.target.value as SalesReportRange)}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                  >
                    <option value="ytd">Year To Date</option>
                    <option value="this-week">This Week</option>
                    <option value="last-week">Last Week</option>
                    <option value="this-month">This Month</option>
                    <option value="last-month">Last Month</option>
                  </select>
                  <button type="button" onClick={() => handleOpenPrintableReport("sales", salesReportRange)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700 transition">Sales Report</button>
                </div>
              </div>
              {printReportError && <p className="mt-2 text-xs text-red-600">{printReportError}</p>}
            </div>

            {/* Key Metrics */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-xs font-medium text-slate-500 mb-3">Sales Today</div>
                <div className="text-[26px] font-semibold text-slate-900 leading-none">
                  ${money(Math.round(animatedSalesTodayTotal))}
                </div>
                <div className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Payments received today
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-xs font-medium text-slate-500 mb-3">Sales This Week</div>
                <div className="text-[26px] font-semibold text-slate-900 leading-none">${money(Math.round(animatedSalesWeekTotal))}</div>
                <div className="mt-2 text-xs text-slate-600 leading-relaxed">Mon to today (payments received)</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-xs font-medium text-slate-500 mb-3">Sales This Month</div>
                <div className="text-[26px] font-semibold text-slate-900 leading-none">
                  ${money(Math.round(animatedMonthlyTotal))}
                </div>
                <div className="mt-2 text-xs text-slate-600 leading-relaxed">${money(lastMonthTotal)} last month</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-xs font-medium text-slate-500 mb-3">QuickBooks</div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900 leading-none mt-[10px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${qboSyncStatus === "ok" ? "bg-emerald-500" : qboSyncStatus === "error" ? "bg-red-500" : "bg-slate-300"}`} />
                  {qboSyncStatus === "ok" ? "Synced" : qboSyncStatus === "error" ? "Sync error" : "Checking"}
                </div>
                <div className="mt-2 text-xs text-slate-600 leading-relaxed">Data connection</div>
              </div>
            </div>

            {/* Customer Payments Today + Shopify Scheduled Deposits */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Customer Payments Today -- QBO payments received today */}
              <div className="bg-white border border-slate-200 rounded-lg">
                <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Customer Payments Today</h2>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Payments received in QuickBooks today
                    </p>
                    {!loadingCustomerPayments && (
                      <p className="mt-1 text-lg font-bold text-emerald-700">
                        ${money(paymentsTotal)}
                      </p>
                    )}
                  </div>
                  {customerPaymentsToday.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCustomerPaymentsModal(true)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      View all
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Customer</th>
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Date</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {loadingCustomerPayments ? (
                        <tr><td colSpan={3} className="px-5 py-6 text-center text-slate-500">Loading...</td></tr>
                      ) : customerPaymentsToday.length === 0 ? (
                        <tr><td colSpan={3} className="px-5 py-6 text-center text-slate-500">
                          No payments recorded in QuickBooks today
                        </td></tr>
                      ) : (
                        customerPaymentsToday.slice(0, 8).map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 text-sm font-medium text-slate-900">{p.customerName}</td>
                            <td className="px-5 py-3 text-sm text-slate-600">{p.txnDate}</td>
                            <td className="px-5 py-3 text-right text-sm font-semibold text-emerald-700">
                              ${money(p.appliedAmount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Shopify Scheduled Deposits */}
              <div className="bg-white border border-slate-200 rounded-lg">
                <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Shopify Deposits Scheduled</h2>
                    <p className="mt-0.5 text-sm text-slate-600">Upcoming Shopify payouts by deposit date</p>
                    {!loadingShopifyPayouts && scheduledShopifyPayouts.length > 0 && (
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        Total scheduled: ${money(
                          scheduledShopifyPayouts.reduce((sum, payout) => sum + (Number(payout.amount) || 0), 0)
                        )}
                      </p>
                    )}
                    {!loadingShopifyPayouts && shopifyPayoutDiagnostics && (
                      <p className="mt-1 text-xs text-amber-700 break-words">{shopifyPayoutDiagnostics}</p>
                    )}
                  </div>
                  {scheduledShopifyPayouts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowDepositsModal(true)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      View all â†’
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Deposit Date</th>
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Status</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {loadingShopifyPayouts ? (
                        <tr><td colSpan={3} className="px-5 py-6 text-center text-slate-500">Loading...</td></tr>
                      ) : !shopifyPaymentsEnabled ? (
                        <tr><td colSpan={3} className="px-5 py-6 text-center text-slate-500">Shopify Payments not enabled</td></tr>
                      ) : scheduledShopifyPayouts.length === 0 ? (
                        <tr><td colSpan={3} className="px-5 py-6 text-center text-slate-500">No scheduled Shopify deposits</td></tr>
                      ) : (
                        scheduledShopifyPayouts.slice(0, 6).map((payout) => (
                          <tr key={payout.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 text-sm font-medium text-slate-900">{payout.date}</td>
                            <td className="px-5 py-3 text-sm text-slate-600 capitalize">{payout.status.replace("_", " ")}</td>
                            <td className="px-5 py-3 text-right text-sm font-semibold text-emerald-700">
                              ${money(Number(payout.amount) || 0)} {payout.currency}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Overview */}
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Monthly Performance</h2>
                      <p className="mt-0.5 text-sm text-slate-600">Last month vs this month (so far)</p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      ${money(monthlyTotal)} this month â€¢ ${money(lastMonthTotal)} last month
                    </div>
                  </div>
                  <div className="mt-5">
                    {currentMonthTrend.length === 0 && lastMonthTrend.length === 0 ? (
                      <div className="h-32 flex items-center justify-center bg-slate-50 rounded-md text-sm text-slate-500">
                        Loading trend data...
                      </div>
                    ) : (
                      <>
                        <svg viewBox="0 0 320 120" preserveAspectRatio="none" className="h-24 w-full">
                          <defs>
                            <linearGradient id="incomeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.08" />
                              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <g stroke="#e5e7eb" strokeWidth="1" strokeOpacity="0.5">
                            <line x1="0" y1="30" x2="320" y2="30" />
                            <line x1="0" y1="60" x2="320" y2="60" />
                            <line x1="0" y1="90" x2="320" y2="90" />
                          </g>
                          {lastMonthTrend.length > 0 && (
                            <path
                              d={buildLinePath(lastMonthTrend, monthlyTrendMax, 320, 120, 12)}
                              fill="none"
                              stroke="#94a3b8"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                          {currentMonthTrend.length > 0 && (
                            <>
                              <path
                                d={buildAreaPath(currentMonthTrend, monthlyTrendMax, 320, 120, 12)}
                                fill="url(#incomeGradient)"
                              />
                              <path
                                d={buildLinePath(currentMonthTrend, monthlyTrendMax, 320, 120, 12)}
                                fill="none"
                                stroke="#2563eb"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </>
                          )}
                          {expenseTrend.length > 0 && (
                            <path
                              d={buildLinePath(expenseTrend, monthlyTrendMax, 320, 120, 12)}
                              fill="none"
                              stroke="#d97706"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                        </svg>
                        <div className="mt-4 flex items-center gap-4 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Last month
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                            Income
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                            Expenses
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Profit vs Expenses</h2>
                      <p className="mt-0.5 text-sm text-slate-600">Month-to-date breakdown</p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      Income ${money(monthlyTotal)} - Expenses ${money(totalExpenses)}
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <div className="mb-4">
                        <div className="text-xs font-medium text-slate-500 mb-2">Profit (Month-to-Date)</div>
                        <div className="text-[26px] font-semibold text-slate-900 leading-none">${money(Math.round(animatedProfitThisMonth))}</div>
                      </div>
                          
                          <div className="mt-4 h-24 flex items-end gap-5">
                            <div className="flex-1">
                              <div className="text-xs font-medium text-slate-500 mb-2">Profit</div>
                              <div
                                className={`w-full rounded ${profitThisMonth >= 0 ? "bg-emerald-600" : "bg-red-600"} transition-all duration-300`}
                                style={{ height: `${(Math.abs(profitThisMonth) / profitVsExpenseMax) * 100}%`, minHeight: "16px" }}
                              />
                              <div className="mt-2.5 text-sm font-medium text-slate-900">${money(Math.round(animatedProfitThisMonth))}</div>
                            </div>
                            <div className="flex-1">
                              <div className="text-xs font-medium text-slate-500 mb-2">Expenses</div>
                              <div
                                className="w-full rounded bg-amber-600 transition-all duration-300"
                                style={{ height: `${(totalExpenses / profitVsExpenseMax) * 100}%`, minHeight: "16px" }}
                              />
                              <div className="mt-2.5 text-sm font-medium text-slate-900">${money(Math.round(animatedTotalExpenses))}</div>
                            </div>
                          </div>
                          
                          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-200 pt-4">
                            <div>
                              <div className="text-xs font-medium text-slate-500">Bills</div>
                              <div className="mt-1 text-base font-semibold text-slate-900">${money(paidExpensesTotal)}</div>
                            </div>
                          </div>
                        </div>
                  </div>
              </div>
            </div>

            {/* Quick Tables */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="bg-white border border-slate-200 rounded-lg">
                <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Open Invoices</h2>
                    <p className="mt-0.5 text-sm text-slate-600">Unpaid invoices awaiting payment</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handlePrintOpenInvoices}
                      className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
                    >
                      {printingOpenInvoices ? "Preparingâ€¦" : "Print"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowOpenInvoicesModal(true)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      View all â†’
                    </button>
                  </div>
                </div>
                {printOpenInvoicesError && (
                  <div className="px-6 pt-4 text-sm text-red-600">{printOpenInvoicesError}</div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full hidden sm:table">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-medium">
                      <tr className="border-b border-slate-100">
                        <th className="px-5 py-3 text-left font-medium">Invoice</th>
                        <th className="px-5 py-3 text-left font-medium">Customer</th>
                        <th className="px-5 py-3 text-right font-medium">Amount Due</th>
                        <th className="px-5 py-3 text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {loadingRecentInvoices ? (
                        <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-500">Loading...</td></tr>
                      ) : recentInvoices.length === 0 ? (
                        <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-500">No open invoices</td></tr>
                      ) : (
                        recentInvoices.slice(0, 5).map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 font-mono text-sm text-slate-700">{inv.docNumber}</td>
                            <td className="px-5 py-3 text-sm text-slate-700">{inv.customerName}</td>
                            <td className="px-5 py-3 text-right text-sm font-semibold text-slate-900">${money(inv.balance)}</td>
                            <td className="px-5 py-3 text-right">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${inv.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <div className="sm:hidden px-4 py-4 space-y-3">
                    {loadingRecentInvoices ? (
                      <div className="text-sm text-slate-500">Loading...</div>
                    ) : recentInvoices.length === 0 ? (
                      <div className="text-sm text-slate-500">No open invoices</div>
                    ) : (
                      recentInvoices.slice(0, 5).map((inv) => (
                        <div key={inv.id} className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-900">{inv.docNumber}</span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${inv.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {inv.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">{inv.customerName}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">${money(inv.balance)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg">
                <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Customer Payments Today</h2>
                    <p className="mt-0.5 text-sm text-slate-600">Payments received and invoices paid today</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      Total: ${money(paymentsTotal)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCustomerPaymentsModal(true)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    View all â†’
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full hidden sm:table">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Customer</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Applied</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {loadingCustomerPayments ? (
                        <tr>
                          <td colSpan={3} className="px-5 py-6 text-center text-slate-500">Loading...</td>
                        </tr>
                      ) : customerPaymentsToday.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-5 py-6 text-center text-slate-500">No customer payments received today</td>
                        </tr>
                      ) : (
                        customerPaymentsToday.slice(0, 5).map((payment) => (
                          <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 font-medium text-slate-900">{payment.customerName}</td>
                            <td className="px-5 py-3 text-right font-semibold text-emerald-700">${money(payment.appliedAmount)}</td>
                            <td className="px-5 py-3 text-right text-sm text-slate-600">${money(payment.totalAmount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <div className="sm:hidden px-4 py-4 space-y-3">
                    {loadingCustomerPayments ? (
                      <div className="text-sm text-slate-500">Loading...</div>
                    ) : customerPaymentsToday.length === 0 ? (
                      <div className="text-sm text-slate-500">No customer payments received today</div>
                    ) : (
                      customerPaymentsToday.slice(0, 5).map((payment) => (
                        <div key={payment.id} className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow">
                          <p className="text-sm font-semibold text-slate-900">{payment.customerName}</p>
                          <div className="mt-2 flex items-center justify-between text-sm">
                            <span className="text-emerald-700 font-semibold">${money(payment.appliedAmount)}</span>
                            <span className="text-slate-500">${money(payment.totalAmount)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Purchases */}
            <div className="bg-white border border-slate-200 rounded-lg">
              <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Recent Purchases</h2>
                  <p className="mt-0.5 text-sm text-slate-600">Latest purchase orders</p>
                </div>
                <a href="/admin/purchasing" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">View all â†’</a>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-500 font-medium">
                    <tr>
                      <th className="px-5 py-3 text-left">PO</th>
                      <th className="px-5 py-3 text-left">Vendor</th>
                      <th className="px-5 py-3 text-right">Total</th>
                      <th className="px-5 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loadingRecentPurchases ? (
                      <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-500">Loading...</td></tr>
                    ) : recentPurchases.length === 0 ? (
                      <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-500">No recent purchases</td></tr>
                    ) : (
                      recentPurchases.map((po) => (
                        <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 font-mono text-sm text-slate-700">{po.poNumber}</td>
                          <td className="px-5 py-3 text-sm text-slate-700">{po.vendorName}</td>
                          <td className="px-5 py-3 text-right text-sm font-semibold text-slate-900">${money(po.totalAmount)}</td>
                          <td className="px-5 py-3 text-right">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
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

            {/* Bottom Listed Cards */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="bg-white border border-slate-200 rounded-lg">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="text-lg font-semibold text-slate-900">Vendors Paid Today</h2>
                  <p className="mt-0.5 text-sm text-slate-600">Payments our company made today</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-slate-100 bg-slate-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Vendor</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Payments</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Amount Paid</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Last Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {loadingVendorPayments ? (
                        <tr>
                          <td colSpan={4} className="px-5 py-6 text-center text-slate-500">Loading...</td>
                        </tr>
                      ) : vendorPaymentsToday.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-5 py-6 text-center text-slate-500">No vendor payments recorded today</td>
                        </tr>
                      ) : (
                        vendorPaymentsToday.map((payment) => (
                          <tr key={payment.vendorName} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 font-medium text-slate-900">{payment.vendorName}</td>
                            <td className="px-5 py-3 text-right text-sm text-slate-600">{payment.paymentCount}</td>
                            <td className="px-5 py-3 text-right text-sm font-semibold text-indigo-700">${money(payment.totalPaid)}</td>
                            <td className="px-5 py-3 text-right text-sm text-slate-600">{payment.lastTxnDate}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Partially Paid Orders */}
            <div className="bg-white border border-slate-200 rounded-lg">
              <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Partially Paid Orders</h2>
                  <p className="mt-0.5 text-sm text-slate-600">Invoices with a deposit paid and a remaining balance</p>
                </div>
                <div className="flex items-center gap-3">
                  {partialPaidInvoices.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPartialPaidModal(true)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      View all â†’
                    </button>
                  )}
                  <div className="text-right">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Due from Customers</div>
                    <div className="text-lg font-semibold text-amber-700">${money(partialPaidRemaining)}</div>
                    <div className="text-xs text-slate-500">{partialPaidCount} partial invoice{partialPaidCount === 1 ? "" : "s"}</div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full hidden sm:table">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Invoice</th>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Customer</th>
                      <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Paid</th>
                      <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loadingPartialPaidInvoices ? (
                      <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-500">Loading...</td></tr>
                    ) : partialPaidInvoices.length === 0 ? (
                      <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-500">No partially paid invoices</td></tr>
                    ) : (
                      partialPaidInvoices.slice(0, 10).map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 font-mono text-sm text-slate-700">{inv.docNumber}</td>
                          <td className="px-5 py-3 text-sm text-slate-700">{inv.customerName}</td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700">${money(inv.paidAmt)}</td>
                          <td className="px-5 py-3 text-right text-sm font-semibold text-amber-700">${money(inv.balance)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className="sm:hidden px-4 py-4 space-y-3">
                  {loadingPartialPaidInvoices ? (
                    <div className="text-sm text-slate-500">Loading...</div>
                  ) : partialPaidInvoices.length === 0 ? (
                    <div className="text-sm text-slate-500">No partially paid invoices</div>
                  ) : (
                    partialPaidInvoices.slice(0, 10).map((inv) => (
                      <div key={inv.id} className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">{inv.docNumber}</span>
                          <span className="text-sm font-semibold text-amber-700">Due ${money(inv.balance)}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{inv.customerName}</p>
                        <p className="mt-1 text-xs text-slate-500">Paid ${money(inv.paidAmt)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {showOpenInvoicesModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">All Open Invoices</h2>
                      <p className="mt-0.5 text-sm text-slate-600">Full list of unpaid invoices</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOpenInvoicesModal(false)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-medium border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-3 text-left">Invoice</th>
                          <th className="px-5 py-3 text-left">Customer</th>
                          <th className="px-5 py-3 text-right">Amount Due</th>
                          <th className="px-6 py-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {recentInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-6 text-center text-slate-500">
                              No open invoices
                            </td>
                          </tr>
                        ) : (
                          recentInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 font-mono text-sm text-slate-700">{inv.docNumber}</td>
                              <td className="px-6 py-4 text-sm text-slate-700">{inv.customerName}</td>
                              <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">${money(inv.balance)}</td>
                              <td className="px-6 py-4 text-right">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${inv.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
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
              </div>
            )}

            {showPartialPaidModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">All Partially Paid Invoices</h2>
                      <p className="mt-0.5 text-sm text-slate-600">Total due from customers: ${money(partialPaidRemaining)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handlePrintPartialPaidInvoices}
                        className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
                      >
                        {printingPartialPaid ? "Preparingâ€¦" : "Print"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPartialPaidModal(false)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                  {printPartialPaidError && (
                    <div className="px-5 pt-4 text-sm text-red-600">{printPartialPaidError}</div>
                  )}
                  <div className="max-h-[70vh] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Invoice</th>
                          <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Customer</th>
                          <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Total</th>
                          <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Paid</th>
                          <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {partialPaidInvoices.length === 0 ? (
                          <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-500">No partially paid invoices</td></tr>
                        ) : (
                          partialPaidInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3 font-mono text-sm text-slate-700">{inv.docNumber}</td>
                              <td className="px-5 py-3 text-sm text-slate-700">{inv.customerName}</td>
                              <td className="px-5 py-3 text-right text-sm text-slate-600">${money(inv.totalAmt)}</td>
                              <td className="px-5 py-3 text-right text-sm text-slate-600">${money(inv.paidAmt)}</td>
                              <td className="px-5 py-3 text-right text-sm font-semibold text-amber-700">${money(inv.balance)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {showCustomerPaymentsModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">All Customer Payments Today</h2>
                      <p className="mt-0.5 text-sm text-slate-600">Total received/paid: ${money(paymentsTotal)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCustomerPaymentsModal(false)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto">
                    <table className="w-full">
                      <thead className="border-b border-slate-200 bg-slate-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">Customer</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Applied</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customerPaymentsToday.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-6 text-center text-slate-500">No customer payments received today</td>
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
              </div>
            )}

            {/* Customer Payments Today Modal */}
            {showIncomingDepositsModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">All Customer Payments Today</h2>
                      <p className="mt-0.5 text-sm text-slate-600">Total processed today: ${money(incomingDepositsTotal)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowIncomingDepositsModal(false)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Customer</th>
                          <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Date</th>
                          <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Status</th>
                          <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Card</th>
                          <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {incomingDeposits.length === 0 ? (
                          <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-500">No QuickBooks Payments customer charges found today</td></tr>
                        ) : (
                          incomingDeposits.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="px-5 py-3 font-medium text-slate-900">{p.cardName || "—"}</td>
                              <td className="px-5 py-3 text-sm text-slate-600">{p.created?.slice(0, 10) || "—"}</td>
                              <td className="px-5 py-3 text-sm text-amber-700 font-medium">{p.status}</td>
                              <td className="px-5 py-3 text-sm text-slate-500">{p.cardType}{p.cardLast4 ? ` ····${p.cardLast4}` : ""}</td>
                              <td className="px-5 py-3 text-right font-semibold text-amber-700">${money(p.amount)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Shopify Scheduled Deposits Modal */}
            {showDepositsModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">All Shopify Scheduled Deposits</h2>
                      <p className="mt-0.5 text-sm text-slate-600">
                        Total scheduled: ${money(
                          scheduledShopifyPayouts.reduce((sum, payout) => sum + (Number(payout.amount) || 0), 0)
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDepositsModal(false)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Deposit Date</th>
                          <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Status</th>
                          <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Payout ID</th>
                          <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Amount</th>
                          <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Currency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {scheduledShopifyPayouts.length === 0 ? (
                          <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-500">No scheduled deposits found</td></tr>
                        ) : (
                          scheduledShopifyPayouts.map((payout) => (
                            <tr key={payout.id} className="hover:bg-slate-50">
                              <td className="px-5 py-3 text-sm font-medium text-slate-900">{payout.date}</td>
                              <td className="px-5 py-3 text-sm text-slate-700 capitalize">{payout.status.replace("_", " ")}</td>
                              <td className="px-5 py-3 text-sm text-slate-500 font-mono">{payout.id}</td>
                              <td className="px-5 py-3 text-right font-semibold text-emerald-700">${money(Number(payout.amount) || 0)}</td>
                              <td className="px-5 py-3 text-right text-sm text-slate-500">{payout.currency}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Shopify Payouts Modal */}
            {showShopifyPayoutsModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">All Shopify Orders â€” Deposit Status</h2>
                      <p className="mt-0.5 text-sm text-slate-600">Itemized Shopify payout transactions and their payout dates</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowShopifyPayoutsModal(false)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                  {shopifyPayouts.length > 0 && (
                    <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2">
                      {shopifyPayouts.map((payout) => (
                        <span
                          key={payout.id}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                            normalizePayoutStatus(payout.status) === "scheduled" ? "bg-blue-100 text-blue-700"
                            : normalizePayoutStatus(payout.status) === "in_transit" ? "bg-amber-100 text-amber-700"
                            : normalizePayoutStatus(payout.status) === "paid" ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {payout.date} â€” ${Number(payout.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} {payout.currency} ({normalizePayoutStatus(payout.status) || payout.status})
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="max-h-[65vh] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Order</th>
                          <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Deposit Date</th>
                          <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Order Date</th>
                          <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Total</th>
                          <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Fee</th>
                          <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Net</th>
                          <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Deposit Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {shopifyOrders.map((order) => {
                          const orderDepositStatus = normalizePayoutStatus(order.pendingDepositStatus);
                          const depositLabel =
                            orderDepositStatus === "paid" ? "Deposited"
                            : orderDepositStatus === "in_transit" ? "In Transit"
                            : orderDepositStatus === "scheduled" ? "Scheduled"
                            : order.financial_status === "paid" ? "Paid â€” not linked"
                            : order.financial_status || "â€”";
                          const depositColor =
                            orderDepositStatus === "paid" ? "bg-emerald-100 text-emerald-700"
                            : orderDepositStatus === "in_transit" ? "bg-amber-100 text-amber-700"
                            : orderDepositStatus === "scheduled" ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600";
                          return (
                            <tr key={order.id} className="hover:bg-slate-50">
                              <td className="px-5 py-3 font-mono text-sm text-slate-700">{order.name}</td>
                              <td className="px-5 py-3 text-sm font-medium text-slate-900">{order.payoutDate || "â€”"}</td>
                              <td className="px-5 py-3 text-sm text-slate-600">{order.created_at?.slice(0, 10) || "â€”"}</td>
                              <td className="px-5 py-3 text-right text-sm font-semibold text-slate-900">
                                ${Number(order.total_price).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-5 py-3 text-right text-sm text-slate-500">
                                {order.fee ? `$${Number(order.fee).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "â€”"}
                              </td>
                              <td className="px-5 py-3 text-right text-sm text-slate-700">
                                {order.netAmount ? `$${Number(order.netAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "â€”"}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${depositColor}`}>
                                  {depositLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </div>
          <div className="print-only hidden bg-white px-8 py-6 text-slate-900">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold">Open Invoices</h1>
              <p className="text-sm text-slate-600">Full list of unpaid invoices</p>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2">Invoice</th>
                  <th className="py-2">Customer</th>
                  <th className="py-2">Date</th>
                  <th className="py-2 text-right">Amount Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-sm text-slate-500">No open invoices</td>
                  </tr>
                ) : (
                  recentInvoices.map((inv) => (
                    <tr key={inv.id} className="text-sm">
                      <td className="py-2 font-semibold text-slate-900">{inv.docNumber}</td>
                      <td className="py-2 text-slate-700">{inv.customerName}</td>
                      <td className="py-2 text-slate-700">{inv.txnDate}</td>
                      <td className="py-2 text-right text-slate-900">${money(inv.balance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
