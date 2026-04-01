"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  status: "Open" | "Paid" | "Cancelled";
}

interface ManualMapping {
  shopify_order_id: string;
  shopify_order_number: string;
  qbo_invoice_id: string | null;
  qbo_doc_number: string | null;
  qbo_customer_name: string | null;
  note: string | null;
  is_cancelled?: boolean;
}

type MatchType = "cancelled" | "manual" | "po" | "name" | "none";

interface MatchedRow {
  shopify: ShopifyOrder;
  qbo: QboInvoice | null;
  matchType: MatchType;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const money = (v: number | string) =>
  Number(v).toLocaleString("en-US", { style: "currency", currency: "USD" });

const toYmd = (date: Date) => date.toISOString().slice(0, 10);

const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function buildMatchedRows(
  shopifyOrders: ShopifyOrder[],
  qboInvoices: QboInvoice[],
  manualMappings: ManualMapping[]
): { rows: MatchedRow[]; unmatchedQbo: QboInvoice[] } {
  const usedQboIds = new Set<string>();
  const manualMap = new Map<string, ManualMapping>();
  const qboById = new Map<string, QboInvoice>();

  for (const inv of qboInvoices) qboById.set(inv.id, inv);
  for (const m of manualMappings) manualMap.set(m.shopify_order_id, m);

  // Build lookup maps for auto-matching
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
    const shopifyIdStr = String(order.id);
    const orderNum = order.orderNumber.toLowerCase();

    // 1. Manual mapping â€” highest priority
    const manualEntry = manualMap.get(shopifyIdStr);
    if (manualEntry?.is_cancelled) {
      return { shopify: order, qbo: null, matchType: "cancelled" };
    }

    const manualQboId = manualEntry?.qbo_invoice_id;
    if (manualQboId) {
      const inv = qboById.get(manualQboId);
      if (inv) {
        usedQboIds.add(inv.id);
        return { shopify: order, qbo: inv, matchType: "manual" };
      }
    }

    // 2. Try PO match
    const poMatch = qboByPo.get(orderNum);
    if (poMatch && !usedQboIds.has(poMatch.id)) {
      usedQboIds.add(poMatch.id);
      return { shopify: order, qbo: poMatch, matchType: "po" };
    }

    // 3. Try customer name match â€” pick closest date match
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

  const unmatchedQbo = qboInvoices.filter((inv) => !usedQboIds.has(inv.id));
  return { rows, unmatchedQbo };
}

function MatchBadge({ type }: { type: MatchType }) {
  if (type === "cancelled")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
        Cancelled
      </span>
    );
  if (type === "manual")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
        â˜… Manual
      </span>
    );
  if (type === "po")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
        âœ“ PO Match
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
      âœ— No Match
    </span>
  );
}

// â”€â”€â”€ Link Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface LinkModalProps {
  shopifyOrder: ShopifyOrder;
  qboInvoices: QboInvoice[];
  currentQboId: string | null;
  onSave: (qboInvoice: QboInvoice, note: string) => Promise<void>;
  onUnlink: () => Promise<void>;
  onClose: () => void;
}

function LinkModal({ shopifyOrder, qboInvoices, currentQboId, onSave, onUnlink, onClose }: LinkModalProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<QboInvoice | null>(
    currentQboId ? (qboInvoices.find((inv) => inv.id === currentQboId) ?? null) : null
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return qboInvoices.slice(0, 50);
    const q = search.toLowerCase();
    return qboInvoices.filter(
      (inv) =>
        inv.docNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.poNumber.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [search, qboInvoices]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try { await onSave(selected, note); onClose(); } finally { setSaving(false); }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try { await onUnlink(); onClose(); } finally { setUnlinking(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Link {shopifyOrder.name} to QBO Invoice</h2>
              <p className="mt-0.5 text-xs text-slate-500">Customer: <strong>{shopifyOrder.customerName}</strong> Â· {money(shopifyOrder.total_price)}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">Ã—</button>
          </div>
        </div>
        <div className="px-5 pt-4">
          <input
            ref={inputRef}
            type="search"
            placeholder="Search by invoice #, customer, or PO #â€¦"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="mt-2 max-h-64 overflow-y-auto divide-y divide-slate-50 px-2 pb-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">No invoices found.</p>
          ) : (
            filtered.map((inv) => {
              const isSel = selected?.id === inv.id;
              return (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => setSelected(inv)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${isSel ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50 border border-transparent"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-slate-800">#{inv.docNumber}</span>
                        {inv.poNumber && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">PO: {inv.poNumber}</span>}
                        <StatusBadge status={inv.status} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-600">{inv.customerName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-slate-800">{money(inv.totalAmt)}</div>
                      <div className="text-[11px] text-slate-500">{inv.txnDate}</div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
        <div className="border-t border-slate-100 px-5 py-3">
          <label className="block text-xs font-medium text-slate-500 mb-1">Note (optional â€” e.g. "Ordered under maiden name")</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between gap-3">
          <div>
            {currentQboId && (
              <button type="button" onClick={handleUnlink} disabled={unlinking} className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50">
                {unlinking ? "Removingâ€¦" : "Remove manual link"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="button" onClick={handleSave} disabled={!selected || saving} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
              {saving ? "Savingâ€¦" : "Save Link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Badge components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  if (s === "cancelled")
    return (
      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
        Cancelled
      </span>
    );
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

// â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type FilterTab = "all" | "cancelled" | "manual" | "po" | "name" | "none";

export default function ShopifyReconcilePage() {
  // Date range â€” default last 90 days
  const defaultEnd = toYmd(new Date());
  const defaultStart = toYmd(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const [shopifyOrders, setShopifyOrders] = useState<ShopifyOrder[]>([]);
  const [qboInvoices, setQboInvoices] = useState<QboInvoice[]>([]);
  const [manualMappings, setManualMappings] = useState<ManualMapping[]>([]);
  const [loadingShopify, setLoadingShopify] = useState(false);
  const [loadingQbo, setLoadingQbo] = useState(false);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [errorShopify, setErrorShopify] = useState<string | null>(null);
  const [errorQbo, setErrorQbo] = useState<string | null>(null);

  const [linkTarget, setLinkTarget] = useState<MatchedRow | null>(null);

  const loadMappings = useCallback(async () => {
    setLoadingMappings(true);
    try {
      const res = await fetch("/api/shopify/reconcile-mappings");
      if (res.ok) { const d = await res.json(); setManualMappings(d.mappings || []); }
    } finally { setLoadingMappings(false); }
  }, []);

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
    load(); loadMappings();
  }, [load, loadMappings]);

  // â”€â”€ Matching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { rows } = useMemo(
    () => buildMatchedRows(shopifyOrders, qboInvoices, manualMappings),
    [shopifyOrders, qboInvoices, manualMappings]
  );

  const countManual = rows.filter((r) => r.matchType === "manual").length;
  const countCancelled = rows.filter((r) => r.matchType === "cancelled").length;
  const countPo = rows.filter((r) => r.matchType === "po").length;
  const countName = rows.filter((r) => r.matchType === "name").length;
  const countNone = rows.filter((r) => r.matchType === "none").length;

  const manualMapById = useMemo(() => {
    const m = new Map<string, ManualMapping>();
    for (const map of manualMappings) m.set(map.shopify_order_id, map);
    return m;
  }, [manualMappings]);

  const handleSaveLink = async (shopifyOrder: ShopifyOrder, qboInvoice: QboInvoice, note: string) => {
    await fetch("/api/shopify/reconcile-mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopify_order_id: String(shopifyOrder.id),
        shopify_order_number: shopifyOrder.orderNumber,
        qbo_invoice_id: qboInvoice.id,
        qbo_doc_number: qboInvoice.docNumber,
        qbo_customer_name: qboInvoice.customerName,
        note,
      }),
    });
    await loadMappings();
  };

  const handleUnlink = async (shopifyOrderId: number) => {
    await fetch(`/api/shopify/reconcile-mappings?shopify_order_id=${shopifyOrderId}`, { method: "DELETE" });
    await loadMappings();
  };

  const handleMarkCancelled = async (shopifyOrder: ShopifyOrder) => {
    await fetch("/api/shopify/reconcile-mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopify_order_id: String(shopifyOrder.id),
        shopify_order_number: shopifyOrder.orderNumber,
        is_cancelled: true,
      }),
    });
    await loadMappings();
  };

  // â”€â”€ Filtering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  const loading = loadingShopify || loadingQbo || loadingMappings;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Shopify Reconcile" />

        <main className="flex-1 overflow-x-auto bg-slate-50 text-slate-900">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">

            {/* Header */}
            <header>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Admin</p>
              <h1 className="text-2xl font-semibold text-slate-900">Shopify â†” QuickBooks Reconciliation</h1>
              <p className="mt-1 text-sm text-slate-500">
                Auto-matches by <strong>PO #</strong> or <strong>customer name</strong>. Use{" "}
                <strong className="text-blue-700">Link Invoice</strong> to manually connect any order to a QBO invoice when names differ.
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
                  placeholder="Order #, customer, invoiceâ€¦"
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
                {loading ? "Loadingâ€¦" : "Refresh"}
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500">Shopify Orders</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{loading ? "â€¦" : rows.length}</p>
              </div>
              <div className="bg-white border border-slate-300 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-600">Cancelled</p>
                <p className="mt-1 text-2xl font-bold text-slate-700">{loading ? "â€¦" : countCancelled}</p>
              </div>
              <div className="bg-white border border-blue-200 rounded-lg p-4">
                <p className="text-xs font-medium text-blue-600">Manually Linked</p>
                <p className="mt-1 text-2xl font-bold text-blue-700">{loading ? "â€¦" : countManual}</p>
              </div>
              <div className="bg-white border border-emerald-200 rounded-lg p-4">
                <p className="text-xs font-medium text-emerald-600">PO Matched</p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">{loading ? "â€¦" : countPo}</p>
              </div>
              <div className="bg-white border border-amber-200 rounded-lg p-4">
                <p className="text-xs font-medium text-amber-600">Name Matched</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{loading ? "â€¦" : countName}</p>
              </div>
              <div className="bg-white border border-red-200 rounded-lg p-4">
                <p className="text-xs font-medium text-red-600">Not in QBO</p>
                <p className="mt-1 text-2xl font-bold text-red-600">{loading ? "â€¦" : countNone}</p>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "all", label: `All (${rows.length})` },
                  { key: "cancelled", label: `Cancelled (${countCancelled})` },
                  { key: "none", label: `âš  Unmatched (${countNone})` },
                  { key: "manual", label: `â˜… Manual (${countManual})` },
                  { key: "po", label: `âœ“ PO Match (${countPo})` },
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

            {/* Main table */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">
                  Shopify Orders {filtered.length !== rows.length && `(${filtered.length} shown)`}
                </h2>
                {loading && (
                  <span className="text-xs text-slate-500 animate-pulse">Loading dataâ€¦</span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-sm">
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
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 w-28">QBO Invoice</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">QBO Customer</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 w-28">QBO Amount</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500 w-24">QBO Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500 w-28">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 11 }).map((__, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className="h-4 rounded bg-slate-100 animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-10 text-center text-slate-400">
                          No orders found for this date range and filter.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((row) => {
                        const rowBg =
                          row.matchType === "cancelled"
                            ? "bg-slate-100"
                            : row.matchType === "manual"
                            ? "bg-blue-50/50"
                            : row.matchType === "po"
                            ? "bg-emerald-50/60"
                            : row.matchType === "name"
                            ? "bg-amber-50/60"
                            : "bg-red-50/60";

                        return (
                          <tr
                            key={row.shopify.id}
                            className={`${rowBg} hover:brightness-95 transition-all`}
                          >
                            <td className="px-4 py-3 font-mono font-semibold text-slate-800">{row.shopify.name}</td>
                            <td className="px-4 py-3 text-slate-800">
                              {row.shopify.customerName}
                              {manualMapById.get(String(row.shopify.id))?.note && (
                                <div className="text-[10px] text-blue-600 mt-0.5 italic">
                                  Note: {manualMapById.get(String(row.shopify.id))?.note}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.shopify.created_at?.slice(0, 10)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800">{money(row.shopify.total_price)}</td>
                            <td className="px-4 py-3 text-center"><StatusBadge status={row.shopify.financial_status} /></td>
                            <td className="px-4 py-3 text-center"><MatchBadge type={row.matchType} /></td>
                            {row.qbo ? (
                              <>
                                <td className="px-4 py-3 font-mono text-slate-700">
                                  <div>#{row.qbo.docNumber}</div>
                                  {row.qbo.poNumber && (
                                    <div className="text-[10px] text-slate-500">PO: {row.qbo.poNumber}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-slate-700">{row.qbo.customerName}</td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-800">{money(row.qbo.totalAmt)}</td>
                                <td className="px-4 py-3 text-center"><StatusBadge status={row.qbo.status} /></td>
                              </>
                            ) : (
                              <td
                                colSpan={4}
                                className={`px-4 py-3 text-center text-sm font-medium ${row.matchType === "cancelled" ? "text-slate-500" : "text-red-500"}`}>
                                {row.matchType === "cancelled" ? "Marked as cancelled" : "â€” Invoice not found in QuickBooks â€”"}
                              </td>
                            )}
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setLinkTarget(row)}
                                  className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                                >
                                  {row.qbo ? "Linked" : "Link Invoice"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    row.matchType === "cancelled"
                                      ? handleUnlink(row.shopify.id)
                                      : handleMarkCancelled(row.shopify)
                                  }
                                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  {row.matchType === "cancelled" ? "Undo Cancel" : "Mark Cancelled"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      </div>
      {linkTarget && (
        <LinkModal
          shopifyOrder={linkTarget.shopify}
          qboInvoices={qboInvoices}
          currentQboId={
            manualMapById.get(String(linkTarget.shopify.id))?.qbo_invoice_id ?? linkTarget.qbo?.id ?? null
          }
          onSave={(inv, note) => handleSaveLink(linkTarget.shopify, inv, note)}
          onUnlink={() => handleUnlink(linkTarget.shopify.id)}
          onClose={() => setLinkTarget(null)}
        />
      )}
    </div>
  );
}
