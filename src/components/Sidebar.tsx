"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

const navItems = [
   { label: "Dashboard", hint: "Company overview", href: "/" },
   { label: "Commissions", hint: "QBO sync & payouts", href: "/commissions" },
   { label: "Calendar", hint: "Sales & notifications", href: "/calendar" },
   { label: "Price List", hint: "SKU shipping + sale", href: "/admin/price-list" },
   { label: "Purchasing", hint: "POs and payments", href: "/admin/purchasing" },
];

export function Sidebar({ activePage }: { activePage: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <aside
      className={`flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-blue-950 px-4 py-6 shadow-2xl ring-1 ring-slate-900/30 transition-all duration-200 ${
        sidebarOpen ? "w-72" : "w-16"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-sm font-semibold text-blue-100 ring-1 ring-blue-300/30">
            OSE
          </div>
          {sidebarOpen && (
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-blue-200">Management</p>
              <p className="text-lg font-semibold text-white">Performance Hub</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="rounded-lg border border-slate-800/70 bg-slate-900/50 px-2 py-1 text-xs text-slate-200 transition hover:border-blue-400/60 hover:text-white"
        >
          {sidebarOpen ? "⟨" : "⟩"}
        </button>
      </div>

      <nav className="mt-6 space-y-2">
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={`block w-full rounded-xl border px-3 py-3 text-left text-sm transition ${
              item.label === activePage
                ? "border-blue-400/50 bg-blue-900/40 text-white hover:-translate-y-[1px]"
                : "border-slate-800/70 bg-slate-900/40 text-slate-100 hover:-translate-y-[1px] hover:border-blue-400/50 hover:bg-blue-900/40 hover:text-white"
            }`}
            title={item.label}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{sidebarOpen ? item.label : item.label.slice(0, 1)}</span>
              {sidebarOpen && <span className="text-[10px] uppercase tracking-wide text-blue-200">view</span>}
            </div>
            {sidebarOpen && <p className="text-xs text-slate-300">{item.hint}</p>}
          </a>
        ))}
      </nav>

      {sidebarOpen && (
        <div className="mt-6 space-y-3">
          <div className="rounded-2xl border border-blue-400/20 bg-blue-900/40 px-4 py-4 text-sm text-blue-50 shadow-inner">
            <p className="text-xs uppercase tracking-[0.22em] text-blue-200">Sync status</p>
            <p className="mt-1 text-lg font-semibold text-white">Last synced — pending</p>
            <p className="text-xs text-blue-100/80">Connect QBO to enable live commission pulls.</p>
            <div className="mt-3 flex gap-2">
              <button
                className="flex-1 rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-400"
                type="button"
              >
                Connect QBO
              </button>
              <button
                className="rounded-lg border border-blue-300/40 px-3 py-2 text-sm text-blue-100 transition hover:border-blue-200/60"
                type="button"
              >
                Refresh
              </button>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="w-full rounded-lg border border-slate-700/70 bg-slate-900/50 px-3 py-2 text-sm text-slate-300 transition hover:border-red-400/60 hover:text-red-400"
            type="button"
          >
            Sign Out
          </button>
        </div>
      )}

      {sidebarOpen && (
        <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 text-xs text-slate-300">
          <p className="font-semibold text-white">Info</p>
          <p className="text-slate-300">Dashboard shows YTD metrics and sales rep performance. Sync QBO to update in real-time.</p>
        </div>
      )}
    </aside>
  );
}
