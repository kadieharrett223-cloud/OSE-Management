"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShopifyOrder {
  id: number;
  name: string;
  orderNumber: string;
  created_at: string;
  total_price: string;
  financial_status: string;
  fulfillment_status: string | null;
  customerName: string;
  customerEmail: string;
  note: string | null;
}

interface QboInvoice {
  id: string;
  docNumber: string;
  poNumber: string;
  customerName: string;
  txnDate: string;
  totalAmt: number;
  balance: number;
  status: "Open" | "Paid";
}

type MatchType = "po" | "name" | "none";

interface MatchedRow {
  shopify: ShopifyOrder;
  qbo: QboInvoice | null;
  matchType: MatchType;
}

interface UnmatchedQbo {
  qbo: QboInvoice;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const money = (v: number | string) =>
  Number(v).toLocaleString("en-US", { style: "currency", currency: "USD" });

const toYmd = (date: Date) => date.toISOString().slice(0, 10);

const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function matchInvoices(shopifyOrders: ShopifyOrder[], qboInvoices: QboInvoice[]): {
  rows: MatchedRow[];
  unmatchedQbo: UnmatchedQbo[];
} {
  const usedQboIds = new Set<string>();

  // Build lookup maps for O(1) matching
  const qboByPo = new Map<string, QboInvoice>();
  const qboByName = new Map<string, QboInvoice[]>();

  for (const inv of qboInvoices) {
    const po = inv.poNumber.trim().replace(/^#/, "").toLowerCase();
    if (po) qboByPo.set(po, inv);

    const norm = normName(inv.customerName);
    if (norm) {
      const existing = qboByName.get(norm) || [];
      existing.push(inv);
      qboByName.set(norm, existing);
    }
  }

  const rows: MatchedRow[] = shopifyOrders.map((order) => {
    const orderNum = order.orderNumber.toLowerCase();

    // 1. Try PO match first
    const poMatch = qboByPo.get(orderNum);
    if (poMatch && !usedQboIds.has(poMatch.id)) {
      usedQboIds.add(poMatch.id);
      return { shopify: order, qbo: poMatch, matchType: "po" };
    }

    // 2. Try customer name match — pick closest date match
    const normCustomer = normName(order.customerName);
    const nameMatches = (qboByName.get(normCustomer) || []).filter(
      (inv) => !usedQboIds.has(inv.id)
    );
    if (nameMatches.length > 0) {
      // Pick the QBO invoice whose date is closest to Shopify order date
      const orderDate = new Date(order.created_at).getTime();
      const best = nameMatches.sort(
        (a, b) =>
          Math.abs(new Date(a.txnDate).getTime() - orderDate) -
          Math.abs(new Date(b.txnDate).getTime() - orderDate)
      )[0];
      usedQboIds.add(best.id);
      return { shopify: order, qbo: best, matchType: "name" };
    }

    return { shopify: order, qbo: null, matchType: "none" };
  });

  const unmatchedQbo: UnmatchedQbo[] = qboInvoices
    .filter((inv) => !usedQboIds.has(inv.id))
    .map((inv) => ({ qbo: inv }));

  return { rows, unmatchedQbo };
}

// ─── Badge components ─────────────────────────────────────────────────────────

function MatchBadge({ type }: { type: MatchType }) {
  if (type === "po")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
        ✓ PO Match
      </span>
    );
  if (type === "name")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
        ~ Name Match
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
      ✗ No Match
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  if (s === "paid")
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Paid
      </span>
    );
  if (s === "open")
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        Open
      </span>
    );
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      {status}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type FilterTab = "all" | "po" | "name" | "none";

export default function ShopifyReconcilePage() {
  // Date range — default last 90 days
  const defaultEnd = toYmd(new Date());
  const defaultStart = toYmd(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [showUnmatchedQbo, setShowUnmatchedQbo] = useState(false);

  const [shopifyOrders, setShopifyOrders] = useState<ShopifyOrder[]>([]);
  const [qboInvoices, setQboInvoices] = useState<QboInvoice[]>([]);
  const [loadingShopify, setLoadingShopify] = useState(false);
  const [loadingQbo, setLoadingQbo] = useState(false);
  const [errorShopify, setErrorShopify] = useState<string | null>(null);
  const [errorQbo, setErrorQbo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadingShopify(true);
    setLoadingQbo(true);
    setErrorShopify(null);
    setErrorQbo(null);

    const [shopifyRes, qboRes] = await Promise.allSettled([
      fetch(`/api/shopify/orders?startDate=${startDate}&endDate=${endDate}`),
      fetch(`/api/qbo/invoice/shopify-match?startDate=${startDate}&endDate=${endDate}`),
    ]);

    // Shopify
    if (shopifyRes.status === "fulfilled") {
      const data = await shopifyRes.value.json().catch(() => ({}));
      if (shopifyRes.value.ok) {
        setShopifyOrders(data.orders || []);
      } else {
        setErrorShopify(data.error || "Failed to fetch Shopify orders");
        setShopifyOrders([]);
      }
    } else {
      setErrorShopify("Network error loading Shopify orders");
      setShopifyOrders([]);
    }
    setLoadingShopify(false);

    // QBO
    if (qboRes.status === "fulfilled") {
      const data = await qboRes.value.json().catch(() => ({}));
      if (qboRes.value.ok) {
        setQboInvoices(data.invoices || []);
      } else {
        setErrorQbo(data.error || "Failed to fetch QBO invoices");
        setQboInvoices([]);
      }
    } else {
      setErrorQbo("Network error loading QBO invoices");
      setQboInvoices([]);
    }
    setLoadingQbo(false);
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Matching ──────────────────────────────────────────────────────────────
  const { rows, unmatchedQbo } = useMemo(
    () => matchInvoices(shopifyOrders, qboInvoices),
    [shopifyOrders, qboInvoices]
  );

  const countPo = rows.filter((r) => r.matchType === "po").length;
  const countName = rows.filter((r) => r.matchType === "name").length;
  const countNone = rows.filter((r) => r.matchType === "none").length;

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let base = rows;
    if (filterTab !== "all") base = base.filter((r) => r.matchType === filterTab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      base = base.filter(
        (r) =>
          r.shopify.orderNumber.toLowerCase().includes(q) ||
          r.shopify.customerName.toLowerCase().includes(q) ||
          (r.qbo?.docNumber || "").toLowerCase().includes(q) ||
          (r.qbo?.customerName || "").toLowerCase().includes(q)
      );
    }
    return base;
  }, [rows, filterTab, search]);

  const loading = loadingShopify || loadingQbo;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Shopify Reconcile" />

        <main className="flex-1 overflow-x-auto bg-slate-50 text-slate-900">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">

            {/* Header */}
            <header>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Admin</p>
              <h1 className="text-2xl font-semibold text-slate-900">Shopify ↔ QuickBooks Reconciliation</h1>
              <p className="mt-1 text-sm text-slate-500">
                Auto-matches Shopify orders to QBO invoices by <strong>PO number</strong> (primary) or{" "}
                <strong>customer name</strong> (secondary). Unmatched orders are highlighted in red so nothing is missed.
              </p>
            </header>

            {/* Controls */}
            <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-lg p-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
                <input
                  type="search"
                  placeholder="Order #, customer, invoice…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={load}
                disabled={loading}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>

            {/* Error banners */}
            {errorShopify && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <strong>Shopify:</strong> {errorShopify}
              </div>
            )}
            {errorQbo && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <strong>QuickBooks:</strong> {errorQbo}
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500">Shopify Orders</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {loading ? "…" : rows.length}
                </p>
              </div>
              <div className="bg-white border border-emerald-200 rounded-lg p-4">
                <p className="text-xs font-medium text-emerald-600">PO Matched</p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">
                  {loading ? "…" : countPo}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">QBO has PO # = order #</p>
              </div>
              <div className="bg-white border border-amber-200 rounded-lg p-4">
                <p className="text-xs font-medium text-amber-600">Name Matched</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">
                  {loading ? "…" : countName}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Matched by customer name</p>
              </div>
              <div className="bg-white border border-red-200 rounded-lg p-4">
                <p className="text-xs font-medium text-red-600">Not in QBO</p>
                <p className="mt-1 text-2xl font-bold text-red-600">
                  {loading ? "…" : countNone}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Need to enter invoice</p>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "all", label: `All (${rows.length})` },
                  { key: "none", label: `⚠ Unmatched (${countNone})` },
                  { key: "po", label: `✓ PO Match (${countPo})` },
                  { key: "name", label: `~ Name Match (${countName})` },
                ] as { key: FilterTab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterTab(tab.key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    filterTab === tab.key
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-emerald-100 border border-emerald-300" />
                PO # in QBO matches Shopify order # (strongest match)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-amber-50 border border-amber-300" />
                Customer name matches (verify manually)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-red-50 border border-red-200" />
                No matching QBO invoice found
              </span>
            </div>

            {/* Main table */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">
                  Shopify Orders {filtered.length !== rows.length && `(${filtered.length} shown)`}
                </h2>
                {loading && (
                  <span className="text-xs text-slate-500 animate-pulse">Loading data…</span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {/* Shopify side */}
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 w-28">
                        Shopify #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 w-28">
                        Date
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 w-28">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500 w-24">
                        Shopify Status
                      </th>

                      {/* Match column */}
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500 w-32">
                        Match
                      </th>

                      {/* QBO side */}
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 w-28">
                        QBO Invoice
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        QBO Customer
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 w-28">
                        QBO Amount
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500 w-24">
                        QBO Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 10 }).map((__, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className="h-4 rounded bg-slate-100 animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                          No orders found for this date range and filter.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((row) => {
                        const rowBg =
                          row.matchType === "po"
                            ? "bg-emerald-50/60"
                            : row.matchType === "name"
                            ? "bg-amber-50/60"
                            : "bg-red-50/60";

                        return (
                          <tr
                            key={row.shopify.id}
                            className={`${rowBg} hover:brightness-95 transition-all`}
                          >
                            {/* Shopify side */}
                            <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                              {row.shopify.name}
                            </td>
                            <td className="px-4 py-3 text-slate-800">{row.shopify.customerName}</td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {row.shopify.created_at?.slice(0, 10)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800">
                              {money(row.shopify.total_price)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <StatusBadge status={row.shopify.financial_status} />
                            </td>

                            {/* Match */}
                            <td className="px-4 py-3 text-center">
                              <MatchBadge type={row.matchType} />
                            </td>

                            {/* QBO side */}
                            {row.qbo ? (
                              <>
                                <td className="px-4 py-3 font-mono text-slate-700">
                                  {row.qbo.poNumber
                                    ? `PO: ${row.qbo.poNumber}`
                                    : `#${row.qbo.docNumber}`}
                                </td>
                                <td className="px-4 py-3 text-slate-700">{row.qbo.customerName}</td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-800">
                                  {money(row.qbo.totalAmt)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <StatusBadge status={row.qbo.status} />
                                </td>
                              </>
                            ) : (
                              <td
                                colSpan={4}
                                className="px-4 py-3 text-center text-sm text-red-500 font-medium"
                              >
                                — Invoice not found in QuickBooks —
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Unmatched QBO invoices section */}
            {!loading && unmatchedQbo.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowUnmatchedQbo((v) => !v)}
                  className="w-full border-b border-slate-200 px-5 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">
                      QBO Invoices Without a Shopify Order ({unmatchedQbo.length})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      These may be manually entered invoices, phone/email orders, or outside the date range.
                    </p>
                  </div>
                  <span className="text-slate-400 text-lg">{showUnmatchedQbo ? "▲" : "▼"}</span>
                </button>

                {showUnmatchedQbo && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                            QBO Invoice #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                            PO #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                            Customer
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                            Date
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                            Amount
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {unmatchedQbo.map(({ qbo }) => (
                          <tr key={qbo.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono text-slate-700">#{qbo.docNumber}</td>
                            <td className="px-4 py-3 text-slate-600">{qbo.poNumber || "—"}</td>
                            <td className="px-4 py-3 text-slate-800">{qbo.customerName}</td>
                            <td className="px-4 py-3 text-slate-600">{qbo.txnDate}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800">
                              {money(qbo.totalAmt)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <StatusBadge status={qbo.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
