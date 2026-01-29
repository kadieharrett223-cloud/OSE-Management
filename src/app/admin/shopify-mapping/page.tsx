"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

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

interface PriceListItem {
  id: string;
  item_no: string;
  description: string;
  list_price: number;
  shopify_variant_id: string | null;
}

export default function ShopifyMappingPage() {
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([]);
  const [priceListItems, setPriceListItems] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // Load Shopify products
      const shopifyRes = await fetch("/api/shopify/products");
      if (!shopifyRes.ok) {
        const errorData = await shopifyRes.json();
        throw new Error(errorData.error || `Shopify API error: ${shopifyRes.status}`);
      }
      const shopifyData = await shopifyRes.json();
      setShopifyProducts(shopifyData.products || []);

      // Load price list items
      const priceRes = await fetch("/api/price-list");
      if (!priceRes.ok) {
        const errorData = await priceRes.json();
        throw new Error(errorData.error || `Price list error: ${priceRes.status}`);
      }
      const priceData = await priceRes.json();
      setPriceListItems(priceData.items || []);
      
      // Build existing mappings
      const existingMappings: Record<string, string> = {};
      priceData.items?.forEach((item: PriceListItem) => {
        if (item.shopify_variant_id) {
          existingMappings[item.shopify_variant_id] = item.id;
        }
      });
      setMappings(existingMappings);
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

      // Update local state
      const newMappings = { ...mappings };
      if (priceListItemId) {
        newMappings[variantId.toString()] = priceListItemId;
      } else {
        delete newMappings[variantId.toString()];
      }
      setMappings(newMappings);
    } catch (error) {
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
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p className="text-gray-600">Loading Shopify products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-md rounded-lg border border-red-300 bg-red-50 p-6">
          <h2 className="text-xl font-semibold text-red-900 mb-3">Error Loading Products</h2>
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Shopify Product Mapping</h1>
            <Link
              href="/admin/price-list"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Back to Price List
            </Link>
          </div>
          <p className="text-gray-600">
            Map Shopify products to price list items for automatic price syncing
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search Shopify products or SKUs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Products List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Shopify Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Variant/SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Current Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Mapped To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((product) =>
                  product.variants.map((variant) => {
                    const mappedItemId = mappings[variant.id.toString()];
                    const mappedItem = priceListItems.find(i => i.id === mappedItemId);

                    return (
                      <tr key={variant.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900 max-w-md truncate">
                            {product.title}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{variant.title}</div>
                          {variant.sku && (
                            <div className="text-xs text-gray-500">SKU: {variant.sku}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">${variant.price}</div>
                        </td>
                        <td className="px-6 py-4">
                          {mappedItem ? (
                            <div>
                              <div className="text-sm font-medium text-green-600">
                                {mappedItem.item_no}
                              </div>
                              <div className="text-xs text-gray-500">
                                {mappedItem.description}
                              </div>
                              <div className="text-xs text-gray-500">
                                List: ${mappedItem.list_price.toFixed(2)}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400">Not mapped</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={mappedItemId || ""}
                            onChange={(e) => saveMapping(variant.id, e.target.value || null)}
                            disabled={saving}
                            className="text-sm border border-gray-300 rounded px-3 py-1 focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">-- Select Item --</option>
                            {priceListItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.item_no} - {item.description}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? "No products found matching your search" : "No Shopify products found"}
          </div>
        )}
      </div>
    </div>
  );
}
