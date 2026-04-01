"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

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
            <header>
              <h1 className="text-2xl font-semibold text-slate-900">Terminated Team</h1>
              <p className="text-sm text-slate-600">Archived staff removed from current payroll.</p>
            </header>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Name</th>
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
