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

      <div className="space-y-4">
        {filteredProducts.map((product) => (
          <div key={product.id} className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">{product.title}</h3>
            <div className="space-y-2">
              {product.variants.map((variant) => {
                const mappedItemId = mappings[variant.id.toString()];
                const mappedItem = priceListItems.find(item => item.id === mappedItemId);

                return (
                  <div key={variant.id} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">
                        {variant.title} {variant.sku && <span className="text-gray-500">({variant.sku})</span>}
                      </p>
                      <p className="text-xs text-gray-500">Price: ${variant.price}</p>
                    </div>
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
                            {(item.item_no || item.sku || "") } - {item.description}
                          </option>
                        ))}
                      </select>
                      {mappedItem && (
                        <span className="text-xs text-green-600 font-medium">✓ Mapped</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No products found. {searchQuery && "Try adjusting your search."}
        </div>
      )}
    </div>
  );
}
