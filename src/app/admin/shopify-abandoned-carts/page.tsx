"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";

const DOWNLOADED_CARTS_KEY = "abandoned-cart-downloaded-tokens";
const MIN_START_DATE_LABEL = "2026-04-24";

type AbandonedCart = {
  id: number;
  token: string;
  created_at: string;
  updated_at: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  currency: string;
  customerName: string;
  customerEmail: string;
  city: string;
  state: string;
  country: string;
  lineItemCount: number;
  abandoned_checkout_url: string | null;
};

function money(value: string | number, currency = "USD") {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function ShopifyAbandonedCartsPage() {
  const [days, setDays] = useState<string>("7");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [downloadingToken, setDownloadingToken] = useState<string | null>(null);
  const [downloadedTokens, setDownloadedTokens] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DOWNLOADED_CARTS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setDownloadedTokens(parsed.map((v) => String(v)).filter(Boolean));
      }
    } catch {
      // Ignore localStorage parsing issues
    }
  }, []);

  const markDownloaded = useCallback((token: string) => {
    setDownloadedTokens((prev) => {
      if (prev.includes(token)) return prev;
      const next = [...prev, token];
      try {
        localStorage.setItem(DOWNLOADED_CARTS_KEY, JSON.stringify(next));
      } catch {
        // Ignore localStorage write issues
      }
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/shopify/abandoned-carts?days=${encodeURIComponent(days)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load abandoned carts");
      }
      setCarts(data?.carts || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load abandoned carts");
      setCarts([]);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = async (token: string) => {
    setDownloadingToken(token);
    setError(null);
    try {
      const res = await fetch(`/api/shopify/abandoned-carts/export?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to download cart");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `abandoned-cart-${token}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      markDownloaded(token);
    } catch (err: any) {
      setError(err?.message || "Failed to download cart");
    } finally {
      setDownloadingToken(null);
    }
  };

  const totalValue = useMemo(
    () => carts.reduce((sum, cart) => sum + (Number(cart.total_price || 0) || 0), 0),
    [carts]
  );

  const needsCheckoutScopeApproval =
    (error || "").toLowerCase().includes("read_checkouts") ||
    (error || "").toLowerCase().includes("merchant approval") ||
    (error || "").toLowerCase().includes("checkout access is not approved");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Abandoned Carts" />

        <main className="flex-1 overflow-x-auto bg-slate-50 text-slate-900">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">
            <header>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Admin</p>
              <h1 className="text-2xl font-semibold text-slate-900">Shopify Abandoned Carts</h1>
              <p className="mt-1 text-sm text-slate-500">
                Import abandoned carts from Shopify (only carts from {MIN_START_DATE_LABEL} and later), then export each cart one by one as PDF.
              </p>
            </header>

            <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-lg p-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Select Days</label>
                <select
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="1">Last 1 day</option>
                  <option value="3">Last 3 days</option>
                  <option value="7">Last 7 days</option>
                  <option value="14">Last 14 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="60">Last 60 days</option>
                </select>
              </div>

              <button
                onClick={load}
                disabled={loading}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Importing…" : "Import Abandoned Carts"}
              </button>
            </div>

            {error && !needsCheckoutScopeApproval && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <strong>Error:</strong> {error}
              </div>
            )}

            {error && needsCheckoutScopeApproval && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <div>
                  <strong>Shopify approval needed:</strong> Shopify sign-in can work normally, but this abandoned carts feature needs special checkout access (`read_checkouts`) that is not approved for this app.
                </div>
                <div className="mt-1">You can reconnect Shopify again now, but abandoned carts will stay unavailable until Shopify approves checkout access for this app.</div>
                <div className="mt-2">
                  <Link
                    href="/settings"
                    className="inline-flex items-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    Go to Settings
                  </Link>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500">Abandoned Carts</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{loading ? "…" : carts.length}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500">Total Cart Value</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{money(totalValue)}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500">Range</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">From {MIN_START_DATE_LABEL}</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-800">Imported Abandoned Carts</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Created</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Customer</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Location</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">Items</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">Tax</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">Total</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Recovery URL</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-slate-500">Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400">Loading abandoned carts...</td>
                      </tr>
                    ) : carts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                          No abandoned carts found for this day range.
                        </td>
                      </tr>
                    ) : (
                      carts.map((cart) => {
                        const isDownloaded = downloadedTokens.includes(cart.token);
                        return (
                        <tr
                          key={cart.token}
                          className={`${isDownloaded ? "bg-slate-100 opacity-60" : "hover:bg-slate-50"} transition-colors`}
                        >
                          <td className="px-4 py-2 text-slate-700 whitespace-nowrap">{cart.created_at?.slice(0, 10)}</td>
                          <td className="px-4 py-2 text-slate-800">
                            <div className="font-medium">{cart.customerName || "Unknown"}</div>
                            <div className="text-xs text-slate-500">{cart.customerEmail || "No email"}</div>
                            {isDownloaded && (
                              <div className="mt-1">
                                <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                  Downloaded
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-slate-700">
                            {[cart.city, cart.state, cart.country].filter(Boolean).join(", ") || "-"}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-700">{cart.lineItemCount}</td>
                          <td className="px-4 py-2 text-right text-slate-700">{money(cart.total_tax, cart.currency)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-800">{money(cart.total_price, cart.currency)}</td>
                          <td className="px-4 py-2 text-slate-700 max-w-[340px] truncate">
                            {cart.abandoned_checkout_url ? (
                              <a
                                href={cart.abandoned_checkout_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-700 hover:text-blue-800"
                              >
                                Open
                              </a>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDownload(cart.token)}
                              disabled={downloadingToken === cart.token}
                              className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                            >
                              {downloadingToken === cart.token
                                ? "Downloading…"
                                : isDownloaded
                                ? "Download Again"
                                : "Download PDF"}
                            </button>
                          </td>
                        </tr>
                      )})
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
