"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useState } from "react";
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

interface PaymentSummary {
  customerName: string;
  totalApplied: number;
  paymentCount: number;
  lastTxnDate: string;
}

interface UnpaidInvoice {
  id: string;
  docNumber: string;
  customerName: string;
  totalAmt: number;
  balance: number;
  txnDate: string;
  salesRep?: string;
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

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  const [monthlyGoal, setMonthlyGoal] = useState<number>(600000);
  const [goalInput, setGoalInput] = useState<string>("600000");
  const [goalStatus, setGoalStatus] = useState<string | null>(null);
  const [updatingGoal, setUpdatingGoal] = useState(false);
  const [qboSales, setQboSales] = useState<number | null>(null);
  const [qboInvoiceCount, setQboInvoiceCount] = useState<number>(0);
  const [loadingQbo, setLoadingQbo] = useState(true);
  const [repSalesData, setRepSalesData] = useState<RepData[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
  const [loadingUnpaid, setLoadingUnpaid] = useState(false);
  const [showAllUnpaid, setShowAllUnpaid] = useState(false);
  const [paymentsToday, setPaymentsToday] = useState<PaymentSummary[]>([]);
  const [paymentsTotal, setPaymentsTotal] = useState<number>(0);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [lastPaymentsUpdated, setLastPaymentsUpdated] = useState<Date | null>(null);

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
        setGoalInput(String(value));
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
          setQboInvoiceCount(data.count || 0);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch QBO invoices:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingQbo(false);
      });

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

  async function handleGoalSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGoalStatus(null);
    setUpdatingGoal(true);
    try {
      const numericGoal = Number(goalInput);
      console.log("[dashboard] Saving goal:", numericGoal);
      const res = await fetch(`/api/goals/monthly`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalAmount: numericGoal }),
      });
      const payload = await res.json().catch(() => null);
      console.log("[dashboard] Full payload:", payload);
      console.log("[dashboard] Payload keys:", Object.keys(payload || {}));
      console.log("[dashboard] res.status:", res.status, "res.ok:", res.ok);
      if (!res.ok) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }
      // The API returns { ok: true, goal: data }
      const saved = payload?.goal;
      console.log("[dashboard] Saved goal object:", saved);
      if (saved?.goal_amount) {
        console.log("[dashboard] Updating monthly goal to:", saved.goal_amount);
        setMonthlyGoal(Number(saved.goal_amount));
        setGoalInput(String(saved.goal_amount));
        setGoalStatus("Saved!");
        // Clear status after 2 seconds
        setTimeout(() => setGoalStatus(null), 2000);
      } else {
        console.warn("[dashboard] Response missing goal_amount:", saved);
        setGoalStatus("Save failed: No goal amount returned");
      }
    } catch (err: any) {
      console.error("[dashboard] Save error:", err);
      setGoalStatus(err?.message || "Save failed");
    } finally {
      setUpdatingGoal(false);
    }
  }

  const totalSales = qboSales !== null ? qboSales : mockReps.reduce((sum, rep) => sum + rep.sales, 0);
  const totalCommission = repSalesData.length > 0
    ? repSalesData.reduce((sum, rep) => sum + rep.commission, 0)
    : mockReps.reduce((sum, rep) => sum + rep.commission, 0);
  const percentOfGoal = monthlyGoal > 0 ? Math.round((totalSales / monthlyGoal) * 100) : 0;
  const dailyPace = totalSales / 15; // 15 days elapsed in month (approx)
  const projectedMonth = dailyPace * 30;

  // Fetch unpaid invoices for current month
  useEffect(() => {
    const fetchUnpaidInvoices = async () => {
      setLoadingUnpaid(true);
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

        const formatted: UnpaidInvoice[] = invoices.map((inv: any) => {
          // Extract sales rep using same logic as sales-by-rep route
          let rep = "Unassigned";
          
          // First check CustomField
          if (inv.CustomField && Array.isArray(inv.CustomField)) {
            const repField = inv.CustomField.find((f: any) => 
              f.Name === "Sales Rep" || f.Name === "SalesRep" || f.Name === "Rep"
            );
            if (repField && repField.StringValue) {
              rep = repField.StringValue.trim();
            }
          }
          
          // Fall back to CustomerMemo if not found
          if (rep === "Unassigned" && inv.CustomerMemo?.value) {
            const memo = inv.CustomerMemo.value;
            const repMatch = memo.match(/Rep:\s*([A-Za-z\s/]+)/i);
            if (repMatch) {
              rep = repMatch[1].trim();
            }
          }
          
          return {
            id: inv.Id,
            docNumber: inv.DocNumber,
            customerName: inv.CustomerRef?.name || "Unknown",
            totalAmt: Number(inv.TotalAmt) || 0,
            balance: Number(inv.Balance) || 0,
            txnDate: inv.TxnDate,
            salesRep: rep !== "Unassigned" ? rep : undefined,
          };
        });

        console.log(`[dashboard] Unpaid invoices fetched: ${formatted.length} invoices`);
        setUnpaidInvoices(formatted);
      } catch (error) {
        console.error("Error fetching unpaid invoices:", error);
        setUnpaidInvoices([]);
      } finally {
        setLoadingUnpaid(false);
      }
    };

    fetchUnpaidInvoices();
  }, []);

  // Fetch payments made today (live tracking)
  useEffect(() => {
    let isMounted = true;

    const fetchPaymentsToday = async () => {
      setLoadingPayments(true);
      try {
        const today = new Date().toLocaleDateString("en-CA");
        const res = await fetch(`/api/qbo/payment/query?startDate=${today}&endDate=${today}&_=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to fetch payments");
        const data = await res.json();
        const payments = data.payments || [];

        const summaryMap = new Map<string, PaymentSummary>();
        let totalApplied = 0;

        payments.forEach((payment: any) => {
          const total = Number(payment.TotalAmt) || 0;
          const unapplied = Number(payment.UnappliedAmt) || 0;
          const applied = Math.max(total - unapplied, 0);
          if (applied <= 0) return;

          const customerName = payment.CustomerRef?.name || "Unknown Customer";
          totalApplied += applied;

          const existing = summaryMap.get(customerName);
          if (existing) {
            existing.totalApplied += applied;
            existing.paymentCount += 1;
            if (payment.TxnDate && payment.TxnDate > existing.lastTxnDate) {
              existing.lastTxnDate = payment.TxnDate;
            }
          } else {
            summaryMap.set(customerName, {
              customerName,
              totalApplied: applied,
              paymentCount: 1,
              lastTxnDate: payment.TxnDate || today,
            });
          }
        });

        const summary = Array.from(summaryMap.values()).sort((a, b) => b.totalApplied - a.totalApplied);

        if (isMounted) {
          setPaymentsToday(summary);
          setPaymentsTotal(totalApplied);
          setLastPaymentsUpdated(new Date());
        }
      } catch (error) {
        console.error("Failed to fetch payments today:", error);
        if (isMounted) {
          setPaymentsToday([]);
          setPaymentsTotal(0);
        }
      } finally {
        if (isMounted) setLoadingPayments(false);
      }
    };

    fetchPaymentsToday();
    const interval = setInterval(fetchPaymentsToday, 30000);

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
                    Year-to-date sales, commission accrual, and live payments received today. Read-only overview; manage commissions and price list separately.
                  </p>
                </div>
              </div>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
                <div className="text-xs uppercase font-semibold text-slate-500">Monthly Goal</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">${money(monthlyGoal)}</div>
                <div className="mt-1 text-xs text-slate-600">Target for month</div>
              </div>

              <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
                <div className="text-xs uppercase font-semibold text-slate-500">Sales to Date</div>
                <div className="mt-2 text-2xl font-bold text-emerald-700">
                  {loadingQbo ? (
                    <span className="text-slate-400">Loading...</span>
                  ) : (
                    `$${money(totalSales)}`
                  )}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {qboSales !== null ? 'Paid invoices this month' : 'YTD aggregate'}
                </div>
              </div>

              <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
                <div className="text-xs uppercase font-semibold text-slate-500">% of Goal</div>
                <div className="mt-2 text-2xl font-bold text-blue-700">{percentOfGoal}%</div>
                <div className="mt-1 text-xs text-slate-600">Pace check</div>
              </div>

              <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
                <div className="text-xs uppercase font-semibold text-slate-500">Commission Accrued</div>
                <div className="mt-2 text-2xl font-bold text-indigo-700">${money(totalCommission)}</div>
                <div className="mt-1 text-xs text-slate-600">Payroll liability</div>
              </div>

              <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
                <div className="text-xs uppercase font-semibold text-slate-500">Order Count</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {loadingQbo ? (
                    <span className="text-slate-400">...</span>
                  ) : qboSales !== null ? (
                    qboInvoiceCount
                  ) : (
                    mockReps.reduce((sum, r) => sum + r.orders, 0)
                  )}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {qboSales !== null ? 'Paid invoices' : 'Total invoices'}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase font-semibold text-slate-500">Monthly Progress</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {money(totalSales)} of {money(monthlyGoal)} | Projected: {money(projectedMonth)}
                  </div>
                </div>
              </div>
              <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
                  style={{ width: `${Math.min(percentOfGoal, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Payments Made Today */}
            <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
              <div className="border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Payments Made Today</h2>
                    <p className="text-sm text-slate-600">Live tracking of customers who paid today</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Total Received Today</div>
                    <div className="text-lg font-semibold text-emerald-700">${money(paymentsTotal)}</div>
                    <div className="text-xs text-slate-500">
                      {lastPaymentsUpdated ? `Updated ${lastPaymentsUpdated.toLocaleTimeString()}` : "Updating..."}
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Payments
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Amount Applied
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Last Payment
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingPayments ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                          Loading payments...
                        </td>
                      </tr>
                    ) : paymentsToday.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                          No payments recorded today
                        </td>
                      </tr>
                    ) : (
                      paymentsToday.map((payment) => (
                        <tr key={payment.customerName} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-3 font-medium text-slate-900">{payment.customerName}</td>
                          <td className="px-6 py-3 text-right text-slate-600">{payment.paymentCount}</td>
                          <td className="px-6 py-3 text-right font-semibold text-emerald-700">
                            ${money(payment.totalApplied)}
                          </td>
                          <td className="px-6 py-3 text-right text-slate-600">{payment.lastTxnDate}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Unpaid Invoices Section */}
            <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
              <div className="border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Unpaid Invoices</h2>
                  <p className="text-sm text-slate-600">Current month invoices awaiting payment</p>
                </div>
              </div>

              {loadingUnpaid ? (
                <div className="px-6 py-8 text-center text-slate-500">
                  Loading unpaid invoices...
                </div>
              ) : unpaidInvoices.length === 0 ? (
                <div className="px-6 py-8 text-center text-slate-500">
                  No unpaid invoices this month.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Invoice #
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Customer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Sales Rep
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Date
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                          Total
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(showAllUnpaid ? unpaidInvoices : unpaidInvoices.slice(0, 15)).map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-3 font-mono text-slate-700">{inv.docNumber}</td>
                          <td className="px-6 py-3 text-slate-700">{inv.customerName}</td>
                          <td className="px-6 py-3 text-slate-600">{inv.salesRep || "-"}</td>
                          <td className="px-6 py-3 text-slate-600">
                            {new Date(inv.txnDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </td>
                          <td className="px-6 py-3 text-right text-slate-700">${money(inv.totalAmt)}</td>
                          <td className="px-6 py-3 text-right font-semibold text-red-700">${money(inv.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">
                        Total Unpaid: ${money(unpaidInvoices.reduce((sum, inv) => sum + inv.balance, 0))}
                      </div>
                      {unpaidInvoices.length > 15 && (
                        <button
                          onClick={() => setShowAllUnpaid(!showAllUnpaid)}
                          className="rounded-lg px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 transition"
                        >
                          {showAllUnpaid ? "Show Less" : `View All (${unpaidInvoices.length})`}
                        </button>
                      )}
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
