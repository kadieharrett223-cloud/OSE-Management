"use client";

import { useState } from "react";

const navItems = [
  { label: "Dashboard", hint: "Company overview", href: "/" },
  { label: "Commissions", hint: "QBO sync & payouts", href: "/commissions" },
  { label: "Price List", hint: "SKU shipping + sale", href: "/admin/price-list" },
  { label: "Wholesalers", hint: "Manage clients", href: "/admin/wholesalers" },
  { label: "Settings", hint: "Users & roles", href: "/admin/settings" },
];

export function Sidebar({ activePage }: { activePage: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <aside
      className={`flex flex-col bg-gradient-to-b from-red-950 via-red-900 to-red-950 px-4 py-6 shadow-2xl ring-1 ring-black/50 transition-all duration-200 ${
        sidebarOpen ? "w-72" : "w-16"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/30 text-sm font-semibold text-white ring-1 ring-black/40">
            OSE
          </div>
          {sidebarOpen && (
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-red-200">Management</p>
              <p className="text-lg font-semibold text-white">Performance Hub</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="rounded-lg border border-black/50 bg-red-900/40 px-2 py-1 text-xs text-white transition hover:border-black/70 hover:text-white"
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
                ? "border-red-700/60 bg-red-800/50 text-white hover:-translate-y-[1px]"
                : "border-black/40 bg-red-900/30 text-white hover:-translate-y-[1px] hover:border-red-700/60 hover:bg-red-800/50"
            }`}
            title={item.label}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{sidebarOpen ? item.label : item.label.slice(0, 1)}</span>
              {sidebarOpen && <span className="text-[10px] uppercase tracking-wide text-red-200">view</span>}
            </div>
            {sidebarOpen && <p className="text-xs text-red-100/80">{item.hint}</p>}
          </a>
        ))}
      </nav>

      {sidebarOpen && (
        <div className="mt-6 rounded-2xl border border-red-700/40 bg-red-900/50 px-4 py-4 text-sm text-white shadow-inner">
          <p className="text-xs uppercase tracking-[0.22em] text-red-200">Sync status</p>
          <p className="mt-1 text-lg font-semibold text-white">Last synced — pending</p>
          <p className="text-xs text-red-100/80">Connect QBO to enable live commission pulls.</p>
          <div className="mt-3 flex gap-2">
            <button
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500"
              type="button"
            >
              Connect QBO
            </button>
            <button
              className="rounded-lg border border-red-700/50 px-3 py-2 text-sm text-white transition hover:border-red-600/70"
              type="button"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {sidebarOpen && (
        <div className="mt-4 rounded-xl border border-black/50 bg-red-900/40 px-4 py-3 text-xs text-white">
          <p className="font-semibold text-white">Info</p>
          <p className="text-red-100/80">Dashboard shows YTD metrics and sales rep performance. Sync QBO to update in real-time.</p>
        </div>
      )}
    </aside>
  );
}
