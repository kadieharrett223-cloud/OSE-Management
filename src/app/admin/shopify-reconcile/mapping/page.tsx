"use client";


// ── QBO item combobox (searchable typeahead) ──────────────────────────────

interface QboComboboxProps {
  items: QboItemOption[];
  value: string;
  onChange: (id: string) => void;
}

function QboCombobox({ items, value, onChange }: QboComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.id === value) ?? null;
  const displayText = open ? query : (selected ? `${selected.sku ? selected.sku + " — " : ""}${selected.name}` : "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 80);
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.sku && i.sku.toLowerCase().includes(q))
    ).slice(0, 80);
  }, [items, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (id: string) => { onChange(id); setOpen(false); setQuery(""); };
  const handleClear = (e: React.MouseEvent) => { e.stopPropagation(); onChange(""); setQuery(""); setOpen(false); };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center rounded-md border border-slate-300 bg-white">
        <input
          type="text"
          className="flex-1 min-w-0 px-2 py-1.5 text-xs text-slate-700 bg-transparent outline-none"
          placeholder="Search QBO item…"
          value={displayText}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        />
        {value && (
          <button type="button" onClick={handleClear} className="px-1.5 text-slate-400 hover:text-slate-600 text-sm leading-none" title="Clear">×</button>
        )}
        <button type="button" onClick={() => setOpen((v) => !v)} className="px-1.5 text-slate-400 hover:text-slate-600 text-xs">▾</button>
      </div>
      {open && (
        <ul className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg text-xs">
          <li className="px-3 py-2 cursor-pointer text-slate-400 hover:bg-slate-50 italic" onMouseDown={() => handleSelect("")}>— None (clear mapping) —</li>
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-slate-400">No results</li>
          ) : (
            filtered.map((item) => (
              <li
                key={item.id}
                onMouseDown={() => handleSelect(item.id)}
                className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${value === item.id ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-700"}`}
              >
                {item.sku ? <span className="font-mono text-slate-500 mr-1">{item.sku}</span> : null}
                {item.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

interface QboItemOption {
  id: string;
  name: string;
  sku?: string;
}

interface ProductMappingRow {
  sku: string;
  variantId: number;
  productTitle: string;
  variantTitle: string;
  mappedQboItemId: string | null;
  mappingSource: "explicit" | "price_list" | "none";
}

export default function ShopifyReconcileMappingPage() {
  const [qboItems, setQboItems] = useState<QboItemOption[]>([]);
  const [productMappings, setProductMappings] = useState<ProductMappingRow[]>([]);
  // Current dropdown selections (keyed by sku)
  const [selection, setSelection] = useState<Record<string, string>>({});
  // Snapshot of selections as last saved/loaded — used to compute dirty set
  const [savedSelection, setSavedSelection] = useState<Record<string, string>>({});
  // Per-row save feedback
  const [rowStatus, setRowStatus] = useState<Record<string, "saving" | "saved" | "error">>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  const [showMappedProducts, setShowMappedProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadProductMappings = useCallback(async () => {
    setLoading(true);
    setGlobalError(null);
    setGlobalSuccess(null);
    setRowStatus({});
    setRowError({});
    try {
      const [mappingRes, qboItemsRes] = await Promise.all([
        fetch("/api/shopify/product-qbo-mappings"),
        fetch("/api/qbo/item"),
      ]);

      const mappingData = await mappingRes.json().catch(() => ({}));
      const qboItemsData = await qboItemsRes.json().catch(() => ({}));

      if (!mappingRes.ok) {
        throw new Error(mappingData?.error || "Failed to load Shopify/QBO product mappings");
      }

      const rows: ProductMappingRow[] = Array.isArray(mappingData?.mappings) ? mappingData.mappings : [];
      const qboList: QboItemOption[] = qboItemsRes.ok && Array.isArray(qboItemsData?.items) ? qboItemsData.items : [];

      setProductMappings(rows);
      setQboItems(qboList);

      const warnings: string[] = [];
      if (mappingData?.warning) warnings.push(String(mappingData.warning));
      if (!qboItemsRes.ok) warnings.push(String(qboItemsData?.error || "Failed to load QBO items"));
      if (warnings.length > 0) setGlobalError(warnings.join(" • "));

      const init: Record<string, string> = {};
      rows.forEach((row) => { if (row.mappedQboItemId) init[row.sku] = row.mappedQboItemId; });
      setSelection(init);
      setSavedSelection(init);
    } catch (err: any) {
      setGlobalError(err?.message || "Failed to load product mappings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProductMappings(); }, [loadProductMappings]);

  // ── Dirty set ─────────────────────────────────────────────────────────────

  const dirtySkus = useMemo(() => {
    const dirty = new Set<string>();
    const allSkus = new Set([...Object.keys(selection), ...Object.keys(savedSelection)]);
    allSkus.forEach((sku) => {
      const cur = selection[sku] || "";
      const saved = savedSelection[sku] || "";
      if (cur !== saved) dirty.add(sku);
    });
    return dirty;
  }, [selection, savedSelection]);

  // ── Save helpers ──────────────────────────────────────────────────────────

  const applySuccess = useCallback((skus: string[]) => {
    setSavedSelection((prev) => {
      const next = { ...prev };
      skus.forEach((sku) => {
        const val = selection[sku] || "";
        if (val) next[sku] = val;
        else delete next[sku];
      });
      return next;
    });
    setProductMappings((prev) =>
      prev.map((row) => {
        if (!skus.includes(row.sku)) return row;
        const qboItemId = selection[row.sku] || null;
        return { ...row, mappedQboItemId: qboItemId, mappingSource: qboItemId ? "explicit" : "none" };
      })
    );
  }, [selection]);

  const handleSaveSingle = async (sku: string) => {
    const qboItemId = selection[sku] || null;
    setRowStatus((p) => ({ ...p, [sku]: "saving" }));
    setRowError((p) => { const n = { ...p }; delete n[sku]; return n; });
    setGlobalError(null);
    try {
      const res = await fetch("/api/shopify/product-qbo-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, qbo_item_id: qboItemId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save");
      setRowStatus((p) => ({ ...p, [sku]: "saved" }));
      applySuccess([sku]);
      setTimeout(() => setRowStatus((p) => { const n = { ...p }; delete n[sku]; return n; }), 2500);
    } catch (err: any) {
      setRowStatus((p) => ({ ...p, [sku]: "error" }));
      setRowError((p) => ({ ...p, [sku]: err?.message || "Save failed" }));
    }
  };

  const handleBulkSave = async () => {
    if (dirtySkus.size === 0) return;
    setBulkSaving(true);
    setGlobalError(null);
    setGlobalSuccess(null);
    const mappings = Array.from(dirtySkus).map((sku) => ({
      sku,
      qbo_item_id: selection[sku] || null,
    }));
    try {
      const res = await fetch("/api/shopify/product-qbo-mappings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Bulk save failed");
      applySuccess(Array.from(dirtySkus));
      setGlobalSuccess(`Saved ${mappings.length} mapping${mappings.length !== 1 ? "s" : ""} successfully.`);
      setTimeout(() => setGlobalSuccess(null), 3000);
    } catch (err: any) {
      setGlobalError(err?.message || "Bulk save failed");
    } finally {
      setBulkSaving(false);
    }
  };

  // ── Filtering / pagination ─────────────────────────────────────────────────

  const filteredProductMappings = useMemo(() => {
    let rows = showMappedProducts
      ? productMappings
      : productMappings.filter((row) => row.mappingSource === "none" || dirtySkus.has(row.sku));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter(
        (row) =>
          row.sku.toLowerCase().includes(q) ||
          row.productTitle.toLowerCase().includes(q) ||
          row.variantTitle.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [productMappings, showMappedProducts, searchQuery, dirtySkus]);

  const totalPages = Math.max(1, Math.ceil(filteredProductMappings.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const visibleProductMappings = useMemo(
    () => filteredProductMappings.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredProductMappings, safePage]
  );

  const unmappedCount = productMappings.filter((row) => row.mappingSource === "none").length;

  const handleToggleMapped = () => { setShowMappedProducts((v) => !v); setCurrentPage(1); };
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => { setSearchQuery(e.target.value); setCurrentPage(1); };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Shopify Reconcile" />

        <main className="flex-1 overflow-x-auto bg-slate-50 text-slate-900">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">
            <header>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Admin</p>
              <h1 className="text-2xl font-semibold text-slate-900">Shopify Reconcile Product Mapping</h1>
              <p className="mt-1 text-sm text-slate-500">
                Map Shopify SKUs to QuickBooks items used during reconcile invoice creation.
              </p>
              <div className="mt-3">
                <Link
                  href="/admin/shopify-reconcile"
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ← Back to Reconcile
                </Link>
              </div>
            </header>

            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              {/* Header bar */}
              <div className="border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Shopify Product → QBO Item Mapping</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select a QBO item per SKU, then save individually or use <strong>Save All Changes</strong>.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    placeholder="Search SKU / product…"
                    value={searchQuery}
                    onChange={handleSearch}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 w-44"
                  />
                  <span className="text-xs font-medium text-red-600">Unmapped: {unmappedCount}</span>
                  {dirtySkus.size > 0 && (
                    <span className="text-xs font-medium text-amber-600">Unsaved: {dirtySkus.size}</span>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleMapped}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {showMappedProducts ? "Show Unmapped Only" : "Show All"}
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkSave}
                    disabled={bulkSaving || dirtySkus.size === 0}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {bulkSaving ? "Saving…" : `Save All Changes${dirtySkus.size > 0 ? ` (${dirtySkus.size})` : ""}`}
                  </button>
                  <button
                    type="button"
                    onClick={loadProductMappings}
                    disabled={loading}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? "Loading…" : "Refresh"}
                  </button>
                </div>
              </div>

              {/* Global feedback */}
              {globalError && (
                <div className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {globalError}
                </div>
              )}
              {globalSuccess && (
                <div className="mx-4 mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {globalSuccess}
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">SKU</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Shopify Product</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">QBO Item</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase text-slate-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-5 text-center text-slate-400">Loading product mappings…</td>
                      </tr>
                    ) : visibleProductMappings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-5 text-center text-slate-400">No SKUs to map.</td>
                      </tr>
                    ) : (
                      visibleProductMappings.map((row) => {
                        const selected = selection[row.sku] || "";
                        const isDirty = dirtySkus.has(row.sku);
                        const status = rowStatus[row.sku];
                        const errMsg = rowError[row.sku];
                        return (
                          <tr
                            key={`${row.sku}-${row.variantId}`}
                            className={isDirty ? "bg-amber-50" : undefined}
                          >
                            <td className="px-4 py-2.5 font-mono text-slate-800">
                              {row.sku}
                              {isDirty && <span className="ml-1 text-amber-500 text-xs">●</span>}
                            </td>
                            <td className="px-4 py-2.5 text-slate-700">
                              {row.productTitle}
                              {row.variantTitle && row.variantTitle !== "Default Title" && (
                                <span className="text-xs text-slate-500"> · {row.variantTitle}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs">
                              {status === "saved" ? (
                                <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">✓ Saved</span>
                              ) : status === "error" ? (
                                <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700" title={errMsg}>⚠ Error</span>
                              ) : row.mappingSource === "none" ? (
                                <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700">Not mapped</span>
                              ) : row.mappingSource === "explicit" ? (
                                <span className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-700">Explicit map</span>
                              ) : (
                                <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">Price list map</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <QboCombobox
                                items={qboItems}
                                value={selected}
                                onChange={(id) => setSelection((prev) => ({ ...prev, [row.sku]: id }))}
                              />
                              {errMsg && <p className="mt-0.5 text-[10px] text-red-600">{errMsg}</p>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleSaveSingle(row.sku)}
                                disabled={status === "saving" || !isDirty}
                                className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                              >
                                {status === "saving" ? "Saving…" : "Save"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                  <span className="text-xs text-slate-500">
                    Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredProductMappings.length)} of {filteredProductMappings.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      ← Prev
                    </button>
                    <span className="px-2 text-xs text-slate-500">Page {safePage} / {totalPages}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
