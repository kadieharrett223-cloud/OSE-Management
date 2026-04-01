"use client";

import { useState } from "react";

const navGroups: { title: string; items: { label: string; hint: string; href: string }[] }[] = [
  {
    title: "Operations",
    items: [
      { label: "Dashboard", hint: "Company overview", href: "/" },
      { label: "Calendar", hint: "Sales & notifications", href: "/calendar" },
      { label: "Company Docs", hint: "Shared documents", href: "/admin/company-docs" },
      { label: "Team Tasks", hint: "Project management", href: "/admin/team-tasks" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Expenses", hint: "Bills & payroll", href: "/expenses" },
      { label: "Payroll", hint: "Payroll costs & team", href: "/payroll" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Price List", hint: "SKU shipping + sale", href: "/admin/price-list" },
      { label: "Purchasing", hint: "POs and payments", href: "/admin/purchasing" },
      { label: "Special Orders", hint: "Factory colors & status", href: "/admin/special-orders" },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Shopify Reconcile", hint: "Match orders to QBO invoices", href: "/admin/shopify-reconcile" },
      { label: "Settings", hint: "QBO & Shopify config", href: "/settings" },
    ],
  },
  {
    title: "Settings Menu",
    items: [
      { label: "Users", hint: "Manage team & permissions", href: "/settings/users" },
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
        className="fixed left-4 top-16 z-50 rounded-lg bg-slate-700 p-2 text-white shadow-lg hover:bg-slate-600 transition lg:hidden"
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
        className={`fixed left-0 top-0 z-30 flex min-h-screen w-64 flex-col bg-slate-700 px-4 py-6 shadow-md border-r border-slate-600 transition-transform duration-300 lg:static lg:min-h-full lg:w-64 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-600 text-sm font-semibold text-white border border-slate-500">
            OSE
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-300">Management</p>
            <p className="text-lg font-bold text-white">Performance Hub</p>
          </div>
        </div>

        <nav className="space-y-4">
          {navGroups.map((group) => (
            <div key={group.title}>
              {/* Section label */}
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {group.title}
              </p>
              {/* Items always visible */}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                      item.label === activePage
                        ? "border-l-2 border-blue-400 bg-slate-600/70 pl-2.5 text-white font-medium"
                        : "border-l-2 border-transparent pl-2.5 text-slate-200 hover:bg-slate-600/40 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex-1" />
      </aside>
    </>
  );
}
