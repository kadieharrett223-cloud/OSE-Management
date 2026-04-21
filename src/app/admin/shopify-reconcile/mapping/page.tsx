"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [productMappingSelection, setProductMappingSelection] = useState<Record<string, string>>({});
  const [loadingProductMappings, setLoadingProductMappings] = useState(false);
  const [savingProductMappingSku, setSavingProductMappingSku] = useState<string | null>(null);
  const [productMappingError, setProductMappingError] = useState<string | null>(null);
  const [showMappedProducts, setShowMappedProducts] = useState(false);

  const loadProductMappings = useCallback(async () => {
    setLoadingProductMappings(true);
    setProductMappingError(null);
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
      if (mappingData?.warning) {
        warnings.push(String(mappingData.warning));
      }
      if (!qboItemsRes.ok) {
        warnings.push(String(qboItemsData?.error || "Failed to load QBO items"));
      }
      if (warnings.length > 0) {
        setProductMappingError(warnings.join(" • "));
      }

      const nextSelection: Record<string, string> = {};
      rows.forEach((row) => {
        if (row.mappedQboItemId) {
          nextSelection[row.sku] = row.mappedQboItemId;
        }
      });
      setProductMappingSelection(nextSelection);
    } catch (err: any) {
      setProductMappingError(err?.message || "Failed to load product mappings");
    } finally {
      setLoadingProductMappings(false);
    }
  }, []);

  useEffect(() => {
    loadProductMappings();
  }, [loadProductMappings]);

  const handleSaveProductMapping = async (sku: string) => {
    const qboItemId = productMappingSelection[sku] || "";
    setSavingProductMappingSku(sku);
    setProductMappingError(null);
    try {
      const res = await fetch("/api/shopify/product-qbo-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, qbo_item_id: qboItemId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save product mapping");
      }

      await loadProductMappings();
    } catch (err: any) {
      setProductMappingError(err?.message || "Failed to save product mapping");
    } finally {
      setSavingProductMappingSku(null);
    }
  };

  const visibleProductMappings = useMemo(() => {
    if (showMappedProducts) return productMappings;
    return productMappings.filter((row) => row.mappingSource === "none");
  }, [productMappings, showMappedProducts]);

  const unmappedCount = productMappings.filter((row) => row.mappingSource === "none").length;

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
                  Back to Reconcile
                </Link>
              </div>
            </header>

            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Shopify Product → QBO Item Mapping</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Use this page to map all Shopify products to QuickBooks products.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-red-600">Unmapped: {unmappedCount}</span>
                  <button
                    type="button"
                    onClick={() => setShowMappedProducts((v) => !v)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {showMappedProducts ? "Show Unmapped Only" : "Show All"}
                  </button>
                  <button
                    type="button"
                    onClick={loadProductMappings}
                    disabled={loadingProductMappings}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loadingProductMappings ? "Loading…" : "Refresh Products"}
                  </button>
                </div>
              </div>

              {productMappingError && (
                <div className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {productMappingError}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">SKU</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Shopify Product</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Current Mapping</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">QBO Item</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase text-slate-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loadingProductMappings ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-5 text-center text-slate-400">Loading product mappings…</td>
                      </tr>
                    ) : visibleProductMappings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-5 text-center text-slate-400">No SKUs to map.</td>
                      </tr>
                    ) : (
                      visibleProductMappings.map((row) => {
                        const selected = productMappingSelection[row.sku] || "";
                        return (
                          <tr key={`${row.sku}-${row.variantId}`}>
                            <td className="px-4 py-2.5 font-mono text-slate-800">{row.sku}</td>
                            <td className="px-4 py-2.5 text-slate-700">
                              {row.productTitle}
                              {row.variantTitle && row.variantTitle !== "Default Title" && (
                                <span className="text-xs text-slate-500"> · {row.variantTitle}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs">
                              {row.mappingSource === "none" ? (
                                <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700">Not mapped</span>
                              ) : row.mappingSource === "explicit" ? (
                                <span className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-700">Explicit map</span>
                              ) : (
                                <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">Price list map</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <select
                                value={selected}
                                onChange={(e) =>
                                  setProductMappingSelection((prev) => ({
                                    ...prev,
                                    [row.sku]: e.target.value,
                                  }))
                                }
                                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
                              >
                                <option value="">Select QBO item…</option>
                                {qboItems.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.sku ? `${item.sku} — ` : ""}{item.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleSaveProductMapping(row.sku)}
                                disabled={savingProductMappingSku === row.sku || !selected}
                                className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                              >
                                {savingProductMappingSku === row.sku ? "Saving…" : "Save Mapping"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
