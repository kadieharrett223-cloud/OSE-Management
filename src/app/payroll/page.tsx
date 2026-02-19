"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { usePathname } from "next/navigation";

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
  previousPayrollCost: number;
  payrollChange: number;
};

type PayrollResponse = {
  ok: boolean;
  period: { startDate: string; endDate: string };
  payrollMeta: PayrollMeta;
  team: PayrollMember[];
  terminated: PayrollMember[];
  previousPeriod?: { startDate: string; endDate: string };
};

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
  const pathname = usePathname();
  const tabs = [
    { label: "Payroll", href: "/payroll" },
    { label: "Commissions", href: "/commissions" },
    { label: "Terminated", href: "/payroll/terminated" },
  ];

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


  const totalPayrollCost = useMemo(
    () => team.reduce((sum, member) => sum + (Number(member.perPayrollCost) || 0), 0),
    [team]
  );

  const payrollChangeStats = useMemo(() => {
    return team.reduce(
      (acc, member) => {
        const change = member.payrollChange || 0;
        if (change > 0) {
          acc.increaseCount += 1;
          acc.increaseTotal += change;
        }
        if (change < 0) {
          acc.decreaseCount += 1;
          acc.decreaseTotal += Math.abs(change);
        }
        return acc;
      },
      { increaseCount: 0, increaseTotal: 0, decreaseCount: 0, decreaseTotal: 0 }
    );
  }, [team]);

  const payrollIncreases = useMemo(
    () => team.filter((member) => member.payrollChange > 0),
    [team]
  );

  const daysUntilPayroll = useMemo(() => {
    if (!payrollMeta?.nextPayrollDate) return 0;
    const today = new Date();
    const next = new Date(`${payrollMeta.nextPayrollDate}T00:00:00`);
    const diffDays = Math.ceil((next.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    return Math.max(diffDays, 0);
  }, [payrollMeta]);


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Payroll" />

        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
          <div className="bg-slate-800 border-b border-slate-700 overflow-x-auto">
            <div className="mx-auto max-w-7xl px-4 md:px-8">
              <div className="flex gap-1 min-w-max">
                {tabs.map((tab) => (
                  <a
                    key={tab.href}
                    href={tab.href}
                    className={`px-4 md:px-6 py-3 text-sm font-medium transition relative whitespace-nowrap ${
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
          </div>
          <div className="mx-auto max-w-7xl px-4 md:px-8 py-6 md:py-8 space-y-6 md:space-y-10">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] md:tracking-[0.3em] text-blue-700">Payroll Overview</p>
                <h1 className="mt-2 text-2xl md:text-3xl font-semibold text-slate-900">Payroll Costs & Team Members</h1>
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
                    <p className="text-xs text-slate-500">First names only • wage changes this period</p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {team.length} team members
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full hidden md:table">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Member</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Type</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">Change vs Last Pay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading && (
                        <tr>
                          <td className="px-6 py-6 text-sm text-slate-500" colSpan={6}>
                            Loading payroll data from QBO…
                          </td>
                        </tr>
                      )}
                      {!loading && team.length === 0 && (
                        <tr>
                          <td className="px-6 py-6 text-sm text-slate-500" colSpan={6}>
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
                            <td className="px-6 py-4 text-sm text-right font-semibold">
                              {member.payrollChange === 0 ? (
                                <span className="text-slate-500">—</span>
                              ) : member.payrollChange > 0 ? (
                                <span className="text-emerald-600">
                                  +{formatCurrency(member.payrollChange)}
                                  <span className="ml-1 text-xs font-normal text-emerald-600/80">more than last pay</span>
                                </span>
                              ) : (
                                <span className="text-amber-600">
                                  -{formatCurrency(Math.abs(member.payrollChange))}
                                  <span className="ml-1 text-xs font-normal text-amber-600/80">less than last pay</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  <div className="md:hidden px-4 py-4 space-y-3">
                    {loading ? (
                      <div className="text-sm text-slate-500">Loading payroll data from QBO…</div>
                    ) : team.length === 0 ? (
                      <div className="text-sm text-slate-500">No payroll data found for this period.</div>
                    ) : (
                      team.map((member) => (
                        <div key={member.id} className="rounded-lg border border-slate-200 bg-white p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-900">{getFirstName(member.fullName)}</span>
                            <span className="text-xs text-slate-500">{member.type}</span>
                          </div>
                          <p className="text-xs text-slate-500">{member.role}</p>
                          <div className="mt-3 text-sm font-semibold">
                            {member.payrollChange === 0 ? (
                              <span className="text-slate-500">No change vs last pay</span>
                            ) : member.payrollChange > 0 ? (
                              <span className="text-emerald-600">+{formatCurrency(member.payrollChange)} more than last pay</span>
                            ) : (
                              <span className="text-amber-600">-{formatCurrency(Math.abs(member.payrollChange))} less than last pay</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>

              <div className="space-y-6">
                <section className="rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">Change Watch</h2>
                  <p className="text-xs text-slate-500">Compare current pay period to the previous one.</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Higher than last pay</span>
                      <span className="font-semibold text-emerald-700">
                        {payrollChangeStats.increaseCount} • +{formatCurrency(payrollChangeStats.increaseTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Lower than last pay</span>
                      <span className="font-semibold text-amber-700">
                        {payrollChangeStats.decreaseCount} • -{formatCurrency(payrollChangeStats.decreaseTotal)}
                      </span>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      Flag increases that are not approved before payroll runs.
                    </div>
                  </div>
                </section>
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
                  <p className="text-xs text-slate-500">Higher paychecks vs last period.</p>
                  <div className="mt-4 space-y-3">
                    {payrollIncreases.map((member) => (
                      <div key={member.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-900">{getFirstName(member.fullName)}</p>
                          <span className="text-xs text-emerald-600 font-semibold">
                            +{formatCurrency(member.payrollChange)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{member.role}</p>
                        <p className="text-xs text-slate-400">More than last paycheck</p>
                      </div>
                    ))}
                    {!loading && payrollIncreases.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                        No increases detected in this period.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
