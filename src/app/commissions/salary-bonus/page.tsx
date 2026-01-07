"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { usePathname } from "next/navigation";
import { SALARY_BONUS_THRESHOLD } from "@/lib/repTypes";

interface SalaryWorker {
  repName: string;
  totalSales: number;
  totalCommissionable: number;
  invoiceCount: number;
  bonusProgress: {
    salesAmount: number;
    bonusThreshold: number;
    percentToThreshold: number;
    hasEarnedBonus: boolean;
  };
}

const money = (value: number | undefined) => {
  if (value === undefined || value === null) return "0.00";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function SalaryBonusPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [salaryWorkers, setSalaryWorkers] = useState<SalaryWorker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSalaryWorkers();
  }, [selectedMonth]);

  const loadSalaryWorkers = async () => {
    setLoading(true);
    const [year, month] = selectedMonth.split("-");
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-${String(new Date(Number(year), Number(month), 0).getDate()).padStart(2, "0")}`;

    try {
      const res = await fetch(
        `/api/qbo/invoice/sales-by-rep?startDate=${startDate}&endDate=${endDate}&status=paid&_=${Date.now()}`
      );
      const data = await res.json();
      
      if (data.ok && data.reps) {
        // Filter only salary workers
        const salary = data.reps.filter((r: any) => r.isSalary === true);
        setSalaryWorkers(salary);
      }
    } catch (error) {
      console.error("Failed to load salary workers:", error);
    } finally {
      setLoading(false);
    }
  };

  const monthYearDisplay = new Date(selectedMonth + "-01").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  const pathname = usePathname();
  const tabs = [
    { label: "Commissioned", href: "/commissions" },
    { label: "Salary Bonus", href: "/commissions/salary-bonus" },
    { label: "Wholesalers", href: "/admin/wholesalers" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Commissions" />

        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
          {/* Chrome-style Tabs */}
          <div className="bg-slate-800 border-b border-slate-700 px-8">
            <div className="flex gap-1">
              {tabs.map((tab) => (
                <a
                  key={tab.href}
                  href={tab.href}
                  className={`px-6 py-3 text-sm font-medium transition relative ${
                    pathname === tab.href
                      ? "bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900 rounded-t-lg"
                      : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                  }`}
                >
                  {tab.label}
                </a>
              ))}
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-8 py-8 space-y-6">
            {/* Header */}
            <header>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-purple-700">Salary Workers</p>
                  <h1 className="mt-1 text-3xl font-semibold text-slate-900">Bonus Progress Tracker</h1>
                  <p className="mt-1 text-sm text-slate-600">Track salary worker sales toward ${money(SALARY_BONUS_THRESHOLD)} bonus threshold for {monthYearDisplay}.</p>
                </div>
                <div>
                  <label className="block text-xs uppercase text-slate-600">Month</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
            </header>

            {loading ? (
              <div className="rounded-2xl bg-white p-12 shadow-sm ring-1 ring-slate-200 text-center">
                <p className="text-slate-600">Loading salary worker data...</p>
              </div>
            ) : salaryWorkers.length === 0 ? (
              <div className="rounded-2xl bg-white p-12 shadow-sm ring-1 ring-slate-200 text-center">
                <p className="text-slate-600">No salary worker activity for {monthYearDisplay}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {salaryWorkers.map((worker) => {
                  const progress = worker.bonusProgress;
                  const progressPercent = Math.min(progress.percentToThreshold, 100);
                  const remaining = Math.max(0, progress.bonusThreshold - progress.salesAmount);

                  return (
                    <div key={worker.repName} className="rounded-2xl bg-white shadow-md ring-1 ring-slate-200 overflow-hidden">
                      {/* Header */}
                      <div className={`px-6 py-4 ${progress.hasEarnedBonus ? "bg-emerald-500" : "bg-purple-500"}`}>
                        <h2 className="text-2xl font-bold text-white">{worker.repName}</h2>
                        <p className="text-sm text-white/90 mt-0.5">{monthYearDisplay}</p>
                      </div>

                      {/* Stats */}
                      <div className="p-6 space-y-4">
                        {/* Progress Bar */}
                        <div>
                          <div className="flex justify-between items-baseline mb-2">
                            <span className="text-sm font-semibold text-slate-700">Bonus Progress</span>
                            <span className="text-2xl font-bold text-slate-900">{progressPercent.toFixed(1)}%</span>
                          </div>
                          <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                progress.hasEarnedBonus ? "bg-emerald-500" : "bg-purple-500"
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Sales Amount */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="rounded-xl bg-slate-50 px-4 py-3">
                            <div className="text-xs uppercase text-slate-600">Sales</div>
                            <div className="mt-1 text-xl font-bold text-slate-900">${money(progress.salesAmount)}</div>
                          </div>
                          <div className="rounded-xl bg-slate-50 px-4 py-3">
                            <div className="text-xs uppercase text-slate-600">Goal</div>
                            <div className="mt-1 text-xl font-bold text-slate-900">${money(progress.bonusThreshold)}</div>
                          </div>
                        </div>

                        {/* Remaining */}
                        {!progress.hasEarnedBonus && (
                          <div className="rounded-xl bg-amber-50 px-4 py-3 border border-amber-200">
                            <div className="text-xs uppercase text-amber-800 font-semibold">Remaining to Bonus</div>
                            <div className="mt-1 text-2xl font-bold text-amber-900">${money(remaining)}</div>
                          </div>
                        )}

                        {progress.hasEarnedBonus && (
                          <div className="rounded-xl bg-emerald-50 px-4 py-3 border-2 border-emerald-500">
                            <div className="flex items-center justify-center gap-2">
                              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-lg font-bold text-emerald-900">Bonus Earned!</span>
                            </div>
                          </div>
                        )}

                        {/* Invoice Count */}
                        <div className="pt-3 border-t border-slate-200">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Invoices Assisted</span>
                            <span className="font-semibold text-slate-900">{worker.invoiceCount}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
