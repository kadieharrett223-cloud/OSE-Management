"use client";

import { useEffect, useRef, useState } from "react";

export function TopBar() {
  const [qboStatus, setQboStatus] = useState<"checking" | "ok" | "error">("checking");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentsTodayTotal, setPaymentsTodayTotal] = useState(0);
  const [loadingPaymentsToday, setLoadingPaymentsToday] = useState(true);
  const prevPaymentsTotalRef = useRef<number | null>(null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);

  const pages = [
    { label: "Dashboard", href: "/" },
    { label: "Expenses", href: "/expenses" },
    { label: "Commissions", href: "/commissions" },
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

  // Request browser notification permission once on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkQboStatus = async () => {
      try {
        const res = await fetch("/api/qbo/status");
        if (!res.ok) throw new Error("QBO status check failed");
        const data = await res.json();
        if (isMounted) {
          setQboStatus(data.connected ? "ok" : "error");
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
    // Re-check when the tab regains focus (e.g. after returning from OAuth)
    window.addEventListener("focus", checkQboStatus);
    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", checkQboStatus);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchPaymentsToday = async () => {
      try {
        const paymentRes = await fetch(`/api/qbo/today-total?_=${Date.now()}`);

        if (!paymentRes.ok) {
          throw new Error("Failed to fetch payments");
        }

        const paymentData = await paymentRes.json();
        // Uses combined total: Payment records + fully-paid invoices dated today
        const total = Number(paymentData?.total || 0);
        if (isMounted) {
          // Fire OS notification when total increases (new payment detected)
          if (
            prevPaymentsTotalRef.current !== null &&
            total > prevPaymentsTotalRef.current &&
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            const added = total - prevPaymentsTotalRef.current;
            const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format;
            new Notification("Payment Received", {
              body: `+${fmt(added)} recorded — today's total is now ${fmt(total)}`,
              icon: "/favicon.ico",
            });
          }
          prevPaymentsTotalRef.current = total;
          setPaymentsTodayTotal(total);
        }
      } catch (error) {
        // Keep previous value on error
      } finally {
        if (isMounted) setLoadingPaymentsToday(false);
      }
    };

    setLoadingPaymentsToday(true);
    fetchPaymentsToday();
    const interval = setInterval(fetchPaymentsToday, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="sticky top-0 z-40 w-full border-b border-slate-600 bg-slate-700 pt-[env(safe-area-inset-top)] text-white print:hidden">
      <div className="mx-auto flex w-full flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <div className="min-w-0 flex flex-nowrap items-center gap-2 overflow-x-auto text-xs sm:gap-4 sm:text-sm">
          <span className="font-bold text-slate-100">QBO:</span>
          {qboStatus === "ok" ? (
            <span className="inline-flex items-center gap-2 border-l-2 border-emerald-400 pl-2 text-slate-100">
              <span className="font-semibold text-emerald-300">Synced</span>
              {lastChecked && (
                <span className="hidden text-xs text-slate-300 sm:inline">Checked {lastChecked.toLocaleTimeString()}</span>
              )}
            </span>
          ) : qboStatus === "error" ? (
            <span className="inline-flex items-center gap-2 text-slate-100 sm:gap-2">
              <span className="font-semibold text-rose-300">Not connected</span>
              <a
                href="/api/qbo/connect"
                className="text-xs font-semibold text-rose-200 underline underline-offset-2 transition hover:text-white"
              >
                Connect
              </a>
            </span>
          ) : (
            <span className="text-slate-300">Checking…</span>
          )}
          <div className="flex items-center gap-2 border-l border-slate-500 pl-3 text-slate-100 sm:ml-1">
            <span className="font-semibold text-slate-300">Payments Received:</span>
            <span className="text-xs font-bold text-emerald-300 sm:text-sm">
              {loadingPaymentsToday ? "…" : formatCurrency(paymentsTodayTotal)}
            </span>
          </div>
        </div>
        <div className="relative w-full min-w-0 sm:flex-1 sm:max-w-sm">
          <input
            type="search"
            placeholder="Search..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-full border border-slate-500 bg-slate-100 px-4 py-1.5 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition"
          />
          {normalizedQuery && (
            <div className="absolute left-0 right-0 mt-2 rounded-xl border-2 border-blue-400 bg-white shadow-xl">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">Search Results</div>
              <div className="max-h-64 overflow-y-auto">
                {filteredPages.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500">No pages found.</div>
                ) : (
                  filteredPages.map((page) => (
                    <a
                      key={page.href}
                      href={page.href}
                      className="block px-4 py-2 text-sm text-slate-700 hover:bg-blue-100 border-l-4 border-l-transparent hover:border-l-blue-400 transition"
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
