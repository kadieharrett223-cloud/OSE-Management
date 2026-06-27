"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

type ProductRow = {
  id: string;
  name: string;
  onFloor: number;
  sold: number;
  available: number;
  orderCount: number;
};

export default function InventoryTrackerPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productDrafts, setProductDrafts] = useState<Record<string, { name: string; onFloor: string; sold: string; available: string }>>({});
  const [newProduct, setNewProduct] = useState({ name: "", onFloor: "0", sold: "0", available: "0" });
  const [creatingProduct, setCreatingProduct] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    try {
      const productsRes = await fetch("/api/inventory/products", { cache: "no-store" });

      const productsResult = await productsRes.json();
      if (!productsRes.ok) throw new Error(productsResult?.error || "Failed to load products");

      setProducts((productsResult.data || []) as ProductRow[]);
      const nextDrafts: Record<string, { name: string; onFloor: string; sold: string; available: string }> = {};
      for (const product of (productsResult.data || []) as ProductRow[]) {
        nextDrafts[product.id] = {
          name: product.name,
          onFloor: String(product.onFloor),
          sold: String(product.sold),
          available: String(product.available),
        };
      }
      setProductDrafts(nextDrafts);
    } catch (error: any) {
      alert(error?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  async function saveProduct(productId: string) {
    const draft = productDrafts[productId];
    if (!draft) return;

    const payload = {
      name: draft.name.trim(),
      onFloor: Number(draft.onFloor || "0"),
      sold: Number(draft.sold || "0"),
      available: Number(draft.available || "0"),
    };

    if (!payload.name) {
      alert("Product name is required.");
      return;
    }

    setSavingProductId(productId);
    try {
      const res = await fetch(`/api/inventory/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to update product");
      await loadProducts();
      setEditingProductId(null);
    } catch (error: any) {
      alert(error?.message || "Failed to update product");
    } finally {
      setSavingProductId(null);
    }
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      name: newProduct.name.trim(),
      onFloor: Number(newProduct.onFloor || "0"),
      sold: Number(newProduct.sold || "0"),
      available: Number(newProduct.available || "0"),
    };

    if (!payload.name) {
      alert("Product name is required.");
      return;
    }

    setCreatingProduct(true);
    try {
      const res = await fetch("/api/inventory/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to create product");

      setNewProduct({ name: "", onFloor: "0", sold: "0", available: "0" });
      await loadProducts();
    } catch (error: any) {
      alert(error?.message || "Failed to create product");
    } finally {
      setCreatingProduct(false);
    }
  }

  function resetProductDraft(product: ProductRow) {
    setProductDrafts((prev) => ({
      ...prev,
      [product.id]: {
        name: product.name,
        onFloor: String(product.onFloor),
        sold: String(product.sold),
        available: String(product.available),
      },
    }));
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:flex">
      <Sidebar activePage="Inventory Tracker" />

      <main className="w-full px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">Inventory Tracker</h1>
                <p className="mt-1 text-sm text-slate-600">Manage product counts here. Container management is in the inventory containers subpage.</p>
              </div>
              <Link
                href="/admin/inventory-tracker/containers"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Open Containers
              </Link>
            </div>
          </header>

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

            <form onSubmit={createProduct} className="mb-4 grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_120px_120px_120px_auto]">
              <input
                value={newProduct.name}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Missing product name"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                value={newProduct.onFloor}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, onFloor: e.target.value }))}
                placeholder="On floor"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                value={newProduct.sold}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, sold: e.target.value }))}
                placeholder="Sold"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                value={newProduct.available}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, available: e.target.value }))}
                placeholder="Available"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={creatingProduct}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingProduct ? "Adding..." : "Add Product"}
              </button>
            </form>

            {loading ? (
              <p className="text-sm text-slate-600">Loading products...</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-slate-600">No products available yet.</p>
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
                      <th className="px-2 py-2 font-medium">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-b border-slate-100">
                        {editingProductId === product.id ? (
                          <>
                            <td className="px-2 py-2">
                              <input
                                value={productDrafts[product.id]?.name || ""}
                                onChange={(e) =>
                                  setProductDrafts((prev) => ({
                                    ...prev,
                                    [product.id]: {
                                      ...(prev[product.id] || { name: "", onFloor: "0", sold: "0", available: "0" }),
                                      name: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full min-w-56 rounded-md border border-slate-300 px-2 py-1 text-sm"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min={0}
                                value={productDrafts[product.id]?.onFloor || "0"}
                                onChange={(e) =>
                                  setProductDrafts((prev) => ({
                                    ...prev,
                                    [product.id]: {
                                      ...(prev[product.id] || { name: "", onFloor: "0", sold: "0", available: "0" }),
                                      onFloor: e.target.value,
                                    },
                                  }))
                                }
                                className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min={0}
                                value={productDrafts[product.id]?.sold || "0"}
                                onChange={(e) =>
                                  setProductDrafts((prev) => ({
                                    ...prev,
                                    [product.id]: {
                                      ...(prev[product.id] || { name: "", onFloor: "0", sold: "0", available: "0" }),
                                      sold: e.target.value,
                                    },
                                  }))
                                }
                                className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min={0}
                                value={productDrafts[product.id]?.available || "0"}
                                onChange={(e) =>
                                  setProductDrafts((prev) => ({
                                    ...prev,
                                    [product.id]: {
                                      ...(prev[product.id] || { name: "", onFloor: "0", sold: "0", available: "0" }),
                                      available: e.target.value,
                                    },
                                  }))
                                }
                                className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-2 py-2">{product.name}</td>
                            <td className="px-2 py-2">{product.onFloor}</td>
                            <td className="px-2 py-2">{product.sold}</td>
                            <td className="px-2 py-2">{product.available}</td>
                          </>
                        )}

                        <td className="px-2 py-2">{product.orderCount}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            {editingProductId === product.id ? (
                              <>
                                <button
                                  onClick={() => saveProduct(product.id)}
                                  disabled={savingProductId === product.id}
                                  className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {savingProductId === product.id ? "Saving..." : "Save"}
                                </button>
                                <button
                                  onClick={() => {
                                    resetProductDraft(product);
                                    setEditingProductId(null);
                                  }}
                                  className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setEditingProductId(product.id)}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </td>
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
