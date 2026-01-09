"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/Sidebar";

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

type SortField = "sales" | "commission" | "orders";

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
  const { data: session } = useSession();
  const [sortField, setSortField] = useState<SortField>("sales");
  const [monthlyGoal, setMonthlyGoal] = useState<number>(600000);
  const [goalInput, setGoalInput] = useState<string>("600000");
  const [goalStatus, setGoalStatus] = useState<string | null>(null);
  const [updatingGoal, setUpdatingGoal] = useState(false);
  const [qboSales, setQboSales] = useState<number | null>(null);
  const [qboInvoiceCount, setQboInvoiceCount] = useState<number>(0);
  const [loadingQbo, setLoadingQbo] = useState(true);
  const [repSalesData, setRepSalesData] = useState<RepData[]>([]);
  const [loadingReps, setLoadingReps] = useState(true);
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
  const [loadingUnpaid, setLoadingUnpaid] = useState(false);
  const [showAllUnpaid, setShowAllUnpaid] = useState(false);

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
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-${String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
    
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

    // Fetch sales by rep
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
      })
      .finally(() => {
        if (isMounted) setLoadingReps(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Load QuickBooks invoice data for current month
  useEffect(() => {
    let isMounted = true;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-${String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
    
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

    // Fetch sales by rep
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

  // Use real rep data if available, otherwise fall back to mock
  const displayReps = repSalesData.length > 0 ? repSalesData : mockReps.map(r => ({
    repName: r.name,
    isPrimary: true,
    totalSales: r.sales,
    commission: r.commission,
    invoiceCount: r.orders,
    commissionRate: 0.05,
  }));

  const totalSales = qboSales !== null ? qboSales : mockReps.reduce((sum, rep) => sum + rep.sales, 0);
  const totalCommission = displayReps.reduce((sum, rep) => sum + rep.commission, 0);
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

  // Show ALL reps on leaderboard (both salary and commission)
  const sortedReps = [...displayReps].sort((a, b) => {
    if (sortField === "sales") return b.totalSales - a.totalSales;
    if (sortField === "commission") return b.commission - a.commission;
    return b.invoiceCount - a.invoiceCount;
  });

  // Separate primary and bonus reps
  const commissionReps = displayReps.filter(r => r.isPrimary);
  const bonusReps = displayReps.filter(r => !r.isPrimary);

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
                    Year-to-date sales, commission accrual, and sales rep leaderboard. Read-only overview; manage commissions and price list separately.
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
                {session && (
                  <form className="mt-3 flex gap-2" onSubmit={handleGoalSave}>
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      aria-label="Monthly goal"
                    />
                    <button
                      type="submit"
                      disabled={updatingGoal}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {updatingGoal ? "Saving" : "Save"}
                    </button>
                  </form>
                )}
                {goalStatus && (
                  <div className="mt-1 text-xs text-slate-500">{goalStatus}</div>
                )}
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

            {/* Sales Rep Leaderboard */}
            <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
              <div className="border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Sales Rep Leaderboard</h2>
                    <p className="text-sm text-slate-600">All sales representatives (commission & salary)</p>
                  </div>
                  <div className="flex gap-2">
                    {(["sales", "commission", "orders"] as const).map((field) => (
                      <button
                        key={field}
                        onClick={() => setSortField(field)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                          sortField === field
                            ? "bg-blue-600 text-white shadow-md"
                            : "border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
                        }`}
                        type="button"
                      >
                        {field === "sales" ? "Sales" : field === "commission" ? "Commission" : "Orders"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Rep Name
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Sales
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Commission
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Orders
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingReps ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                          Loading sales rep data...
                        </td>
                      </tr>
                    ) : commissionReps.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                          No commission rep data available
                        </td>
                      </tr>
                    ) : (
                      [...commissionReps].sort((a, b) => {
                        if (sortField === "sales") return b.totalSales - a.totalSales;
                        if (sortField === "commission") return b.commission - a.commission;
                        return b.invoiceCount - a.invoiceCount;
                      }).map((rep, idx) => (
                        <tr key={rep.repName + idx} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-3 font-medium text-slate-900">{rep.repName}</td>
                          <td className="px-6 py-3 text-right font-semibold text-emerald-700">
                            ${money(rep.totalSales)}
                          </td>
                          <td className="px-6 py-3 text-right font-semibold text-indigo-700">
                            ${money(rep.commission)}
                          </td>
                          <td className="px-6 py-3 text-right text-slate-600">{rep.invoiceCount}</td>
                          <td className="px-6 py-3 text-right text-slate-600">
                            {(rep.commissionRate * 100).toFixed(1)}%
                          </td>
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

            {/* Bonus Reps Section (SC/CR) */}
            {bonusReps.length > 0 && (
              <div className="rounded-xl bg-blue-50 shadow-md ring-1 ring-blue-200">
                <div className="border-b border-blue-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-slate-900">Bonus Tracking (Support/Admin)</h2>
                  <p className="text-sm text-slate-600">Salary employees tracking toward $150k bonus threshold</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                  {bonusReps.map((rep) => (
                    <div key={rep.repName} className="rounded-lg bg-white p-4 border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-slate-900">{rep.repName}</p>
                          <p className="text-xs text-slate-600">{rep.invoiceCount} invoices processed</p>
                        </div>
                        {rep.bonusProgress?.hasEarnedBonus && (
                          <span className="inline-block rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                            Bonus Earned!
                          </span>
                        )}
                      </div>
                      
                      <div className="mb-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600">Bonus Progress</span>
                          <span className="font-semibold text-slate-900">
                            ${money(rep.bonusProgress?.salesAmount || 0)} / $150,000
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              rep.bonusProgress?.hasEarnedBonus ? "bg-green-500" : "bg-blue-500"
                            }`}
                            style={{
                              width: `${Math.min(rep.bonusProgress?.percentToThreshold || 0, 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="text-xs text-slate-600">
                        {rep.bonusProgress?.hasEarnedBonus ? (
                          <span className="text-green-700 font-semibold">
                            Earning commission on sales above $150k
                          </span>
                        ) : (
                          <span>
                            ${money(150000 - (rep.bonusProgress?.salesAmount || 0))} more to earn bonus
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
                <div className="text-xs uppercase font-semibold text-slate-500">Top Performer</div>
                <div className="mt-2">
                  {loadingReps ? (
                    <div className="text-sm text-slate-400">Loading...</div>
                  ) : commissionReps.length > 0 ? (
                    <>
                      <div className="text-lg font-semibold text-slate-900">
                        {[...commissionReps].sort((a, b) => b.totalSales - a.totalSales)[0]?.repName}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        ${money([...commissionReps].sort((a, b) => b.totalSales - a.totalSales)[0]?.totalSales || 0)} | {[...commissionReps].sort((a, b) => b.totalSales - a.totalSales)[0]?.invoiceCount} orders
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-500">No data</div>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
                <div className="text-xs uppercase font-semibold text-slate-500">Avg Sale per Rep</div>
                <div className="mt-2">
                  {loadingReps ? (
                    <div className="text-sm text-slate-400">Loading...</div>
                  ) : commissionReps.length > 0 ? (
                    <>
                      <div className="text-lg font-semibold text-slate-900">
                        ${money(commissionReps.reduce((s, r) => s + r.totalSales, 0) / commissionReps.length)}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {commissionReps.length} active reps
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-500">No data</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
