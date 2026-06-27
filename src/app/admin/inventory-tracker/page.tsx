"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

type ProductRow = {
  id: string;
  name: string;
  onFloor: number;
  sold: number;
  available: number;
  orderCount: number;
};

type ParsedImportRow = {
  name: string;
  onFloor: number;
  sold: number;
  available: number;
};

const toInt = (value: string) => {
  const cleaned = value.replace(/,/g, "").trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
};

function parseLine(line: string): ParsedImportRow | null {
  const delimiter = line.includes("\t") ? "\t" : ",";
  const parts = line
    .split(delimiter)
    .map((part) => part.trim())
    .filter((part, index) => index === 0 || part.length > 0);

  if (parts.length < 4) return null;

  const joined = parts.join(" ").toLowerCase();
  const looksLikeHeader =
    joined.includes("product") &&
    (joined.includes("floor") || joined.includes("available") || joined.includes("sold"));
  if (looksLikeHeader) return null;

  return {
    name: parts[0],
    onFloor: toInt(parts[1] || "0"),
    sold: toInt(parts[2] || "0"),
    available: toInt(parts[3] || "0"),
  };
}

function parsePastedProducts(input: string): ParsedImportRow[] {
  const rows = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLine)
    .filter((row): row is ParsedImportRow => !!row && row.name.length > 0);

  const deduped = new Map<string, ParsedImportRow>();
  for (const row of rows) {
    deduped.set(row.name.toLowerCase(), row);
  }

  return Array.from(deduped.values());
}

export default function InventoryTrackerPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [mode, setMode] = useState<"replace" | "append">("replace");

  const previewRows = useMemo(() => parsePastedProducts(pasteText), [pasteText]);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory/products", { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to load products");
      setProducts((result.data || []) as ProductRow[]);
    } catch (error: any) {
      alert(error?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  async function runImport() {
    if (previewRows.length === 0) {
      alert("Paste at least one valid row before importing.");
      return;
    }

    setImporting(true);
    try {
      const res = await fetch("/api/inventory/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: previewRows, mode }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Import failed");

      setPasteText("");
      await loadProducts();
      alert(`Imported ${result.imported} products.`);
    } catch (error: any) {
      alert(error?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:flex">
      <Sidebar activePage="Inventory Tracker" />

      <main className="w-full px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="text-2xl font-semibold">Inventory Tracker</h1>
            <p className="mt-1 text-sm text-slate-600">
              Paste product name, on-floor count, sold count, and available count. Website price and sale percentage are not used.
            </p>
          </header>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Bulk Import</h2>
            <p className="mt-1 text-sm text-slate-600">
              Accepts tab-separated or comma-separated rows. Expected order: Product, On Floor, Sold, Available.
            </p>

            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Product A\t5\t1\t4\nProduct B\t8\t2\t6"}
              className="mt-3 h-40 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-400 focus:ring"
            />

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-sm">
                Import mode
                <select
                  value={mode}
                  onChange={(e) => setMode((e.target.value as "replace" | "append") || "replace")}
                  className="ml-2 rounded border border-slate-300 px-2 py-1"
                >
                  <option value="replace">Replace all products</option>
                  <option value="append">Append/update by product name</option>
                </select>
              </label>
              <span className="text-sm text-slate-600">Preview rows: {previewRows.length}</span>
              <button
                onClick={runImport}
                disabled={importing}
                className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {importing ? "Importing..." : "Import Products"}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Products</h2>
              <button
                onClick={loadProducts}
                className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-slate-600">Loading products...</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-slate-600">No products yet. Paste and import your first list above.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="px-2 py-2 font-medium">Product</th>
                      <th className="px-2 py-2 font-medium">On Floor</th>
                      <th className="px-2 py-2 font-medium">Sold</th>
                      <th className="px-2 py-2 font-medium">Available</th>
                      <th className="px-2 py-2 font-medium">Orders</th>
                      <th className="px-2 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-b border-slate-100">
                        <td className="px-2 py-2">{product.name}</td>
                        <td className="px-2 py-2">{product.onFloor}</td>
                        <td className="px-2 py-2">{product.sold}</td>
                        <td className="px-2 py-2">{product.available}</td>
                        <td className="px-2 py-2">{product.orderCount}</td>
                        <td className="px-2 py-2">
                          <Link
                            href={`/admin/inventory-tracker/${product.id}`}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                          >
                            Open Orders
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
