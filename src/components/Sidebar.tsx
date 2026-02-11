"use client";

import { useState } from "react";

const navGroups = [
  {
    title: "Operations",
    items: [
      { label: "Dashboard", hint: "Company overview", href: "/" },
      { label: "Calendar", hint: "Sales & notifications", href: "/calendar" },
      { label: "Team Tasks", hint: "Project management", href: "/admin/team-tasks" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Expenses", hint: "Bills & payroll", href: "/expenses" },
      { label: "Commissions", hint: "QBO sync & payouts", href: "/commissions" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Price List", hint: "SKU shipping + sale", href: "/admin/price-list" },
      { label: "Purchasing", hint: "POs and payments", href: "/admin/purchasing" },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Settings", hint: "QBO & Shopify config", href: "/settings" },
    ],
  },
];

export function Sidebar({ activePage }: { activePage: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-16 z-50 rounded-lg bg-blue-600 p-2 text-white shadow-lg lg:hidden"
        aria-label="Toggle menu"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-30 flex h-screen w-64 flex-col bg-gradient-to-b from-blue-950 via-blue-700 to-blue-500 px-4 py-6 shadow-2xl ring-1 ring-blue-950/30 transition-transform duration-300 lg:static lg:h-full lg:w-72 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-sm font-semibold text-blue-100 ring-1 ring-blue-300/30">
            OSE
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-blue-200">Management</p>
            <p className="text-lg font-semibold text-white">Performance Hub</p>
          </div>
        </div>
      </div>

      <nav className="mt-6 space-y-4">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <p className="px-2 text-[10px] uppercase tracking-[0.3em] text-blue-200/80">
              {group.title}
            </p>
            {group.items.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`block w-full rounded-xl border px-3 py-3 text-left text-sm transition ${
                  item.label === activePage
                    ? "border-blue-400/50 bg-blue-900/40 text-white hover:-translate-y-[1px]"
                    : "border-slate-800/70 bg-slate-900/40 text-slate-100 hover:-translate-y-[1px] hover:border-blue-400/50 hover:bg-blue-900/40 hover:text-white"
                }`}
                title={item.label}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-[10px] uppercase tracking-wide text-blue-200">view</span>
                </div>
                <p className="text-xs text-slate-300">{item.hint}</p>
              </a>
            ))}
          </div>
        ))}
      </nav>

      <div className="flex-1" />
      </aside>
    </>
  );
}
