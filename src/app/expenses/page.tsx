"use client";

import { Sidebar } from "@/components/Sidebar";

const placeholderSections = [
  {
    title: "Bills To Pay",
    items: [
      { name: "Qingdao Hiker Machinery", due: "Feb 15", amount: 12850 },
      { name: "OEC Freight", due: "Feb 18", amount: 3240 },
      { name: "Warehouse Utilities", due: "Feb 20", amount: 980 },
    ],
  },
  {
    title: "Expenses",
    items: [
      { name: "Shipping supplies", due: "Feb 12", amount: 420 },
      { name: "Software subscriptions", due: "Feb 22", amount: 860 },
      { name: "Rep travel", due: "Feb 25", amount: 1450 },
    ],
  },
  {
    title: "Payroll",
    items: [
      { name: "Bi-weekly payroll", due: "Feb 16", amount: 24500 },
      { name: "Commission payouts", due: "Feb 28", amount: 8200 },
    ],
  },
];

const money = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ExpensesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Expenses" />

        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900">
          <div className="mx-auto max-w-7xl px-8 py-6 space-y-6">
            <header className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-700">Finance</p>
              <h1 className="text-3xl font-semibold text-slate-900">Expenses</h1>
              <p className="text-sm text-slate-600">
                Track upcoming bills, operating expenses, and payroll obligations.
              </p>
            </header>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {placeholderSections.map((section) => (
                <section key={section.title} className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
                    <p className="text-xs text-slate-500">Upcoming obligations</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {section.items.map((item) => (
                      <div key={item.name} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">Due {item.due}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">${money(item.amount)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="rounded-xl bg-white p-5 shadow-md ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Next Steps</h2>
              <p className="mt-2 text-sm text-slate-600">
                Connect bill pay, payroll imports, or vendor schedules here when you’re ready.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
