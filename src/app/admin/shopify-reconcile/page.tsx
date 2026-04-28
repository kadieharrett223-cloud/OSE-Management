"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  deliveryStateCode?: string | null;
  isWashingtonDelivery?: boolean;
}

interface QboInvoice {
  id: string;
  docNumber: string;
  poNumber: string;
  customerName: string;
  salesRepTags: string[];
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

type MatchType = "cancelled" | "manual" | "name" | "customer" | "none";

interface MatchedRow {
  shopify: ShopifyOrder;
  qbo: QboInvoice | null;
  matchType: MatchType;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const money = (v: number | string) =>
  Number(v).toLocaleString("en-US", { style: "currency", currency: "USD" });

const toYmd = (date: Date) => date.toISOString().slice(0, 10);

const AUTO_MATCH_MAX_DAYS_BEFORE_ORDER = 1;
const AUTO_MATCH_MAX_DAYS_AFTER_ORDER = 21;

const normalizePersonName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const nameSuffixes = new Set([
  "llc",
  "inc",
  "co",
  "company",
  "ltd",
  "corp",
  "corporation",
  "pllc",
  "lp",
  "llp",
]);

const firstLastKey = (s: string) => {
  const parts = normalizePersonName(s).split(" ").filter(Boolean);
  if (parts.length < 2) return "";

  let end = parts.length - 1;
  while (end > 0 && nameSuffixes.has(parts[end])) {
    end -= 1;
  }

  if (end <= 0) return "";
  const first = parts[0];
  const last = parts[end];
  if (!first || !last || first === last) return "";
  return `${first} ${last}`;
};

function buildMatchedRows(
  shopifyOrders: ShopifyOrder[],
  qboInvoices: QboInvoice[],
  manualMappings: ManualMapping[],
  qboCustomerNames: string[]
): { rows: MatchedRow[]; unmatchedQbo: QboInvoice[] } {
  const usedQboIds = new Set<string>();
  const manualMap = new Map<string, ManualMapping>();
  const qboById = new Map<string, QboInvoice>();

  for (const inv of qboInvoices) qboById.set(inv.id, inv);
  for (const m of manualMappings) manualMap.set(m.shopify_order_id, m);

  const qboByName = new Map<string, QboInvoice[]>();
  for (const inv of qboInvoices) {
    const norm = firstLastKey(inv.customerName);
    if (norm) {
      const existing = qboByName.get(norm) || [];
      existing.push(inv);
      qboByName.set(norm, existing);
    }
  }

  const customerNameSet = new Set(qboCustomerNames.map((name) => firstLastKey(name)).filter(Boolean));

  const rows: MatchedRow[] = shopifyOrders.map((order) => {
    const shopifyIdStr = String(order.id);
    const normCustomer = firstLastKey(order.customerName);

    const manualEntry = manualMap.get(shopifyIdStr);
    if (manualEntry?.is_cancelled) {
      return { shopify: order, qbo: null, matchType: "cancelled" };
    }

    const manualQboId = manualEntry?.qbo_invoice_id;
    if (manualQboId) {
      const inv = qboById.get(manualQboId);
      if (inv) {
        const manualNote = String(manualEntry?.note || "").toLowerCase();
        const isAutoSyncedMapping = manualNote.includes("auto-synced shopify") || manualNote.includes("auto synced shopify");
        const normInvoiceCustomer = firstLastKey(inv.customerName);
        const hasCustomerMismatch =
          Boolean(normCustomer) &&
          Boolean(normInvoiceCustomer) &&
          normCustomer !== normInvoiceCustomer;

        if (!(isAutoSyncedMapping && hasCustomerMismatch)) {
        usedQboIds.add(inv.id);
        return { shopify: order, qbo: inv, matchType: "manual" };
        }
      }
      return { shopify: order, qbo: null, matchType: "manual" };
    }

    const nameMatches = (qboByName.get(normCustomer) || []).filter(
      (inv) => !usedQboIds.has(inv.id)
    );
    if (nameMatches.length > 0) {
      const orderDate = new Date(order.created_at).getTime();
      const minDate = orderDate - AUTO_MATCH_MAX_DAYS_BEFORE_ORDER * 24 * 60 * 60 * 1000;
      const maxDate = orderDate + AUTO_MATCH_MAX_DAYS_AFTER_ORDER * 24 * 60 * 60 * 1000;
      const nearby = nameMatches.filter((inv) => {
        const invoiceDate = new Date(inv.txnDate).getTime();
        return Number.isFinite(invoiceDate) && invoiceDate >= minDate && invoiceDate <= maxDate;
      });
      const candidates = nearby.length > 0 ? nearby : [];
      if (candidates.length > 0) {
        const best = candidates.sort(
          (a, b) =>
            Math.abs(new Date(a.txnDate).getTime() - orderDate) -
            Math.abs(new Date(b.txnDate).getTime() - orderDate)
        )[0];
        usedQboIds.add(best.id);
        return { shopify: order, qbo: best, matchType: "name" };
      }
    }

    if (customerNameSet.has(normCustomer)) {
      return { shopify: order, qbo: null, matchType: "customer" };
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
        Manual
      </span>
    );
  if (type === "name")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
        ~ Name Match
      </span>
    );
  if (type === "customer")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
        ✓ Customer Found
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
      No Match
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
                      {inv.salesRepTags?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {inv.salesRepTags.map((tag) => (
                            <span key={`${inv.id}-${tag}`} className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
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

type FilterTab = "all" | "cancelled" | "manual" | "name" | "customer" | "none" | "wa";

export default function ShopifyReconcilePage() {
  const defaultEnd = toYmd(new Date());
  const defaultStart = toYmd(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const [shopifyOrders, setShopifyOrders] = useState<ShopifyOrder[]>([]);
  const [qboInvoices, setQboInvoices] = useState<QboInvoice[]>([]);
  const [qboCustomerNames, setQboCustomerNames] = useState<string[]>([]);
  const [manualMappings, setManualMappings] = useState<ManualMapping[]>([]);
  const [loadingShopify, setLoadingShopify] = useState(false);
  const [loadingQbo, setLoadingQbo] = useState(false);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [errorShopify, setErrorShopify] = useState<string | null>(null);
  const [errorQbo, setErrorQbo] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [creatingInvoiceFor, setCreatingInvoiceFor] = useState<string | null>(null);
  const [resendingInvoiceFor, setResendingInvoiceFor] = useState<string | null>(null);

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
    setActionError(null);

    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const query = params.toString();

    const [shopifyRes, qboRes] = await Promise.allSettled([
      fetch(`/api/shopify/orders${query ? `?${query}` : ""}`),
      fetch(`/api/qbo/invoice/shopify-match${query ? `?${query}` : ""}`),
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

    // QBO invoices
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

    fetch(`/api/qbo/query?resource=Customer&limit=1000`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setQboCustomerNames([]);
          return;
        }
        const customers = data?.data?.QueryResponse?.Customer || [];
        setQboCustomerNames(
          customers
            .map((c: any) => String(c?.DisplayName || c?.FullyQualifiedName || "").trim())
            .filter(Boolean)
        );
      })
      .catch(() => {
        setQboCustomerNames([]);
      });
  }, [startDate, endDate]);

  useEffect(() => {
    load(); loadMappings();
  }, [load, loadMappings]);

  // â”€â”€ Matching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { rows } = useMemo(
    () => buildMatchedRows(shopifyOrders, qboInvoices, manualMappings, qboCustomerNames),
    [shopifyOrders, qboInvoices, manualMappings, qboCustomerNames]
  );

  const countManual = rows.filter((r) => r.matchType === "manual").length;
  const countCancelled = rows.filter((r) => r.matchType === "cancelled").length;
  const countName = rows.filter((r) => r.matchType === "name").length;
  const countCustomer = rows.filter((r) => r.matchType === "customer").length;
  const countNone = rows.filter((r) => r.matchType === "none").length;
  const countWa = rows.filter((r) => r.shopify.isWashingtonDelivery).length;

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

  const handleCreateNewInvoice = async (shopifyOrder: ShopifyOrder) => {
    const orderId = String(shopifyOrder.id);
    setCreatingInvoiceFor(orderId);
    setActionError(null);
    try {
      const res = await fetch("/api/shopify/reconcile-create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopify_order_id: orderId,
          send_invoice: true,
          send_to_email: "mindy@olympic-equipment.com",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create QBO invoice");
      }
      if (data?.sendWarning) {
        throw new Error(`Invoice created, but email send failed: ${data.sendWarning}`);
      }

      await Promise.all([load(), loadMappings()]);
    } catch (err: any) {
      setActionError(err?.message || "Failed to create invoice for this order");
    } finally {
      setCreatingInvoiceFor(null);
    }
  };

  const handleResendInvoice = async (qboInvoiceId: string) => {
    setResendingInvoiceFor(qboInvoiceId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch("/api/shopify/reconcile-resend-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qbo_invoice_id: qboInvoiceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to resend QBO invoice");
      }
      if (data?.sendWarning) {
        throw new Error(`Resend failed: ${data.sendWarning}`);
      }
      setActionSuccess(`Invoice ${qboInvoiceId} sent to mindy@olympic-equipment.com`);
    } catch (err: any) {
      setActionError(err?.message || "Failed to resend invoice");
    } finally {
      setResendingInvoiceFor(null);
    }
  };

  // â”€â”€ Filtering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filtered = useMemo(() => {
    let base = rows;
    if (filterTab === "wa") {
      base = base.filter((r) => r.shopify.isWashingtonDelivery);
    } else if (filterTab !== "all") {
      base = base.filter((r) => r.matchType === filterTab);
    }
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
  const handleAllTime = () => {
    if (!startDate && !endDate) {
      load();
      return;
    }
    setStartDate("");
    setEndDate("");
  };

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
                Auto-matches by <strong>customer name only</strong>. If a QuickBooks customer with the same name exists, it is treated as matched.
                Use <strong className="text-blue-700">Link Invoice</strong> to manually connect a specific invoice.
              </p>
              <div className="mt-3">
                <Link
                  href="/admin/shopify-reconcile/mapping"
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open Product Mapping
                </Link>
              </div>
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
              <button
                onClick={handleAllTime}
                disabled={loading}
                className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                All Time
              </button>
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
              <div className="min-w-[260px] rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5">
                <p className="text-[11px] font-medium text-slate-500">Invoice Send To</p>
                <p className="text-sm font-semibold text-slate-700">mindy@olympic-equipment.com</p>
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
            {actionSuccess && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                <strong>Sent:</strong> {actionSuccess}
              </div>
            )}
            {actionError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <strong>Action:</strong> {actionError}
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
              <div className="bg-white border border-amber-200 rounded-lg p-4">
                <p className="text-xs font-medium text-amber-600">Name Matched (Invoice)</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{loading ? "â€¦" : countName}</p>
              </div>
              <div className="bg-white border border-emerald-200 rounded-lg p-4">
                <p className="text-xs font-medium text-emerald-600">Customer Found</p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">{loading ? "â€¦" : countCustomer}</p>
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
                  { key: "wa", label: `WA Tax Review (${countWa})` },
                  { key: "none", label: `Unmatched (${countNone})` },
                  { key: "manual", label: `Manual (${countManual})` },
                  { key: "name", label: `~ Name Match (${countName})` },
                  { key: "customer", label: `✓ Customer Found (${countCustomer})` },
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
                {loading && <span className="text-xs text-slate-500 animate-pulse">Loading data...</span>}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {/* Shopify side */}
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500 w-28">
                        Shopify #
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                        Customer
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500 w-28">
                        Date
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500 w-28">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-slate-500 w-24">
                        Shopify Status
                      </th>

                      {/* Match column */}
                      <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-slate-500 w-32">
                        Match
                      </th>

                      {/* QBO side */}
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500 w-28">QBO Invoice</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">QBO Customer</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500 w-40">QBO Rep Tags</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500 w-28">QBO Amount</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-slate-500 w-44">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 11 }).map((__, j) => (
                            <td key={j} className="px-4 py-2">
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
                            : row.matchType === "name"
                            ? "bg-amber-50/60"
                            : row.matchType === "customer"
                            ? "bg-emerald-50/60"
                            : "bg-red-50/60";

                        return (
                          <tr
                            key={row.shopify.id}
                            className={`${rowBg} hover:brightness-95 transition-all`}
                          >
                            <td className="px-4 py-2 font-mono font-semibold text-slate-800">{row.shopify.name}</td>
                            <td className="px-4 py-2 text-slate-800">
                              {row.shopify.customerName}
                              {row.shopify.isWashingtonDelivery && (
                                <div className="mt-1">
                                  <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                                    WA Tax Review
                                  </span>
                                </div>
                              )}
                              {manualMapById.get(String(row.shopify.id))?.note && (
                                <div className="text-[10px] text-blue-600 mt-0.5 italic">
                                  Note: {manualMapById.get(String(row.shopify.id))?.note}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{row.shopify.created_at?.slice(0, 10)}</td>
                            <td className="px-4 py-2 text-right font-semibold text-slate-800">{money(row.shopify.total_price)}</td>
                            <td className="px-4 py-2 text-center"><StatusBadge status={row.shopify.financial_status} /></td>
                            <td className="px-4 py-2 text-center"><MatchBadge type={row.matchType} /></td>
                            {row.qbo ? (
                              <>
                                <td className="px-4 py-2 font-mono text-slate-700">
                                  <div>#{row.qbo.docNumber}</div>
                                  {row.qbo.poNumber && (
                                    <div className="text-[10px] text-slate-500">PO: {row.qbo.poNumber}</div>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-slate-700">{row.qbo.customerName}</td>
                                <td className="px-4 py-2 text-slate-700">
                                  {row.qbo.salesRepTags?.length ? (
                                    <div className="flex flex-wrap gap-1">
                                      {row.qbo.salesRepTags.map((tag) => (
                                        <span key={`${row.qbo?.id}-${tag}`} className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-right font-semibold text-slate-800">{money(row.qbo.totalAmt)}</td>
                              </>
                            ) : (
                              <td
                                colSpan={4}
                                className={`px-4 py-2 text-center text-sm font-medium ${
                                  row.matchType === "cancelled"
                                    ? "text-slate-500"
                                    : row.matchType === "manual"
                                    ? "text-blue-700"
                                    : row.matchType === "customer"
                                    ? "text-emerald-700"
                                    : "text-red-500"
                                }`}>
                                {row.matchType === "cancelled"
                                  ? "Marked as cancelled"
                                  : row.matchType === "manual"
                                  ? "- Manually linked invoice (not in current QBO date filter yet) -"
                                  : row.matchType === "customer"
                                  ? "- Matching customer found in QuickBooks (no invoice linked yet) -"
                                  : "- Invoice not found in QuickBooks -"}
                              </td>
                            )}
                            <td className="px-4 py-2 text-center">
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setLinkTarget(row)}
                                  className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                                >
                                  {row.matchType === "manual" ? "Linked" : "Link Invoice"}
                                </button>
                                {row.qbo && (
                                  <button
                                    type="button"
                                    onClick={() => handleResendInvoice(row.qbo!.id)}
                                    disabled={resendingInvoiceFor === row.qbo.id}
                                    className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50"
                                  >
                                    {resendingInvoiceFor === row.qbo.id ? "Sending…" : "Resend"}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    row.matchType === "cancelled"
                                      ? handleUnlink(row.shopify.id)
                                      : handleMarkCancelled(row.shopify)
                                  }
                                  className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  {row.matchType === "cancelled" ? "Undo" : "Cancel"}
                                </button>
                                {row.matchType !== "cancelled" && row.matchType !== "manual" && (
                                  <button
                                    type="button"
                                    onClick={() => handleCreateNewInvoice(row.shopify)}
                                    disabled={creatingInvoiceFor === String(row.shopify.id)}
                                    className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                  >
                                    {creatingInvoiceFor === String(row.shopify.id)
                                      ? "Creating…"
                                      : "Create + Auto Send"}
                                  </button>
                                )}
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
            manualMapById.get(String(linkTarget.shopify.id))?.qbo_invoice_id ?? null
          }
          onSave={(inv, note) => handleSaveLink(linkTarget.shopify, inv, note)}
          onUnlink={() => handleUnlink(linkTarget.shopify.id)}
          onClose={() => setLinkTarget(null)}
        />
      )}
    </div>
  );
}
