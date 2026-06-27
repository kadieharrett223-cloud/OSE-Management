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

type ContainerStatus = "in_transit" | "arrived" | "unloading" | "complete" | "delayed";

type ContainerItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
};

type ContainerRow = {
  id: string;
  containerCode: string;
  status: ContainerStatus;
  createdAt: string;
  updatedAt: string;
  items: ContainerItem[];
};

const STATUS_LABELS: Record<ContainerStatus, string> = {
  in_transit: "In Transit",
  arrived: "Arrived",
  unloading: "Unloading",
  complete: "Complete",
  delayed: "Delayed",
};

const STATUS_OPTIONS: ContainerStatus[] = ["in_transit", "arrived", "unloading", "complete", "delayed"];

export default function InventoryTrackerPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [containers, setContainers] = useState<ContainerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingContainer, setCreatingContainer] = useState(false);
  const [containerCode, setContainerCode] = useState("");
  const [containerStatus, setContainerStatus] = useState<ContainerStatus>("in_transit");
  const [addingItemForContainerId, setAddingItemForContainerId] = useState<string | null>(null);
  const [selectedProductIdByContainer, setSelectedProductIdByContainer] = useState<Record<string, string>>({});
  const [quantityByContainer, setQuantityByContainer] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [productsRes, containersRes] = await Promise.all([
        fetch("/api/inventory/products", { cache: "no-store" }),
        fetch("/api/inventory/containers", { cache: "no-store" }),
      ]);

      const productsResult = await productsRes.json();
      if (!productsRes.ok) throw new Error(productsResult?.error || "Failed to load products");

      const containersResult = await containersRes.json();
      if (!containersRes.ok) throw new Error(containersResult?.error || "Failed to load containers");

      setProducts((productsResult.data || []) as ProductRow[]);
      setContainers((containersResult.data || []) as ContainerRow[]);
    } catch (error: any) {
      alert(error?.message || "Failed to load inventory tracker data");
    } finally {
      setLoading(false);
    }
  }

  async function createContainer(e: React.FormEvent) {
    e.preventDefault();
    const code = containerCode.trim();
    if (!code) {
      alert("Container code is required.");
      return;
    }

    setCreatingContainer(true);
    try {
      const res = await fetch("/api/inventory/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ containerCode: code, status: containerStatus }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to create container");

      setContainerCode("");
      setContainerStatus("in_transit");
      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Failed to create container");
    } finally {
      setCreatingContainer(false);
    }
  }

  async function updateContainerStatus(containerId: string, status: ContainerStatus) {
    try {
      const res = await fetch(`/api/inventory/containers/${containerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to update status");

      setContainers((prev) => prev.map((container) => (container.id === containerId ? { ...container, status } : container)));
    } catch (error: any) {
      alert(error?.message || "Failed to update status");
    }
  }

  async function deleteContainer(containerId: string) {
    if (!confirm("Delete this container and all items on it?")) return;

    try {
      const res = await fetch(`/api/inventory/containers/${containerId}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to delete container");
      setContainers((prev) => prev.filter((container) => container.id !== containerId));
    } catch (error: any) {
      alert(error?.message || "Failed to delete container");
    }
  }

  async function addItemToContainer(containerId: string) {
    const productId = String(selectedProductIdByContainer[containerId] || "").trim();
    const quantity = Number(quantityByContainer[containerId] || "0");

    if (!productId) {
      alert("Select a product first.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert("Enter a quantity greater than 0.");
      return;
    }

    setAddingItemForContainerId(containerId);
    try {
      const res = await fetch(`/api/inventory/containers/${containerId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to add item");

      setQuantityByContainer((prev) => ({ ...prev, [containerId]: "" }));
      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Failed to add item");
    } finally {
      setAddingItemForContainerId(null);
    }
  }

  async function removeContainerItem(itemId: string) {
    try {
      const res = await fetch(`/api/inventory/container-items/${itemId}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to remove item");
      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Failed to remove item");
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
              Track product inventory, customer orders, and incoming containers. Container contents are linked to your real inventory products.
            </p>
          </header>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Containers</h2>
              <button
                onClick={loadAll}
                className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>

            <form onSubmit={createContainer} className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
              <input
                value={containerCode}
                onChange={(e) => setContainerCode(e.target.value)}
                placeholder="Container code (e.g. OSE-CN-1142)"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-400 focus:ring"
              />
              <select
                value={containerStatus}
                onChange={(e) => setContainerStatus((e.target.value as ContainerStatus) || "in_transit")}
                className="rounded-md border border-slate-300 px-2 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={creatingContainer}
                className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingContainer ? "Creating..." : "Create Container"}
              </button>
            </form>

            {containers.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">No containers yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {containers.map((container) => (
                  <div key={container.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold">{container.containerCode}</p>
                        <p className="text-xs text-slate-500">Items on container: {container.items.length}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={container.status}
                          onChange={(e) => updateContainerStatus(container.id, e.target.value as ContainerStatus)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => deleteContainer(container.id)}
                          className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                      <select
                        value={selectedProductIdByContainer[container.id] || ""}
                        onChange={(e) => setSelectedProductIdByContainer((prev) => ({ ...prev, [container.id]: e.target.value }))}
                        className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                      >
                        <option value="">Select product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={quantityByContainer[container.id] || ""}
                        onChange={(e) => setQuantityByContainer((prev) => ({ ...prev, [container.id]: e.target.value }))}
                        placeholder="Quantity"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => addItemToContainer(container.id)}
                        disabled={addingItemForContainerId === container.id}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {addingItemForContainerId === container.id ? "Adding..." : "Add Product"}
                      </button>
                    </div>

                    {container.items.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-600">No products added to this container yet.</p>
                    ) : (
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-left text-slate-600">
                              <th className="px-2 py-2 font-medium">Product</th>
                              <th className="px-2 py-2 font-medium">Quantity</th>
                              <th className="px-2 py-2 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {container.items.map((item) => (
                              <tr key={item.id} className="border-b border-slate-100">
                                <td className="px-2 py-2">{item.productName}</td>
                                <td className="px-2 py-2">{item.quantity}</td>
                                <td className="px-2 py-2">
                                  <button
                                    onClick={() => removeContainerItem(item.id)}
                                    className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Products</h2>
              <button
                onClick={loadAll}
                className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>

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
