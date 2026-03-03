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
    <div className="sticky top-0 z-40 w-full border-b border-slate-900/60 bg-gradient-to-r from-slate-950 via-blue-900 to-blue-700 text-slate-100 print:hidden">
      <div className="mx-auto flex w-full flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <div className="flex flex-nowrap items-center gap-2 text-xs sm:gap-4 sm:text-sm overflow-x-auto">
          <span className="font-semibold text-blue-100">QBO:</span>
          {qboStatus === "ok" ? (
            <span className="inline-flex items-center gap-1 text-emerald-300 sm:gap-2">
              Synced ✅
              {lastChecked && (
                <span className="hidden text-xs text-blue-100/70 sm:inline">Checked {lastChecked.toLocaleTimeString()}</span>
              )}
            </span>
          ) : qboStatus === "error" ? (
            <span className="inline-flex items-center gap-1 text-red-300 sm:gap-2">
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
          <div className="flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-900/30 px-2 py-1 text-xs font-semibold text-blue-100 sm:ml-2 sm:gap-2 sm:px-3">
            <span className="hidden sm:inline">Payments Received:</span>
            <span className="sm:hidden">Received:</span>
            <span className="text-xs font-bold text-white sm:text-sm">
              {loadingPaymentsToday ? "…" : formatCurrency(paymentsTodayTotal)}
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-900/30 px-2 py-1 text-xs font-semibold text-amber-100 sm:gap-2 sm:px-3">
            <span className="hidden sm:inline">Undeposited:</span>
            <span className="sm:hidden">Undeposited:</span>
            <span className="text-xs font-bold text-white sm:text-sm">
              {loadingUndepositedFunds ? "…" : formatCurrency(undepositedFunds)}
            </span>
          </div>
        </div>
        <div className="hidden lg:flex lg:flex-col lg:items-center lg:gap-0.5">
          <span className="text-lg font-bold text-white tracking-wide">Olympic Shop Equipment</span>
          <span className="text-[10px] text-blue-200/60">brought to you by kadie ☺</span>
        </div>
        <div className="relative w-full sm:flex-1 sm:max-w-sm">
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
