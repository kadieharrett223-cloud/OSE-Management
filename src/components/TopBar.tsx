"use client";

import { useEffect, useState } from "react";

export function TopBar() {
  const [qboStatus, setQboStatus] = useState<"checking" | "ok" | "error">("checking");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const pages = [
    { label: "Dashboard", href: "/" },
    { label: "Commissions", href: "/commissions" },
    { label: "Calendar", href: "/calendar" },
    { label: "Price List", href: "/admin/price-list" },
    { label: "Purchasing", href: "/admin/purchasing" },
    { label: "Suppliers", href: "/admin/suppliers" },
    { label: "Wholesalers", href: "/admin/wholesalers" },
    { label: "Settings", href: "/settings" },
  ];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredPages = normalizedQuery
    ? pages.filter((page) => page.label.toLowerCase().includes(normalizedQuery))
    : [];

  useEffect(() => {
    let isMounted = true;

    const checkQboStatus = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const res = await fetch(`/api/qbo/invoice/query?startDate=${today}&endDate=${today}`);
        if (!res.ok) throw new Error("QBO status check failed");
        if (isMounted) {
          setQboStatus("ok");
          setLastChecked(new Date());
        }
      } catch (error) {
        if (isMounted) {
          setQboStatus("error");
          setLastChecked(new Date());
        }
      }
    };

    checkQboStatus();
    const interval = setInterval(checkQboStatus, 5 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="sticky top-0 z-40 w-full border-b border-slate-900/60 bg-gradient-to-r from-slate-950 via-blue-900 to-blue-700 text-slate-100 print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-blue-100">QBO:</span>
          {qboStatus === "ok" ? (
            <span className="inline-flex items-center gap-2 text-emerald-300">
              Synced ✅
              {lastChecked && (
                <span className="text-xs text-blue-100/70">Checked {lastChecked.toLocaleTimeString()}</span>
              )}
            </span>
          ) : qboStatus === "error" ? (
            <span className="inline-flex items-center gap-2 text-red-300">
              Not connected
              <a
                href="/api/qbo/connect"
                className="rounded-full bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-200"
              >
                Connect
              </a>
            </span>
          ) : (
            <span className="text-blue-100/70">Checking…</span>
          )}
        </div>
        <div className="relative flex-1 max-w-sm">
          <input
            type="search"
            placeholder="Search..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-full border border-slate-700 bg-slate-800/60 px-4 py-1.5 text-sm text-slate-100 placeholder:text-slate-300 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {normalizedQuery && (
            <div className="absolute left-0 right-0 mt-2 rounded-xl border border-slate-800 bg-slate-950 shadow-lg">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-blue-200/70">Pages</div>
              <div className="max-h-64 overflow-y-auto">
                {filteredPages.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-400">No pages found.</div>
                ) : (
                  filteredPages.map((page) => (
                    <a
                      key={page.href}
                      href={page.href}
                      className="block px-4 py-2 text-sm text-slate-100 hover:bg-slate-900/60"
                    >
                      {page.label}
                    </a>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
