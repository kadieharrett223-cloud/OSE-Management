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

interface UndepositedPayment {
  id: string;
  txnDate: string;
  customerName: string;
  totalAmt: number;
  appliedAmt: number;
  memo: string;
  invoiceNums: string[];
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
  const [payrollExpenseTotal, setPayrollExpenseTotal] = useState<number>(0);
  const [loadingProfit, setLoadingProfit] = useState(true);
  const [topExpenses, setTopExpenses] = useState<Array<{ name: string; total: number }>>([]);
  const [partialPaidCount, setPartialPaidCount] = useState<number>(0);
  const [partialPaidRemaining, setPartialPaidRemaining] = useState<number>(0);
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
  const [printingOpenInvoices, setPrintingOpenInvoices] = useState(false);
  const [printOpenInvoicesError, setPrintOpenInvoicesError] = useState<string | null>(null);
  const [recentPurchases, setRecentPurchases] = useState<RecentPurchase[]>([]);
  const [loadingRecentPurchases, setLoadingRecentPurchases] = useState(true);
  const [qboSyncStatus, setQboSyncStatus] = useState<"idle" | "ok" | "error">("idle");
  const [currentMonthTrend, setCurrentMonthTrend] = useState<number[]>([]);
  const [lastMonthTrend, setLastMonthTrend] = useState<number[]>([]);
  const [expenseTrend, setExpenseTrend] = useState<number[]>([]);

  // Undeposited funds state
  const [undepositedFunds, setUndepositedFunds] = useState<number>(0);
  const [undepositedPayments, setUndepositedPayments] = useState<UndepositedPayment[]>([]);
  const [loadingUndepositedFunds, setLoadingUndepositedFunds] = useState(true);
  const [showUndepositedModal, setShowUndepositedModal] = useState(false);

  const [showDepositsModal, setShowDepositsModal] = useState(false);

  // Shopify payouts state
  const [shopifyPayouts, setShopifyPayouts] = useState<ShopifyPayout[]>([]);
  const [shopifyOrders, setShopifyOrders] = useState<ShopifyOrderWithDeposit[]>([]);
  const [shopifyBalance, setShopifyBalance] = useState<{ amount: string; currency: string } | null>(null);
  const [shopifyPaymentsEnabled, setShopifyPaymentsEnabled] = useState(true);
  const [loadingShopifyPayouts, setLoadingShopifyPayouts] = useState(true);
  const [showShopifyPayoutsModal, setShowShopifyPayoutsModal] = useState(false);

  const scheduledShopifyPayouts = shopifyPayouts.filter(
    (payout) => payout.status === "scheduled" || payout.status === "in_transit"
  );

  // Compute derived values first (needed for animated count-ups)
  const totalExpenses = paidExpensesTotal + payrollExpenseTotal;
  const profitThisMonth = monthlyTotal - totalExpenses;

  // Animated values using count-up hook
  const animatedSalesTodayTotal = useCountUp(salesTodayTotal);
  const animatedMonthlyTotal = useCountUp(monthlyTotal);
  const animatedSalesWeekTotal = useCountUp(salesWeekTotal);
  const animatedProfitThisMonth = useCountUp(profitThisMonth);
  const animatedTotalExpenses = useCountUp(totalExpenses);
  const animatedPayrollTotal = useCountUp(payrollExpenseTotal);

  const getLocalDateYmd = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Fetch QuickBooks invoice data for current month (calendar month)
  useEffect(() => {
    let isMounted = true;
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, "0");
    const startDate = `${year}-${month}-01`;
    const endDate = today.toISOString().slice(0, 10);
    
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

  const fallbackSales = qboSales !== null ? qboSales : mockReps.reduce((sum, rep) => sum + rep.sales, 0);
  const totalSales = loadingMonthlyTotal ? fallbackSales : monthlyTotal;
  const totalCommission = repSalesData.length > 0
    ? repSalesData.reduce((sum, rep) => sum + rep.commission, 0)
    : mockReps.reduce((sum, rep) => sum + rep.commission, 0);
  const monthlyTrendMax = Math.max(...currentMonthTrend, ...lastMonthTrend, ...expenseTrend, 1);
  const topExpenseSeries = topExpenses.map((expense) => expense.total);
  const maxTopExpense = Math.max(...topExpenseSeries, 1);
  const profitVsExpenseMax = Math.max(Math.abs(profitThisMonth), totalExpenses, 1);

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

  // Fetch sales (payments received) for current and previous month
  useEffect(() => {
    const fetchMonthlySales = async () => {
      setLoadingMonthlyTotal(true);
      setLoadingLastMonthTotal(true);
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const startDate = `${year}-${month}-01`;
        const endDate = toYmdLocal(now);
        const todayDate = endDate;

        const weekStart = new Date(now);
        const day = weekStart.getDay(); // Sunday=0
        const daysSinceMonday = (day + 6) % 7;
        weekStart.setDate(weekStart.getDate() - daysSinceMonday);
        const weekStartDate = toYmdLocal(weekStart);

        const lastMonthStart = new Date(year, now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(year, now.getMonth(), 0);
        const lastMonthStartDate = `${lastMonthStart.getFullYear()}-${String(lastMonthStart.getMonth() + 1).padStart(2, "0")}-01`;
        const lastMonthEndDate = `${lastMonthEnd.getFullYear()}-${String(lastMonthEnd.getMonth() + 1).padStart(2, "0")}-${String(lastMonthEnd.getDate()).padStart(2, "0")}`;

        const [todayPaymentResponse, weekPaymentResponse, monthPaymentResponse, lastMonthPaymentResponse] = await Promise.all([
          fetch(`/api/qbo/payment/query?startDate=${todayDate}&endDate=${todayDate}&_=${Date.now()}`),
          fetch(`/api/qbo/payment/query?startDate=${weekStartDate}&endDate=${endDate}&_=${Date.now()}`),
          fetch(`/api/qbo/payment/query?startDate=${startDate}&endDate=${endDate}&_=${Date.now()}`),
          fetch(`/api/qbo/payment/query?startDate=${lastMonthStartDate}&endDate=${lastMonthEndDate}&_=${Date.now()}`),
        ]);

        if (!todayPaymentResponse.ok || !weekPaymentResponse.ok || !monthPaymentResponse.ok || !lastMonthPaymentResponse.ok) {
          throw new Error("Failed to fetch payment data");
        }

        const [todayPaymentData, weekPaymentData, monthPaymentData, lastMonthPaymentData] = await Promise.all([
          todayPaymentResponse.json(),
          weekPaymentResponse.json(),
          monthPaymentResponse.json(),
          lastMonthPaymentResponse.json(),
        ]);

        const todayTotalApplied = Number(todayPaymentData.totalApplied || 0);
        const weekTotalApplied = Number(weekPaymentData.totalApplied || 0);
        const monthTotalApplied = Number(monthPaymentData.totalApplied || 0);
        const lastMonthTotalApplied = Number(lastMonthPaymentData.totalApplied || 0);

        console.log(
          `[dashboard] Payments received: today ${todayTotalApplied}, week ${weekTotalApplied}, month ${monthTotalApplied}, last month ${lastMonthTotalApplied}`
        );
        setSalesTodayTotal(todayTotalApplied);
        setSalesWeekTotal(weekTotalApplied);
        setMonthlyTotal(monthTotalApplied);
        setLastMonthTotal(lastMonthTotalApplied);
      } catch (error) {
        console.error("Error fetching monthly sales:", error);
        console.error("Full error details:", {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        setSalesTodayTotal(0);
        setSalesWeekTotal(0);
        setMonthlyTotal(0);
        setLastMonthTotal(0);
      } finally {
        setLoadingMonthlyTotal(false);
        setLoadingLastMonthTotal(false);
      }
    };

    fetchMonthlySales();
    const interval = setInterval(fetchMonthlySales, 60000);

    return () => clearInterval(interval);
  }, []);

  // Fetch paid expenses + payroll for profit (month-to-date)
  useEffect(() => {
    let isMounted = true;

    const fetchProfit = async () => {
      setLoadingProfit(true);
      try {
        const now = new Date();
        const year = now.getFullYear();
        const monthIndex = now.getMonth();
        const month = String(monthIndex + 1).padStart(2, "0");
        const startDate = `${year}-${month}-01`;
        const endDate = now.toISOString().slice(0, 10);
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const daysElapsed = now.getDate();

        const [billsRes, payrollRes] = await Promise.all([
          fetch(`/api/qbo/bill-payment/query?startDate=${startDate}&endDate=${endDate}`),
          fetch(`/api/qbo/payroll/overview?startDate=${startDate}&endDate=${endDate}`),
        ]);

        if (!billsRes.ok || !payrollRes.ok) {
          throw new Error("Failed to fetch profit inputs");
        }

        const [billsData, payrollData] = await Promise.all([billsRes.json(), payrollRes.json()]);
        const paidBills = Number(billsData.totalAmount || 0);
        const billPayments = billsData.payments || [];
        const team = payrollData.team || [];

        const payrollTotal = team.reduce((sum: number, member: any) => {
          const rate = Number(member.rate) || 0;
          if (member.type === "Salary") {
            const monthlySalary = rate / 12;
            return sum + monthlySalary * (daysElapsed / daysInMonth);
          }
          const hours = Number(member.currentHours ?? member.hours ?? 0);
          if (hours > 0) {
            return sum + hours * rate;
          }
          const perPayroll = Number(member.perPayrollCost) || 0;
          return sum + perPayroll * (daysElapsed / 14);
        }, 0);

        const expenseDaily = Array.from({ length: daysElapsed }, () => 0);
        const payrollDaily = daysElapsed > 0 ? payrollTotal / daysElapsed : 0;
        for (let i = 0; i < daysElapsed; i += 1) {
          expenseDaily[i] = payrollDaily;
        }

        billPayments.forEach((payment: any) => {
          if (!payment.TxnDate) return;
          const paymentDate = new Date(payment.TxnDate);
          if (paymentDate.getFullYear() !== year || paymentDate.getMonth() !== monthIndex) return;
          const dayIndex = Math.max(0, Math.min(daysElapsed - 1, paymentDate.getDate() - 1));
          const total = Number(payment.TotalAmt) || 0;
          expenseDaily[dayIndex] += total;
        });

        const expenseSeries: number[] = [];
        let runningExpense = 0;
        for (let i = 0; i < expenseDaily.length; i += 1) {
          runningExpense += expenseDaily[i];
          expenseSeries.push(runningExpense);
        }

        const vendorTotals = new Map<string, number>();
        billPayments.forEach((payment: any) => {
          const vendorName =
            payment.VendorRef?.name ||
            payment.PayeeRef?.name ||
            "Unknown Vendor";
          const total = Number(payment.TotalAmt) || 0;
          vendorTotals.set(vendorName, (vendorTotals.get(vendorName) || 0) + total);
        });

        const topVendors = Array.from(vendorTotals.entries())
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);

        if (isMounted) {
          setPaidExpensesTotal(paidBills);
          setPayrollExpenseTotal(payrollTotal);
          setTopExpenses(topVendors);
          setExpenseTrend(expenseSeries);
        }
      } catch (error) {
        console.error("Failed to fetch profit data:", error);
        if (isMounted) {
          setPaidExpensesTotal(0);
          setPayrollExpenseTotal(0);
          setTopExpenses([]);
          setExpenseTrend([]);
        }
      } finally {
        if (isMounted) setLoadingProfit(false);
      }
    };

    fetchProfit();
    const interval = setInterval(fetchProfit, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
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

  // Unpaid invoices
  useEffect(() => {
    let isMounted = true;

    const fetchUnpaidInvoices = async () => {
      setLoadingRecentInvoices(true);
      try {
        const res = await fetch(`/api/qbo/invoice/query?status=unpaid`);
        if (!res.ok) throw new Error("Failed to fetch unpaid invoices");
        const data = await res.json();
        const invoices = (data.invoices || []).map((inv: any) => {
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
        console.error("Failed to fetch unpaid invoices:", error);
        if (isMounted) setRecentInvoices([]);
      } finally {
        if (isMounted) setLoadingRecentInvoices(false);
      }
    };

    fetchUnpaidInvoices();
    return () => {
      isMounted = false;
    };
  }, []);

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

    const buildCumulativeSeries = (payments: any[], days: number, startDate: Date) => {
      const dailyTotals = Array.from({ length: days }, () => 0);

      payments.forEach((payment: any) => {
        const date = new Date(payment.TxnDate);
        const dayIndex = Math.max(0, Math.min(days - 1, date.getDate() - 1));
        const total = Number(payment.TotalAmt) || 0;
        const unapplied = Number(payment.UnappliedAmt) || 0;
        const applied = Math.max(total - unapplied, 0);
        dailyTotals[dayIndex] += applied;
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
          fetch(`/api/qbo/payment/query?startDate=${currentStart}&endDate=${currentEnd}&_=${Date.now()}`),
          fetch(`/api/qbo/payment/query?startDate=${lastStart}&endDate=${lastEnd}&_=${Date.now()}`),
        ]);

        if (!currentRes.ok || !lastRes.ok) {
          console.error("Monthly comparison fetch failed:", currentRes.status, lastRes.status);
          throw new Error("Failed to fetch monthly comparison");
        }

        const currentData = await currentRes.json();
        const lastData = await lastRes.json();

        const currentPayments = currentData.payments || [];
        const lastPayments = lastData.payments || [];

        console.log(`[dashboard] Monthly data - current: ${currentPayments.length} payments, last month: ${lastPayments.length} payments`);

        const currentSeries = buildCumulativeSeries(currentPayments, daysSoFar, currentMonthStart);
        const lastSeries = buildCumulativeSeries(lastPayments, compareDays, lastMonthStart);

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
        const today = getLocalDateYmd();
        const [invoiceRes, paymentRes] = await Promise.all([
          fetch(`/api/qbo/invoice/query?startDate=${today}&endDate=${today}&status=paid&allPages=true&_=${Date.now()}`),
          fetch(`/api/qbo/payment/query?startDate=${today}&endDate=${today}&_=${Date.now()}`),
        ]);

        const itemizedPayments: CustomerPayment[] = [];
        const paidByInvoiceId = new Map<string, number>();

        if (invoiceRes.ok) {
          const invoiceData = await invoiceRes.json();
          const invoices = invoiceData?.invoices || [];
          invoices.forEach((inv: any) => {
            const invoiceId = String(inv?.Id || "");
            if (!invoiceId) return;

            const total = Number(inv?.TotalAmt) || 0;
            const balance = Number(inv?.Balance) || 0;
            const paid = Math.max(total - balance, 0);
            if (paid <= 0) return;

            paidByInvoiceId.set(invoiceId, paid);
            itemizedPayments.push({
              id: `inv-${invoiceId}`,
              customerName: inv?.CustomerRef?.name || inv?.CustomerRef?.value || "Unknown",
              appliedAmount: paid,
              totalAmount: total,
              txnDate: inv?.TxnDate || today,
            });
          });
        }

        if (paymentRes.ok) {
          const paymentData = await paymentRes.json();
          const payments = paymentData?.payments || [];

          payments.forEach((payment: any) => {
            const total = Number(payment?.TotalAmt) || 0;
            const unapplied = Number(payment?.UnappliedAmt) || 0;
            const applied = Math.max(total - unapplied, 0);
            if (applied <= 0) return;

            let linkedAmount = 0;
            const lines = Array.isArray(payment?.Line) ? payment.Line : [];
            lines.forEach((line: any) => {
              const lineAmount = Number(line?.Amount) || 0;
              const linked = Array.isArray(line?.LinkedTxn) ? line.LinkedTxn : [];
              const invoiceLinks = linked.filter((txn: any) => txn?.TxnType === "Invoice" && txn?.TxnId);
              if (invoiceLinks.length === 0) return;

              linkedAmount += lineAmount;
              invoiceLinks.forEach((txn: any) => {
                const invoiceId = String(txn.TxnId || "");
                if (!invoiceId) return;
                if (!paidByInvoiceId.has(invoiceId) && lineAmount > 0) {
                  paidByInvoiceId.set(invoiceId, lineAmount);
                  itemizedPayments.push({
                    id: `pay-link-${payment?.Id || "unknown"}-${invoiceId}`,
                    customerName: payment?.CustomerRef?.name || payment?.CustomerRef?.value || "Unknown",
                    appliedAmount: lineAmount,
                    totalAmount: lineAmount,
                    txnDate: payment?.TxnDate || today,
                  });
                }
              });
            });

            const unlinkedApplied = Math.max(applied - linkedAmount, 0);
            if (unlinkedApplied > 0) {
              itemizedPayments.push({
                id: `pay-${payment?.Id || Math.random().toString(36).slice(2)}`,
                customerName: payment?.CustomerRef?.name || payment?.CustomerRef?.value || "Unknown",
                appliedAmount: unlinkedApplied,
                totalAmount: total,
                txnDate: payment?.TxnDate || today,
              });
            }
          });
        }

        const totalApplied = itemizedPayments.reduce((sum, row) => sum + (Number(row.appliedAmount) || 0), 0);
        itemizedPayments.sort((a, b) => b.appliedAmount - a.appliedAmount);

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

  // Fetch undeposited funds (QBO balance + itemized payments)
  useEffect(() => {
    let isMounted = true;
    const fetchUndepositedFunds = async () => {
      setLoadingUndepositedFunds(true);
      try {
        const res = await fetch(`/api/qbo/undeposited-funds?_=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to fetch undeposited funds");
        const data = await res.json();
        if (isMounted) {
          setUndepositedFunds(Number(data.undeposited || 0));
          setUndepositedPayments(
            (data.payments || []).map((p: any) => ({
              id: p.id,
              txnDate: p.txnDate,
              customerName: p.customerName,
              totalAmt: Number(p.totalAmt || 0),
              appliedAmt: Number(p.appliedAmt || 0),
              memo: p.memo || "",
              invoiceNums: p.invoiceNums || [],
            }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch undeposited funds:", err);
        if (isMounted) {
          setUndepositedFunds(0);
          setUndepositedPayments([]);
        }
      } finally {
        if (isMounted) setLoadingUndepositedFunds(false);
      }
    };
    fetchUndepositedFunds();
    const interval = setInterval(fetchUndepositedFunds, 120000);
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
        }
      } catch (err) {
        console.error("Failed to fetch Shopify payouts:", err);
        if (isMounted) {
          setShopifyPayouts([]);
          setShopifyOrders([]);
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

            {/* Undeposited Funds + Shopify Scheduled Deposits */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* QBO Undeposited Funds */}
              <div className="bg-white border border-slate-200 rounded-lg">
                <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Undeposited Funds</h2>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Payments in QBO awaiting bank deposit
                    </p>
                    {!loadingUndepositedFunds && (
                      <p className="mt-1 text-lg font-bold text-amber-600">
                        ${money(undepositedFunds)}
                      </p>
                    )}
                  </div>
                  {undepositedPayments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowUndepositedModal(true)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      View all →
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
                      {loadingUndepositedFunds ? (
                        <tr><td colSpan={3} className="px-5 py-6 text-center text-slate-500">Loading...</td></tr>
                      ) : undepositedPayments.length === 0 ? (
                        <tr><td colSpan={3} className="px-5 py-6 text-center text-slate-500">
                          {undepositedFunds > 0
                            ? `$${money(undepositedFunds)} in Undeposited Funds — no itemized payments found`
                            : "No undeposited funds"}
                        </td></tr>
                      ) : (
                        undepositedPayments.slice(0, 5).map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 text-sm font-medium text-slate-900">{p.customerName}</td>
                            <td className="px-5 py-3 text-sm text-slate-600">{p.txnDate}</td>
                            <td className="px-5 py-3 text-right text-sm font-semibold text-amber-700">
                              ${money(p.appliedAmt || p.totalAmt)}
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
                  </div>
                  {scheduledShopifyPayouts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowDepositsModal(true)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      View all →
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
                      ${money(monthlyTotal)} this month • ${money(lastMonthTotal)} last month
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
                          
                          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                            <div>
                              <div className="text-xs font-medium text-slate-500">Payroll</div>
                              <div className="mt-1 text-base font-semibold text-slate-900">${money(Math.round(animatedPayrollTotal))}</div>
                            </div>
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
                      {printingOpenInvoices ? "Preparing…" : "Print"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowOpenInvoicesModal(true)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      View all →
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
                    View all →
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

            {/* Recent Purchases + Top SKUs */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="bg-white border border-slate-200 rounded-lg">
                <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Recent Purchases</h2>
                    <p className="mt-0.5 text-sm text-slate-600">Latest purchase orders</p>
                  </div>
                  <a href="/admin/purchasing" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">View all →</a>
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

              <div className="bg-white border border-slate-200 rounded-lg">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="text-lg font-semibold text-slate-900">Top SKUs This Month</h2>
                  <p className="mt-0.5 text-sm text-slate-600">Most popular units sold</p>
                </div>
                <div className="px-5 py-4 space-y-3 max-h-96 overflow-y-auto">
                  <TopSkuChart compact={true} />
                </div>
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

            {/* Shopify Payouts / Pending Deposits */}
            <div className="bg-white border border-slate-200 rounded-lg">
              <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Shopify Orders — Deposit Schedule</h2>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {shopifyPaymentsEnabled
                      ? "Itemized Shopify payout transactions grouped by payout schedule"
                      : "Connect Shopify Payments to see payout schedule"}
                  </p>
                  {shopifyBalance && (
                    <p className="mt-1 text-sm font-medium text-slate-700">
                      Shopify balance: <span className="font-bold">{shopifyBalance.currency} ${shopifyBalance.amount}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {shopifyPayouts.filter(p => p.status === "scheduled" || p.status === "in_transit").length > 0 && (
                    <div className="text-right text-xs text-slate-500">
                      {shopifyPayouts.filter(p => p.status === "scheduled" || p.status === "in_transit").length} payout(s) pending
                    </div>
                  )}
                  {shopifyOrders.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowShopifyPayoutsModal(true)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      View all →
                    </button>
                  )}
                </div>
              </div>

              {/* Payout schedule badges */}
              {!loadingShopifyPayouts && shopifyPaymentsEnabled && shopifyPayouts.length > 0 && (
                <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2">
                  {shopifyPayouts.slice(0, 5).map((payout) => (
                    <span
                      key={payout.id}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                        payout.status === "scheduled"
                          ? "bg-blue-100 text-blue-700"
                          : payout.status === "in_transit"
                          ? "bg-amber-100 text-amber-700"
                          : payout.status === "paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        payout.status === "scheduled" ? "bg-blue-500"
                        : payout.status === "in_transit" ? "bg-amber-500"
                        : payout.status === "paid" ? "bg-emerald-500"
                        : "bg-slate-400"
                      }`} />
                      {payout.status === "scheduled" ? "Scheduled" : payout.status === "in_transit" ? "In Transit" : "Deposited"}: {payout.date} — ${Number(payout.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} {payout.currency}
                    </span>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Order</th>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Deposit Date</th>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Order Date</th>
                      <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Order Total</th>
                      <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Fee</th>
                      <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Net (after fees)</th>
                      <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Deposit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loadingShopifyPayouts ? (
                      <tr><td colSpan={7} className="px-5 py-6 text-center text-slate-500">Loading...</td></tr>
                    ) : !shopifyPaymentsEnabled ? (
                      <tr><td colSpan={7} className="px-5 py-6 text-center text-slate-500">Shopify Payments not enabled — connect Shopify Payments to see payout data</td></tr>
                    ) : shopifyOrders.length === 0 ? (
                      <tr><td colSpan={7} className="px-5 py-6 text-center text-slate-500">No itemized Shopify payout transactions found</td></tr>
                    ) : (
                      shopifyOrders.slice(0, 8).map((order) => {
                        const depositLabel =
                          order.pendingDepositStatus === "paid"
                            ? "Deposited"
                            : order.pendingDepositStatus === "in_transit"
                            ? "In Transit"
                            : order.pendingDepositStatus === "scheduled"
                            ? "Scheduled"
                            : order.financial_status === "paid"
                            ? "Paid — not linked"
                            : order.financial_status || "—";
                        const depositColor =
                          order.pendingDepositStatus === "paid"
                            ? "bg-emerald-100 text-emerald-700"
                            : order.pendingDepositStatus === "in_transit"
                            ? "bg-amber-100 text-amber-700"
                            : order.pendingDepositStatus === "scheduled"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600";
                        return (
                          <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 font-mono text-sm text-slate-700">{order.name}</td>
                            <td className="px-5 py-3 text-sm font-medium text-slate-900">{order.payoutDate || "—"}</td>
                            <td className="px-5 py-3 text-sm text-slate-600">{order.created_at?.slice(0, 10) || "—"}</td>
                            <td className="px-5 py-3 text-right text-sm font-semibold text-slate-900">
                              ${Number(order.total_price).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-5 py-3 text-right text-sm text-slate-500">
                              {order.fee
                                ? `$${Number(order.fee).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                                : "—"}
                            </td>
                            <td className="px-5 py-3 text-right text-sm text-slate-700">
                              {order.netAmount
                                ? `$${Number(order.netAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                                : "—"}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${depositColor}`}>
                                {depositLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
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

            {/* Undeposited Funds Modal */}
            {showUndepositedModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">All Undeposited Payments</h2>
                      <p className="mt-0.5 text-sm text-slate-600">Total: ${money(undepositedFunds)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowUndepositedModal(false)}
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
                          <th className="px-5 py-3 text-left text-xs font-medium uppercase text-slate-500">Invoices</th>
                          <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Amount</th>
                          <th className="px-5 py-3 text-right text-xs font-medium uppercase text-slate-500">Account</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {undepositedPayments.length === 0 ? (
                          <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-500">No itemized undeposited payments found</td></tr>
                        ) : (
                          undepositedPayments.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="px-5 py-3 font-medium text-slate-900">{p.customerName}</td>
                              <td className="px-5 py-3 text-sm text-slate-600">{p.txnDate}</td>
                              <td className="px-5 py-3 text-sm text-slate-500 font-mono">{p.invoiceNums.join(", ") || "—"}</td>
                              <td className="px-5 py-3 text-right font-semibold text-amber-700">${money(p.appliedAmt || p.totalAmt)}</td>
                              <td className="px-5 py-3 text-right text-sm text-slate-500">Undeposited Funds</td>
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
                      <h2 className="text-lg font-semibold text-slate-900">All Shopify Orders — Deposit Status</h2>
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
                            payout.status === "scheduled" ? "bg-blue-100 text-blue-700"
                            : payout.status === "in_transit" ? "bg-amber-100 text-amber-700"
                            : payout.status === "paid" ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {payout.date} — ${Number(payout.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} {payout.currency} ({payout.status})
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
                          const depositLabel =
                            order.pendingDepositStatus === "paid" ? "Deposited"
                            : order.pendingDepositStatus === "in_transit" ? "In Transit"
                            : order.pendingDepositStatus === "scheduled" ? "Scheduled"
                            : order.financial_status === "paid" ? "Paid — not linked"
                            : order.financial_status || "—";
                          const depositColor =
                            order.pendingDepositStatus === "paid" ? "bg-emerald-100 text-emerald-700"
                            : order.pendingDepositStatus === "in_transit" ? "bg-amber-100 text-amber-700"
                            : order.pendingDepositStatus === "scheduled" ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600";
                          return (
                            <tr key={order.id} className="hover:bg-slate-50">
                              <td className="px-5 py-3 font-mono text-sm text-slate-700">{order.name}</td>
                              <td className="px-5 py-3 text-sm font-medium text-slate-900">{order.payoutDate || "—"}</td>
                              <td className="px-5 py-3 text-sm text-slate-600">{order.created_at?.slice(0, 10) || "—"}</td>
                              <td className="px-5 py-3 text-right text-sm font-semibold text-slate-900">
                                ${Number(order.total_price).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-5 py-3 text-right text-sm text-slate-500">
                                {order.fee ? `$${Number(order.fee).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                              </td>
                              <td className="px-5 py-3 text-right text-sm text-slate-700">
                                {order.netAmount ? `$${Number(order.netAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
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
