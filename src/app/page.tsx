"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/Sidebar";

const money = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface RepData {
  repName: string;
  totalSales: number;
  commission: number;
  invoiceCount: number;
  commissionRate: number;
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

  async function handleGoalSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGoalStatus(null);
    setUpdatingGoal(true);
    try {
      const numericGoal = Number(goalInput);
      const res = await fetch(`/api/goals/monthly`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalAmount: numericGoal }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to save goal");
      }
      const saved = payload?.goal;
      if (saved?.goal_amount) {
        setMonthlyGoal(Number(saved.goal_amount));
        setGoalInput(String(saved.goal_amount));
      }
      setGoalStatus("Saved");
    } catch (err: any) {
      setGoalStatus(err?.message || "Save failed");
    } finally {
      setUpdatingGoal(false);
    }
  }

  const totalSales = qboSales !== null ? qboSales : mockReps.reduce((sum, rep) => sum + rep.sales, 0);
  
  // Use real rep data if available, otherwise fall back to mock
  const displayReps = repSalesData.length > 0 ? repSalesData : mockReps.map(r => ({
    repName: r.name,
    totalSales: r.sales,
    commission: r.commission,
    invoiceCount: r.orders,
    commissionRate: 0.05,
  }));

  const totalCommission = displayReps.reduce((sum, rep) => sum + rep.commission, 0);
  const percentOfGoal = monthlyGoal > 0 ? Math.round((totalSales / monthlyGoal) * 100) : 0;
  const dailyPace = totalSales / 15; // 15 days elapsed in month (approx)
  const projectedMonth = dailyPace * 30;

  const sortedReps = [...displayReps].sort((a, b) => {
    if (sortField === "sales") return b.totalSales - a.totalSales;
    if (sortField === "commission") return b.commission - a.commission;
    return b.invoiceCount - a.invoiceCount;
  });

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
                    <p className="text-sm text-slate-600">Sorted by selected metric</p>
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
                        Action
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
                    ) : sortedReps.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                          No sales data available for this month
                        </td>
                      </tr>
                    ) : (
                      sortedReps.map((rep, idx) => (
                        <tr key={rep.repName + idx} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-3 font-medium text-slate-900">{rep.repName}</td>
                          <td className="px-6 py-3 text-right font-semibold text-emerald-700">
                            ${money(rep.totalSales)}
                          </td>
                          <td className="px-6 py-3 text-right font-semibold text-indigo-700">
                            ${money(rep.commission)}
                          </td>
                          <td className="px-6 py-3 text-right text-slate-600">{rep.invoiceCount}</td>
                          <td className="px-6 py-3 text-right">
                            <span className="text-sm text-slate-500">
                              {(rep.commissionRate * 100).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200">
                <div className="text-xs uppercase font-semibold text-slate-500">Top Performer</div>
                <div className="mt-2">
                  {loadingReps ? (
                    <div className="text-sm text-slate-400">Loading...</div>
                  ) : sortedReps.length > 0 ? (
                    <>
                      <div className="text-lg font-semibold text-slate-900">{sortedReps[0].repName}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        ${money(sortedReps[0].totalSales)} | {sortedReps[0].invoiceCount} orders
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
                  ) : sortedReps.length > 0 ? (
                    <>
                      <div className="text-lg font-semibold text-slate-900">
                        ${money(totalSales / sortedReps.length)}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {sortedReps.length} active reps
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
