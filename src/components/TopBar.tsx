"use client";

import { useEffect, useState } from "react";

export function TopBar() {
  const [qboStatus, setQboStatus] = useState<"checking" | "ok" | "error">("checking");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentsTodayTotal, setPaymentsTodayTotal] = useState(0);
  const [loadingPaymentsToday, setLoadingPaymentsToday] = useState(true);
  const [incomingDepositsTotal, setIncomingDepositsTotal] = useState(0);
  const [loadingIncomingDeposits, setLoadingIncomingDeposits] = useState(true);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);

  const getLocalDateYmd = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const pages = [
    { label: "Dashboard", href: "/" },
    { label: "Expenses", href: "/expenses" },
    { label: "Payroll", href: "/payroll" },
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

  useEffect(() => {
    let isMounted = true;

    const fetchPaymentsToday = async () => {
      try {
        const today = getLocalDateYmd();
        const paymentRes = await fetch(
          `/api/qbo/payment/query?startDate=${today}&endDate=${today}&_=${Date.now()}`
        );

        if (!paymentRes.ok) {
          throw new Error("Failed to fetch payments");
        }

        const paymentData = await paymentRes.json();
        const totalApplied = Number(paymentData?.totalApplied || 0);
        if (isMounted) setPaymentsTodayTotal(totalApplied);
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

  useEffect(() => {
    let isMounted = true;

    const fetchIncomingDeposits = async () => {
      try {
        const res = await fetch(`/api/qbo/undeposited-funds?_=${Date.now()}`);

        if (!res.ok) {
          throw new Error("Failed to fetch incoming deposits");
        }

        const data = await res.json();
        const totalIncoming = Number(data?.undeposited || 0);
        if (isMounted) setIncomingDepositsTotal(totalIncoming);
      } catch (error) {
        // Keep previous value on error
      } finally {
        if (isMounted) setLoadingIncomingDeposits(false);
      }
    };

    setLoadingIncomingDeposits(true);
    fetchIncomingDeposits();
    const interval = setInterval(fetchIncomingDeposits, 30000);
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
          <div className="flex items-center gap-2 border-l border-slate-500 pl-3 text-slate-100">
            <span className="font-semibold text-slate-300">Incoming Deposits:</span>
            <span className="text-xs font-bold text-amber-300 sm:text-sm">
              {loadingIncomingDeposits ? "…" : formatCurrency(incomingDepositsTotal)}
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
