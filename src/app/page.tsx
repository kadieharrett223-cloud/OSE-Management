"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
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
  const [qboSales, setQboSales] = useState<number | null>(null);
  const [lastYearMonthSales, setLastYearMonthSales] = useState<number | null>(null);
  const [loadingLastYearMonth, setLoadingLastYearMonth] = useState(true);
  const [repSalesData, setRepSalesData] = useState<RepData[]>([]);
  const [outstandingTotal, setOutstandingTotal] = useState<number>(0);
  const [outstandingCount, setOutstandingCount] = useState<number>(0);
  const [monthlyTotal, setMonthlyTotal] = useState<number>(0);
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
  const totalExpenses = paidExpensesTotal + payrollExpenseTotal;
  const profitThisMonth = monthlyTotal - totalExpenses;
  const maxIncomeExpense = Math.max(monthlyTotal, totalExpenses, 1);

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

  // Fetch sales for current and previous month (paid invoices only)
  useEffect(() => {
    const fetchMonthlySales = async () => {
      setLoadingMonthlyTotal(true);
      setLoadingLastMonthTotal(true);
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const startDate = `${year}-${month}-01`;
        const endDate = now.toISOString().slice(0, 10);

        const lastMonthStart = new Date(year, now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(year, now.getMonth(), 0);
        const lastMonthStartDate = `${lastMonthStart.getFullYear()}-${String(lastMonthStart.getMonth() + 1).padStart(2, "0")}-01`;
        const lastMonthEndDate = `${lastMonthEnd.getFullYear()}-${String(lastMonthEnd.getMonth() + 1).padStart(2, "0")}-${String(lastMonthEnd.getDate()).padStart(2, "0")}`;

        const [paidInvoicesResponse, lastMonthResponse] = await Promise.all([
          fetch(`/api/qbo/invoice/query?startDate=${startDate}&endDate=${endDate}&status=paid&allPages=true&totalsOnly=true`),
          fetch(`/api/qbo/invoice/query?startDate=${lastMonthStartDate}&endDate=${lastMonthEndDate}&status=paid&allPages=true&totalsOnly=true`),
        ]);

        if (!paidInvoicesResponse.ok || !lastMonthResponse.ok) {
          throw new Error("Failed to fetch monthly sales");
        }

        const [paidInvoicesData, lastMonthData] = await Promise.all([
          paidInvoicesResponse.json(),
          lastMonthResponse.json(),
        ]);

        const paidInvoicesTotal = Number(paidInvoicesData.totalPaid || 0);
        const lastMonthTotalPaid = Number(lastMonthData.totalPaid || 0);

        console.log(`[dashboard] Monthly sales fetched: this month $${paidInvoicesTotal}, last month $${lastMonthTotalPaid}`);
        setMonthlyTotal(paidInvoicesTotal);
        setLastMonthTotal(lastMonthTotalPaid);
      } catch (error) {
        console.error("Error fetching monthly sales:", error);
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
        }
      } catch (error) {
        console.error("Failed to fetch profit data:", error);
        if (isMounted) {
          setPaidExpensesTotal(0);
          setPayrollExpenseTotal(0);
          setTopExpenses([]);
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

  // Fetch same month last year (month-to-date) paid sales
  useEffect(() => {
    let isMounted = true;
    const fetchLastYearMonthSales = async () => {
      setLoadingLastYearMonth(true);
      try {
        const now = new Date();
        const lastYear = now.getFullYear() - 1;
        const month = (now.getMonth() + 1).toString().padStart(2, "0");
        const startDate = `${lastYear}-${month}-01`;
        const lastDay = new Date(lastYear, now.getMonth() + 1, 0).getDate();
        const endDate = `${lastYear}-${month}-${String(lastDay).padStart(2, "0")}`;
        const res = await fetch(
          `/api/qbo/invoice/query?startDate=${startDate}&endDate=${endDate}&status=paid&allPages=true&totalsOnly=true`
        );
        if (!res.ok) throw new Error("Failed to fetch last year month sales");
        const data = await res.json();
        if (isMounted) {
          setLastYearMonthSales(Number(data.totalPaid || 0));
        }
      } catch (error) {
        console.error("Failed to fetch last year month sales:", error);
        if (isMounted) setLastYearMonthSales(null);
      } finally {
        if (isMounted) setLoadingLastYearMonth(false);
      }
    };

    fetchLastYearMonthSales();
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
        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900">
          <div className="mx-auto max-w-7xl px-3 md:px-4 py-3 md:py-4 space-y-4 md:space-y-8 sm:px-6 lg:px-8 print-hidden">
            {/* Header */}
            <header className="flex flex-col gap-2 md:gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-700">Dashboard</p>
              <div className="flex flex-col justify-between gap-3 md:gap-4 lg:flex-row lg:items-center">
                <div className="space-y-1 md:space-y-2">
                  <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Company Performance</h1>
                  <p className="max-w-2xl text-sm text-slate-600">
                    Business health at a glance with monthly trends, action items, and recent activity.
                  </p>
                </div>
              </div>
            </header>

            {/* Business Health Snapshot */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
                <div className="text-xs uppercase font-semibold text-slate-500">Sales This Month</div>
                <div className="mt-2 text-2xl font-bold text-emerald-700">
                  {loadingMonthlyTotal ? <span className="text-slate-400">Loading...</span> : `$${money(monthlyTotal)}`}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {loadingLastMonthTotal ? "Loading last month..." : `${money(lastMonthTotal)} last month • paid invoices`}
                </div>
              </div>

              <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
                <div className="text-xs uppercase font-semibold text-slate-500">This Month Last Year</div>
                <div className="mt-2 text-2xl font-bold text-emerald-700">
                  {loadingLastYearMonth ? <span className="text-slate-400">Loading...</span> : `$${money(lastYearMonthSales ?? 0)}`}
                </div>
                <div className="mt-1 text-xs text-slate-600">Same month last year • paid invoices</div>
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
                    {loadingMonthlyTotal || loadingLastMonthTotal
                      ? "Loading totals..."
                      : `${money(monthlyTotal)} this month • ${money(lastMonthTotal)} last month`}
                  </div>
                </div>
                <div className="mt-6">
                  {currentMonthTrend.length === 0 && lastMonthTrend.length === 0 ? (
                    <div className="h-40 flex items-center justify-center bg-slate-50 rounded-lg text-sm text-slate-500">
                      Loading trend data...
                    </div>
                  ) : (
                    <>
                      <svg viewBox="0 0 320 160" preserveAspectRatio="none" className="h-40 w-full">
                        {lastMonthTrend.length > 0 && (
                          <path
                            d={buildLinePath(lastMonthTrend, Math.max(...lastMonthTrend.filter(v => v !== null && v !== undefined), 1), 320, 160, 12)}
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth="3"
                          />
                        )}
                        {currentMonthTrend.length > 0 && (
                          <path
                            d={buildLinePath(currentMonthTrend, Math.max(...currentMonthTrend.filter(v => v !== null && v !== undefined), 1), 320, 160, 12)}
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
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Income vs Expenses</h2>
                    <p className="text-sm text-slate-600">Month-to-date profit snapshot</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    {loadingProfit || loadingMonthlyTotal ? "Loading..." : `Profit $${money(profitThisMonth)}`}
                  </div>
                </div>

                <div className="mt-4">
                  {loadingProfit || loadingMonthlyTotal ? (
                    <div className="h-40 flex items-center justify-center bg-slate-50 rounded-lg text-sm text-slate-500">
                      Loading income and expenses...
                    </div>
                  ) : (
                    <>
                      <div className="rounded-lg bg-slate-50 p-4">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <span>Income</span>
                          <span>${money(monthlyTotal)}</span>
                        </div>
                        <div className="mt-3 h-28 flex items-end gap-2">
                          <div className="flex-1">
                            <div
                              className="w-full rounded-md bg-emerald-500"
                              style={{ height: `${(monthlyTotal / maxIncomeExpense) * 100}%` }}
                            />
                          </div>
                          <div className="flex-1">
                            <div
                              className="w-full rounded-md bg-amber-500"
                              style={{ height: `${(totalExpenses / maxIncomeExpense) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>Income</span>
                          <span>Expenses</span>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg bg-slate-50 p-4">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <span>Expense Breakdown</span>
                          <span>${money(totalExpenses)}</span>
                        </div>
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Payroll</span>
                            <span className="font-semibold text-slate-900">${money(payrollExpenseTotal)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Bills</span>
                            <span className="font-semibold text-slate-900">${money(paidExpensesTotal)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <span>Top Expenses (Paid)</span>
                          <span>Month-to-date</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {topExpenses.length === 0 ? (
                            <div className="text-sm text-slate-500">No paid expenses yet this month.</div>
                          ) : (
                            topExpenses.map((item) => (
                              <div key={item.name} className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">{item.name}</span>
                                <span className="font-semibold text-slate-900">${money(item.total)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Tables */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
                <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Open Invoices</h2>
                    <p className="text-sm text-slate-600">Unpaid invoices awaiting payment</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handlePrintOpenInvoices}
                      className="text-sm text-slate-600 hover:text-slate-800"
                    >
                      {printingOpenInvoices ? "Preparing print…" : "Print"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowOpenInvoicesModal(true)}
                      className="text-sm text-blue-600 hover:text-blue-700"
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
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-6 py-3 text-left font-semibold">Invoice</th>
                        <th className="px-6 py-3 text-left font-semibold">Customer</th>
                        <th className="px-6 py-3 text-right font-semibold">Amount Due</th>
                        <th className="px-6 py-3 text-right font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingRecentInvoices ? (
                        <tr><td colSpan={4} className="px-6 py-6 text-center text-slate-500">Loading...</td></tr>
                      ) : recentInvoices.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-6 text-center text-slate-500">No open invoices</td></tr>
                      ) : (
                        recentInvoices.slice(0, 5).map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="px-6 py-3 font-mono text-slate-700">{inv.docNumber}</td>
                            <td className="px-6 py-3 text-slate-700">{inv.customerName}</td>
                            <td className="px-6 py-3 text-right text-slate-700">${money(inv.balance)}</td>
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
                  <div className="sm:hidden px-4 py-4 space-y-3">
                    {loadingRecentInvoices ? (
                      <div className="text-sm text-slate-500">Loading...</div>
                    ) : recentInvoices.length === 0 ? (
                      <div className="text-sm text-slate-500">No open invoices</div>
                    ) : (
                      recentInvoices.slice(0, 5).map((inv) => (
                        <div key={inv.id} className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-900">{inv.docNumber}</span>
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${inv.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {inv.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">{inv.customerName}</p>
                          <p className="text-sm font-semibold text-slate-900">${money(inv.balance)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
                <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Customer Payments Today</h2>
                    <p className="text-sm text-slate-600">Payments received from customers today</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Total received: <span className="font-semibold text-slate-900">${money(paymentsTotal)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCustomerPaymentsModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    View all →
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full hidden sm:table">
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
                          <td colSpan={4} className="px-6 py-6 text-center text-slate-500">Loading...</td>
                        </tr>
                      ) : customerPaymentsToday.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-6 text-center text-slate-500">No customer payments received today</td>
                        </tr>
                      ) : (
                        customerPaymentsToday.slice(0, 5).map((payment) => (
                          <tr key={payment.id} className="hover:bg-slate-50">
                            <td className="px-6 py-3 font-medium text-slate-900">{payment.customerName}</td>
                            <td className="px-6 py-3 text-right font-semibold text-emerald-700">${money(payment.appliedAmount)}</td>
                            <td className="px-6 py-3 text-right text-slate-600">${money(payment.totalAmount)}</td>
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
                        <div key={payment.id} className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-sm font-semibold text-slate-900">{payment.customerName}</p>
                          <div className="mt-1 flex items-center justify-between text-sm">
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

              <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
                <div className="border-b border-slate-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-slate-900">Top SKUs This Month</h2>
                  <p className="text-sm text-slate-600">Most popular units sold</p>
                </div>
                <div className="px-6 py-4 space-y-3 max-h-96 overflow-y-auto">
                  <TopSkuChart compact={true} />
                </div>
              </div>
            </div>

            {/* Bottom Listed Cards */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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

            {showOpenInvoicesModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl ring-1 ring-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">All Open Invoices</h2>
                      <p className="text-sm text-slate-600">Full list of unpaid invoices</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOpenInvoicesModal(false)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-6 py-3 text-left font-semibold">Invoice</th>
                          <th className="px-6 py-3 text-left font-semibold">Customer</th>
                          <th className="px-6 py-3 text-right font-semibold">Amount Due</th>
                          <th className="px-6 py-3 text-right font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recentInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-6 text-center text-slate-500">
                              No open invoices
                            </td>
                          </tr>
                        ) : (
                          recentInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50">
                              <td className="px-6 py-3 font-mono text-slate-700">{inv.docNumber}</td>
                              <td className="px-6 py-3 text-slate-700">{inv.customerName}</td>
                              <td className="px-6 py-3 text-right text-slate-700">${money(inv.balance)}</td>
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
              </div>
            )}

            {showCustomerPaymentsModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl ring-1 ring-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">All Customer Payments Today</h2>
                      <p className="text-sm text-slate-600">Total received: ${money(paymentsTotal)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCustomerPaymentsModal(false)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
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
