"use client";

import { useState } from "react";

const navGroups = [
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
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-16 z-50 rounded-lg bg-slate-600 p-2 text-white shadow-lg hover:bg-slate-500 transition lg:hidden"
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

      <nav className="mt-6 space-y-0">
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
                className={`w-full px-3 py-2 rounded-lg transition-colors font-semibold text-slate-100 flex items-center gap-2 hover:bg-slate-500/40`}
              >
                <span className="text-sm">{group.title}</span>
                <span className={`ml-auto text-xs transition-transform opacity-60 ${isExpanded ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {/* Submenu - now part of document flow */}
              <div className={`overflow-hidden transition-all duration-200 ease-out origin-top ${
                isExpanded ? 'max-h-96' : 'max-h-0'
              }`}>
                <div className="bg-slate-700 rounded-lg shadow-lg border border-slate-600 mx-1 mb-2">
                  {group.items.map((item, index) => (
                    <a
                      key={item.label}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`block w-full px-4 py-3 text-left text-sm transition-colors ${
                        item.label === activePage
                          ? "border-l-2 border-l-blue-400 bg-slate-600/60 text-white font-medium"
                          : "border-l-2 border-l-transparent text-slate-200 hover:bg-slate-600/40 hover:text-white"
                      } ${index !== group.items.length - 1 ? 'border-b border-b-slate-600/40' : ''}`}
                    >
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-slate-400">{item.hint}</p>
                    </a>
                  ))}
                </div>
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
