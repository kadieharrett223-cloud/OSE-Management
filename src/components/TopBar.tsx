"use client";

import { useEffect, useState } from "react";

export function TopBar() {
  const [qboStatus, setQboStatus] = useState<"checking" | "ok" | "error">("checking");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

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
    <div className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-slate-700">QBO:</span>
          {qboStatus === "ok" ? (
            <span className="inline-flex items-center gap-2 text-emerald-700">
              Synced ✅
              {lastChecked && (
                <span className="text-xs text-slate-500">Checked {lastChecked.toLocaleTimeString()}</span>
              )}
            </span>
          ) : qboStatus === "error" ? (
            <span className="inline-flex items-center gap-2 text-red-600">
              Not connected
              <a
                href="/api/qbo/connect"
                className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700"
              >
                Connect
              </a>
            </span>
          ) : (
            <span className="text-slate-500">Checking…</span>
          )}
        </div>
        <div className="flex-1 max-w-sm">
          <input
            type="search"
            placeholder="Search..."
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
