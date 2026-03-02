"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ShopifyProduct {
  id: number;
  title: string;
  variants: Array<{
    id: number;
    title: string;
    sku: string;
    price: string;
  }>;
}

interface ShopifyCollection {
  id: number;
  title: string;
  handle: string;
}

interface PriceListItem {
  id: string;
  item_no?: string;
  sku?: string;
  description: string;
  list_price?: number;
  shopify_variant_id: string | null;
}

function truncateTitle(title: string, maxChars = 20) {
  return title.length > maxChars ? `${title.slice(0, maxChars)}...` : title;
}

export default function ShopifyMappingTab() {
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([]);
  const [priceListItems, setPriceListItems] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [collections, setCollections] = useState<ShopifyCollection[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [savingCollections, setSavingCollections] = useState(false);
  const [creatingVariant, setCreatingVariant] = useState<{ id: number; label: string } | null>(null);
  const [newItemSku, setNewItemSku] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [creatingItem, setCreatingItem] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const shopifyRes = await fetch("/api/shopify/products");
      if (!shopifyRes.ok) {
        const errorData = await shopifyRes.json();
        throw new Error(errorData.error || `Shopify API error: ${shopifyRes.status}`);
      }
      const shopifyData = await shopifyRes.json();
      setShopifyProducts(shopifyData.products || []);

      const priceRes = await fetch("/api/price-list");
      if (!priceRes.ok) {
        const errorData = await priceRes.json();
        throw new Error(errorData.error || `Price list error: ${priceRes.status}`);
      }
      const priceData = await priceRes.json();
      const priceItems: PriceListItem[] = Array.isArray(priceData) ? priceData : (priceData.items || []);
      setPriceListItems(priceItems);
      
      const existingMappings: Record<string, string> = {};
      priceItems.forEach((item: PriceListItem) => {
        if (item.shopify_variant_id) {
          existingMappings[item.shopify_variant_id] = item.id;
        }
      });
      setMappings(existingMappings);

      const collectionsRes = await fetch("/api/shopify/collections");
      if (collectionsRes.ok) {
        const collectionsData = await collectionsRes.json();
        setCollections(collectionsData.collections || []);
      }

      const settingsRes = await fetch("/api/shopify/settings");
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const ids = settingsData.settings?.allowed_collection_ids || [];
        setSelectedCollections(ids);
      }
    } catch (error: any) {
      console.error("Failed to load data:", error);
      setError(error.message || "Failed to load data. Please check your Shopify connection in Settings.");
    } finally {
      setLoading(false);
    }
  }

  async function saveMapping(variantId: number, priceListItemId: string | null) {
    setSaving(true);
    try {
      const res = await fetch("/api/shopify/map-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: variantId.toString(),
          priceListItemId,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save mapping");
      }

      const newMappings = { ...mappings };
      if (priceListItemId) {
        newMappings[variantId.toString()] = priceListItemId;
      } else {
        delete newMappings[variantId.toString()];
      }
      setMappings(newMappings);
    } catch (error: any) {
      console.error("Failed to save mapping:", error);
      alert("Failed to save mapping");
    } finally {
      setSaving(false);
    }
  }

  const filteredProducts = shopifyProducts.filter(product =>
    product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.variants.some(v => v.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const createPriceListItem = async () => {
    const response = await fetch("/api/price-list/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_no: newItemSku,
        description: newItemDescription,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Failed to create price list item");
    }

    const item = data.item as any;
    const normalized: PriceListItem = {
      id: item.id,
      item_no: item.sku,
      sku: item.sku,
      description: item.description || "",
      list_price: Number(item.currentSalePricePerUnit ?? item.list_price ?? 0),
      shopify_variant_id: item.shopify_variant_id ?? null,
    };

    return normalized;
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-600">Loading Shopify products...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-md mx-auto rounded-lg border border-red-300 bg-red-50 p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Products</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={loadData}
              className="w-full rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Try Again
            </button>
            <Link
              href="/settings"
              className="block w-full rounded border border-red-600 px-4 py-2 text-center text-red-600 hover:bg-red-50"
            >
              Go to Settings to Connect Shopify
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Visible Shopify Collections</h3>
        {collections.length === 0 ? (
          <p className="text-sm text-gray-500">No collections found.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {collections.map((collection) => (
              <label key={collection.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  value={collection.id}
                  checked={selectedCollections.includes(collection.id.toString())}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedCollections((prev) =>
                      prev.includes(id)
                        ? prev.filter((x) => x !== id)
                        : [...prev, id]
                    );
                  }}
                />
                {collection.title}
              </label>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={async () => {
              setSavingCollections(true);
              try {
                const res = await fetch("/api/shopify/settings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ allowed_collection_ids: selectedCollections }),
                });
                if (!res.ok) throw new Error("Failed to save collection filter");
                await loadData();
              } catch (e) {
                setError("Failed to save collection filter");
              } finally {
                setSavingCollections(false);
              }
            }}
            className="rounded bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            disabled={savingCollections}
          >
            {savingCollections ? "Saving..." : "Save Collection Filter"}
          </button>
          <span className="text-xs text-gray-500">Only products from selected collections will show.</span>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Shopify Product</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Variant/SKU</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Current Price</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mapped To</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredProducts.map((product) =>
              product.variants.map((variant) => {
                const mappedItemId = mappings[variant.id.toString()];
                const mappedItem = priceListItems.find(item => item.id === mappedItemId);

                return (
                  <tr key={variant.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 max-w-md truncate" title={product.title}>
                        {truncateTitle(product.title, 20)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{variant.title}</div>
                      {variant.sku && (
                        <div className="text-xs text-gray-500">SKU: {variant.sku}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">${variant.price}</div>
                    </td>
                    <td className="px-4 py-3">
                      {mappedItem ? (
                        <div>
                          <div className="text-sm font-medium text-green-600">
                            {mappedItem.item_no || mappedItem.sku}
                          </div>
                          <div className="text-xs text-gray-500">
                            {mappedItem.description}
                          </div>
                          <div className="text-xs text-gray-500">
                            List: ${(mappedItem.list_price ?? 0).toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not mapped</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <select
                          value={mappedItemId || ""}
                          onChange={(e) => saveMapping(variant.id, e.target.value || null)}
                          disabled={saving}
                          className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          <option value="">Not mapped</option>
                          {priceListItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {(item.item_no || item.sku || "")} - {item.description}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const label = `${product.title} - ${variant.title}${variant.sku ? ` (${variant.sku})` : ""}`;
                            setCreatingVariant({ id: variant.id, label });
                            setNewItemSku(variant.sku || "");
                            setNewItemDescription(`${product.title} - ${variant.title}`);
                            setCreateError(null);
                          }}
                          className="px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-100"
                        >
                          New Item
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

      {filteredProducts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No products found. {searchQuery && "Try adjusting your search."}
        </div>
      )}

      {creatingVariant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create Price List Item</h3>
              <p className="text-sm text-gray-600 mt-1">Map to: {creatingVariant.label}</p>
            </div>

            <div className="p-6 space-y-4">
              {createError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {createError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input
                  type="text"
                  value={newItemSku}
                  onChange={(e) => setNewItemSku(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setCreatingVariant(null)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                disabled={creatingItem}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newItemSku || !newItemDescription) {
                    setCreateError("Please provide SKU and description");
                    return;
                  }
                  setCreatingItem(true);
                  setCreateError(null);
                  try {
                    const createdItem = await createPriceListItem();
                    setPriceListItems((prev) => [...prev, createdItem]);
                    await saveMapping(creatingVariant.id, createdItem.id);
                    setCreatingVariant(null);
                  } catch (err: any) {
                    setCreateError(err.message || "Failed to create item");
                  } finally {
                    setCreatingItem(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
                disabled={creatingItem}
              >
                {creatingItem ? "Creating..." : "Create and Map"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
