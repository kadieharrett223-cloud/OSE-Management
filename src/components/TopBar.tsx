"use client";

import { useEffect, useState } from "react";

export function TopBar() {
  const [qboStatus, setQboStatus] = useState<"checking" | "ok" | "error">("checking");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentsTodayTotal, setPaymentsTodayTotal] = useState(0);
  const [loadingPaymentsToday, setLoadingPaymentsToday] = useState(true);
  const [undepositedFunds, setUndepositedFunds] = useState(0);
  const [loadingUndepositedFunds, setLoadingUndepositedFunds] = useState(true);

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

  useEffect(() => {
    let isMounted = true;

    const fetchPaymentsToday = async () => {
      try {
        setLoadingPaymentsToday(true);
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
        if (isMounted) setPaymentsTodayTotal(0);
      } finally {
        if (isMounted) setLoadingPaymentsToday(false);
      }
    };

    fetchPaymentsToday();
    const interval = setInterval(fetchPaymentsToday, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchUndepositedFunds = async () => {
      try {
        setLoadingUndepositedFunds(true);
        const res = await fetch(`/api/qbo/undeposited-funds?_=${Date.now()}`);

        if (!res.ok) {
          throw new Error("Failed to fetch undeposited funds");
        }

        const data = await res.json();
        const totalUndeposited = Number(data?.undeposited || 0);
        if (isMounted) setUndepositedFunds(totalUndeposited);
      } catch (error) {
        if (isMounted) setUndepositedFunds(0);
      } finally {
        if (isMounted) setLoadingUndepositedFunds(false);
      }
    };

    fetchUndepositedFunds();
    const interval = setInterval(fetchUndepositedFunds, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="sticky top-0 z-40 w-full border-b border-slate-500 bg-slate-600 pt-[env(safe-area-inset-top)] text-white print:hidden">
      <div className="mx-auto flex w-full flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <div className="min-w-0 flex flex-nowrap items-center gap-2 overflow-x-auto text-xs sm:gap-4 sm:text-sm">
          <span className="font-bold text-white">QBO:</span>
          {qboStatus === "ok" ? (
            <span className="inline-flex items-center gap-1 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-3 py-1 rounded-full font-semibold sm:gap-2">
              Synced ✅
              {lastChecked && (
                <span className="hidden text-xs text-emerald-100 sm:inline">Checked {lastChecked.toLocaleTimeString()}</span>
              )}
            </span>
          ) : qboStatus === "error" ? (
            <span className="inline-flex items-center gap-1 text-white sm:gap-2">
              <span>Not connected</span>
              <a
                href="/api/qbo/connect"
                className="rounded-full bg-gradient-to-r from-red-600 to-red-700 px-3 py-1 text-xs font-semibold text-white hover:shadow-lg transition"
              >
                Connect
              </a>
            </span>
          ) : (
            <span className="text-slate-200">Checking…</span>
          )}
          <div className="flex items-center gap-1 rounded-full border border-emerald-400 bg-gradient-to-r from-emerald-600 to-emerald-700 px-3 py-1.5 text-xs font-semibold text-white sm:ml-2 sm:gap-2 sm:px-4 hover:shadow-lg transition">
            <span className="hidden sm:inline">Payments Received:</span>
            <span className="sm:hidden">Received:</span>
            <span className="text-xs font-bold text-white sm:text-sm">
              {loadingPaymentsToday ? "…" : formatCurrency(paymentsTodayTotal)}
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-amber-400 bg-gradient-to-r from-amber-600 to-amber-700 px-3 py-1.5 text-xs font-semibold text-white sm:gap-2 sm:px-4 hover:shadow-lg transition">
            <span className="hidden sm:inline">Undeposited:</span>
            <span className="sm:hidden">Undeposited:</span>
            <span className="text-xs font-bold text-white sm:text-sm">
              {loadingUndepositedFunds ? "…" : formatCurrency(undepositedFunds)}
            </span>
          </div>
        </div>
        <div className="hidden lg:flex lg:flex-col lg:items-center lg:gap-0.5 bg-gradient-to-r from-slate-500 to-slate-600 rounded-lg px-4 py-2">
          <span className="text-lg font-bold text-white tracking-wide">Olympic Shop Equipment</span>
          <span className="text-[10px] text-slate-100">brought to you by kadie ☺</span>
        </div>
        <div className="relative w-full min-w-0 sm:flex-1 sm:max-w-sm">
          <input
            type="search"
            placeholder="Search..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-full border-2 border-slate-400 bg-slate-700 px-4 py-1.5 text-sm text-white placeholder:text-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition"
          />
          {normalizedQuery && (
            <div className="absolute left-0 right-0 mt-2 rounded-xl border-2 border-blue-400 bg-slate-700 shadow-xl">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">Search Results</div>
              <div className="max-h-64 overflow-y-auto">
                {filteredPages.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-400">No pages found.</div>
                ) : (
                  filteredPages.map((page) => (
                    <a
                      key={page.href}
                      href={page.href}
                      className="block px-4 py-2 text-sm text-white hover:bg-blue-600/30 border-l-4 border-l-transparent hover:border-l-blue-400 transition"
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
