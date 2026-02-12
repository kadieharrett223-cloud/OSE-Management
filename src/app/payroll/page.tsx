"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

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
};

type PayrollResponse = {
  ok: boolean;
  period: { startDate: string; endDate: string };
  payrollMeta: PayrollMeta;
  team: PayrollMember[];
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

const withinDays = (value?: string | null, days = 120) => {
  if (!value) return false;
  const today = new Date();
  const target = new Date(`${value}T00:00:00`);
  const diff = today.getTime() - target.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
};

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

  const recentIncreases = useMemo(
    () => team.filter((member) => withinDays(member.lastIncreaseDate, 120)),
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
          <div className="mx-auto max-w-7xl px-8 py-8 space-y-6">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-blue-700">Payroll Overview</p>
                <h1 className="mt-2 text-3xl font-semibold text-slate-900">Payroll Costs & Team Members</h1>
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
                    <p className="text-xs text-slate-500">First names only • per-payroll estimate</p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {team.length} team members
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Member</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Type</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">Rate</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">Per Payroll</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading && (
                        <tr>
                          <td className="px-6 py-6 text-sm text-slate-500" colSpan={5}>
                            Loading payroll data from QBO…
                          </td>
                        </tr>
                      )}
                      {!loading && team.length === 0 && (
                        <tr>
                          <td className="px-6 py-6 text-sm text-slate-500" colSpan={5}>
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
                            <td className="px-6 py-4 text-sm text-right text-slate-700">
                              {member.rate > 0
                                ? member.type === "Hourly"
                                  ? `${formatCurrency(member.rate)}/hr`
                                  : `${formatCurrency(member.rate)}/yr`
                                : "—"}
                            </td>
                            <td className="px-6 py-4 text-sm text-right font-semibold text-slate-900">
                              {formatCurrency(member.perPayrollCost || 0)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="space-y-6">
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
                  <p className="text-xs text-slate-500">Recent employee updates in QBO.</p>
                  <div className="mt-4 space-y-3">
                    {recentIncreases.map((member) => (
                      <div key={member.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-900">{getFirstName(member.fullName)}</p>
                          <span className="text-xs text-emerald-600 font-semibold">
                            {member.rate > 0
                              ? member.type === "Hourly"
                                ? `+${formatCurrency(member.rate)}/hr`
                                : `+${formatCurrency(member.rate)}/yr`
                              : "Updated"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{member.role}</p>
                        <p className="text-xs text-slate-400">Updated {formatShortDate(member.lastIncreaseDate)}</p>
                      </div>
                    ))}
                    {!loading && recentIncreases.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                        No recent wage updates found in QBO.
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
