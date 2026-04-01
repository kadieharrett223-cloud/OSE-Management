"use client";

import { useState } from "react";

const navGroups = [
  {
    title: "Operations",
    icon: "📊",
    color: "from-blue-600 to-blue-700",
    items: [
      { label: "Dashboard", hint: "Company overview", href: "/" },
      { label: "Calendar", hint: "Sales & notifications", href: "/calendar" },
      { label: "Company Docs", hint: "Shared documents", href: "/admin/company-docs" },
      { label: "Team Tasks", hint: "Project management", href: "/admin/team-tasks" },
    ],
  },
  {
    title: "Finance",
    icon: "💰",
    color: "from-emerald-600 to-emerald-700",
    items: [
      { label: "Expenses", hint: "Bills & payroll", href: "/expenses" },
      { label: "Payroll", hint: "Payroll costs & team", href: "/payroll" },
    ],
  },
  {
    title: "Inventory",
    icon: "📦",
    color: "from-purple-600 to-purple-700",
    items: [
      { label: "Price List", hint: "SKU shipping + sale", href: "/admin/price-list" },
      { label: "Purchasing", hint: "POs and payments", href: "/admin/purchasing" },
      { label: "Special Orders", hint: "Factory colors & status", href: "/admin/special-orders" },
    ],
  },
  {
    title: "Admin",
    icon: "⚙️",
    color: "from-orange-600 to-orange-700",
    items: [
      { label: "Shopify Reconcile", hint: "Match orders to QBO invoices", href: "/admin/shopify-reconcile" },
      { label: "Settings", hint: "QBO & Shopify config", href: "/settings" },
    ],
  },
  {
    title: "Settings Menu",
    icon: "👤",
    color: "from-pink-600 to-pink-700",
    items: [
      { label: "Users", hint: "Manage team & permissions", href: "/settings/users" },
    ],
  },
];

export function Sidebar({ activePage }: { activePage: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-16 z-50 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 p-2 text-white shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-blue-800 transition lg:hidden"
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
        className={`fixed left-0 top-0 z-30 flex min-h-screen w-64 flex-col bg-slate-600 px-4 py-6 shadow-md border-r border-slate-500 transition-transform duration-300 lg:static lg:min-h-full lg:w-72 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700 text-sm font-semibold text-white border border-slate-500">
            OSE
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-200">Management</p>
            <p className="text-lg font-bold text-white">Performance Hub</p>
          </div>
        </div>
      </div>

      <nav className="mt-6 space-y-2">
        {navGroups.map((group) => {
          const isExpanded = expandedGroup === group.title;
          return (
            <div 
              key={group.title}
              onMouseEnter={() => setExpandedGroup(group.title)}
              onMouseLeave={() => setExpandedGroup(null)}
              className="group relative"
            >
              {/* Group Header */}
              <button
                onClick={() => setExpandedGroup(isExpanded ? null : group.title)}
                className={`w-full px-3 py-2.5 rounded-lg transition-all font-semibold text-white flex items-center gap-2 bg-gradient-to-r ${group.color} hover:shadow-lg`}
              >
                <span className="text-lg">{(group as any).icon}</span>
                <span className="text-sm">{group.title}</span>
                <span className={`ml-auto text-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {/* Submenu */}
              <div className={`absolute left-0 right-0 top-full mt-1 bg-slate-700 rounded-lg shadow-xl border border-slate-600 overflow-hidden z-50 transition-all origin-top ${
                isExpanded ? 'scale-y-100 opacity-100 visible' : 'scale-y-95 opacity-0 invisible'
              }`}>
                {group.items.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`block w-full px-4 py-3 text-left text-sm transition border-l-2 ${
                      item.label === activePage
                        ? "border-l-white bg-slate-600 text-white font-semibold"
                        : "border-l-transparent bg-transparent text-slate-100 hover:border-l-slate-300 hover:bg-slate-600/60 hover:text-white"
                    }`}
                  >
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-slate-300">{item.hint}</p>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="flex-1" />
      </aside>
    </>
  );
}
