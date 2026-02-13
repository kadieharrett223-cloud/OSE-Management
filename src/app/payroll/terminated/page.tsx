"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { usePathname } from "next/navigation";

type PayrollMember = {
  id: string;
  fullName: string;
  role: string;
  type: "Hourly" | "Salary";
  rate: number;
  status: string;
  perPayrollCost: number;
};

type PayrollResponse = {
  ok: boolean;
  terminated: PayrollMember[];
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

const getFirstName = (fullName: string) => fullName.split(" ")[0] || fullName;

export default function TerminatedPayrollPage() {
  const pathname = usePathname();
  const tabs = [
    { label: "Payroll", href: "/payroll" },
    { label: "Commissions", href: "/commissions" },
    { label: "Terminated", href: "/payroll/terminated" },
  ];

  const [terminated, setTerminated] = useState<PayrollMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTerminated = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/qbo/payroll/overview");
        const data = (await res.json()) as PayrollResponse;
        if (!res.ok || !data.ok) {
          throw new Error((data as any)?.error || "Failed to load terminated staff");
        }
        setTerminated(data.terminated || []);
      } catch (err: any) {
        setError(err?.message || "Failed to load terminated staff");
        setTerminated([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTerminated();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Payroll" />

        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
          <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
            <div className="bg-slate-800 border-b border-slate-700 rounded-2xl">
              <div className="flex gap-1 px-4">
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

            <header>
              <h1 className="text-2xl font-semibold text-slate-900">Terminated Team</h1>
              <p className="text-sm text-slate-600">Archived staff removed from current payroll.</p>
            </header>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Terminated Employees</h2>
                  <p className="text-xs text-slate-500">First names only • not on active payroll</p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {terminated.length} people
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td className="px-6 py-6 text-sm text-slate-500" colSpan={4}>
                          Loading terminated staff…
                        </td>
                      </tr>
                    ) : terminated.length === 0 ? (
                      <tr>
                        <td className="px-6 py-6 text-sm text-slate-500" colSpan={4}>
                          No terminated staff on record.
                        </td>
                      </tr>
                    ) : (
                      terminated.map((member) => (
                        <tr key={member.id}>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                            {getFirstName(member.fullName)}
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
