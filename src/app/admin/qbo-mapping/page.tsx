"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { usePathname } from "next/navigation";

interface QboItem {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  type?: string;
}

interface PriceListItem {
  id: string;
  sku: string;
  description: string;
  shipping_included_per_unit: number;
  current_sale_price_per_unit: number;
  qbo_item_id?: string;
  qbo_item_name?: string;
}

interface MappedItem {
  qboItem: QboItem;
  priceListItem?: PriceListItem;
  isMatched: boolean;
}

const money = (v: number | undefined | null) => {
  if (v === null || v === undefined || isNaN(v)) return "0.00";
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function QboItemMappingPage() {
  const [qboItems, setQboItems] = useState<QboItem[]>([]);
  const [priceListItems, setPriceListItems] = useState<PriceListItem[]>([]);
  const [mappedItems, setMappedItems] = useState<MappedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "matched" | "unmatched">("all");
  const [editingItem, setEditingItem] = useState<MappedItem | null>(null);
  const [shippingAmount, setShippingAmount] = useState<string>("");
  const [selectedPriceListSku, setSelectedPriceListSku] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch QBO items
      const qboResponse = await fetch("/api/qbo/item");
      const qboData = await qboResponse.json();

      if (!qboData.ok) {
        throw new Error("Failed to fetch QBO items");
      }

      // Fetch price list items
      const priceListResponse = await fetch("/api/price-list");
      const priceListData = await priceListResponse.json();

      setQboItems(qboData.items || []);
      const rawItems = Array.isArray(priceListData) ? priceListData : priceListData.items || [];
      const normalizedItems: PriceListItem[] = (rawItems || []).map((p: any) => ({
        id: p.id,
        sku: p.sku || p.item_no,
        description: p.description || "",
        shipping_included_per_unit: Number(p.shipping_included_per_unit ?? p.shippingIncludedPerUnit ?? 0),
        current_sale_price_per_unit: Number(p.current_sale_price_per_unit ?? p.currentSalePricePerUnit ?? p.list_price ?? 0),
        qbo_item_id: p.qbo_item_id,
        qbo_item_name: p.qbo_item_name,
      }));
      setPriceListItems(normalizedItems);

      // Create mapped items
      const mapped: MappedItem[] = (qboData.items || []).map((qboItem: QboItem) => {
        const nameUpper = (qboItem.name || "").toUpperCase();
        const skuUpper = (qboItem.sku || qboItem.name || "").toUpperCase();
        const priceListItem = normalizedItems.find((p: PriceListItem) => {
          const pSku = (p.sku || "").toUpperCase();
          return (
            p.qbo_item_id === qboItem.id ||
            pSku === skuUpper ||
            nameUpper.includes(pSku)
          );
        });

        return {
          qboItem,
          priceListItem,
          isMatched: !!priceListItem,
        };
      });

      setMappedItems(mapped);
    } catch (error: any) {
      setStatusMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMapping = async (qboItem: QboItem, priceListSku: string, shippingAmount: number) => {
    try {
      const response = await fetch("/api/admin/update-item-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qbo_item_id: qboItem.id,
          qbo_item_name: qboItem.name,
          price_list_sku: priceListSku,
          shipping_included_per_unit: shippingAmount,
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || "Failed to save mapping");
      }

      setStatusMessage({ type: "success", text: "Mapping saved successfully!" });
      setEditingItem(null);
      loadData(); // Reload to show updated data
    } catch (error: any) {
      setStatusMessage({ type: "error", text: error.message });
    }
  };

  const openEditModal = (item: MappedItem) => {
    setEditingItem(item);
    setShippingAmount(item.priceListItem?.shipping_included_per_unit?.toString() || "0");
    setSelectedPriceListSku(item.priceListItem?.sku || "");
  };

  const filteredItems = mappedItems.filter((item) => {
    const matchesSearch = 
      item.qboItem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.qboItem.sku?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.priceListItem?.sku?.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFilter =
      filterStatus === "all" ||
      (filterStatus === "matched" && item.isMatched) ||
      (filterStatus === "unmatched" && !item.isMatched);

    return matchesSearch && matchesFilter;
  });

  const pathname = usePathname();
  const tabs: { label: string; href: string }[] = [
    { label: "Price List", href: "/admin/price-list" },
    { label: "QBO Mapping", href: "/admin/qbo-mapping" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Price List" />
        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
          {/* Chrome-style Tabs */}
          <div className="bg-slate-800 border-b border-slate-700 px-8">
            <div className="flex gap-1">
              {tabs.map((tab: { label: string; href: string }) => (
                <a
                  key={tab.href}
                  href={tab.href}
                  className={`px-6 py-3 text-sm font-medium transition relative ${
                    pathname === tab.href
                      ? "bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900 rounded-t-lg"
                      : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                  }`}
                >
                  {tab.label}
                </a>
              ))}
            </div>
          </div>

          <div className="p-8">
            <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">QuickBooks Item Mapping</h1>
              <p className="text-slate-400">
                Map QuickBooks inventory items to your price list and set shipping deductions
              </p>
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div
                className={`mb-6 p-4 rounded-lg ${
                  statusMessage.type === "success"
                    ? "bg-green-900/20 border border-green-700 text-green-300"
                    : "bg-red-900/20 border border-red-700 text-red-300"
                }`}
              >
                {statusMessage.text}
              </div>
            )}

            {/* Filters */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Search by item name, SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterStatus("all")}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    filterStatus === "all"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  All ({mappedItems.length})
                </button>
                <button
                  onClick={() => setFilterStatus("matched")}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    filterStatus === "matched"
                      ? "bg-green-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Matched ({mappedItems.filter((i) => i.isMatched).length})
                </button>
                <button
                  onClick={() => setFilterStatus("unmatched")}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    filterStatus === "unmatched"
                      ? "bg-yellow-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Unmatched ({mappedItems.filter((i) => !i.isMatched).length})
                </button>
              </div>
            </div>

            {/* Items Table */}
            {loading ? (
              <div className="text-center py-12 text-slate-400">Loading items...</div>
            ) : (
              <div className="bg-slate-900 rounded-lg shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">QBO Item</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">QBO SKU</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Price List SKU</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase">Shipping Deduction</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-300 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/50">
                          <td className="px-6 py-4">
                            {item.isMatched ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/30 text-green-300">
                                ✓ Matched
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900/30 text-yellow-300">
                                ⚠ Unmapped
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-white">{item.qboItem.name}</div>
                            <div className="text-xs text-slate-400">{item.qboItem.type}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-300">
                            {item.qboItem.sku || "—"}
                          </td>
                          <td className="px-6 py-4">
                            {item.priceListItem ? (
                              <div>
                                <div className="text-sm font-medium text-white">{item.priceListItem.sku}</div>
                                <div className="text-xs text-slate-400">{item.priceListItem.description}</div>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-500">Not mapped</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {item.priceListItem ? (
                              <span className="text-sm font-semibold text-blue-400">
                                ${money(item.priceListItem.shipping_included_per_unit)}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => openEditModal(item)}
                              className="text-sm font-semibold text-blue-400 hover:text-blue-300"
                            >
                              {item.isMatched ? "Edit" : "Map"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            </div>
          </div>
        </main>
      </div>

      {/* Edit/Map Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-2xl font-bold text-white">
                {editingItem.isMatched ? "Edit Mapping" : "Create Mapping"}
              </h2>
              <p className="text-slate-400 mt-1">
                QuickBooks Item: <span className="font-semibold text-white">{editingItem.qboItem.name}</span>
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Select Price List Item */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Map to Price List SKU
                </label>
                <select
                  value={selectedPriceListSku}
                  onChange={(e) => setSelectedPriceListSku(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select a price list item...</option>
                  {priceListItems.map((item) => (
                    <option key={item.id} value={item.sku}>
                      {item.sku} - {item.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shipping Deduction Amount */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Shipping Deduction (per unit)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={shippingAmount}
                    onChange={(e) => setShippingAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  This amount will be deducted from each unit when calculating commissions
                </p>
              </div>

              {/* Preview */}
              {selectedPriceListSku && shippingAmount && (
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Preview Calculation</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Example: 10 units @ $100/ea</span>
                      <span className="text-white">$1,000.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Shipping deduction (10 × ${shippingAmount})</span>
                      <span className="text-red-400">-${money(10 * parseFloat(shippingAmount || "0"))}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-700">
                      <span className="text-slate-300 font-semibold">Commissionable Amount</span>
                      <span className="text-green-400 font-semibold">
                        ${money(1000 - (10 * parseFloat(shippingAmount || "0")))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Commission (5%)</span>
                      <span className="text-blue-400 font-semibold">
                        ${money((1000 - (10 * parseFloat(shippingAmount || "0"))) * 0.05)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!selectedPriceListSku || !shippingAmount || !editingItem) {
                    setStatusMessage({ type: "error", text: "Please fill in all fields" });
                    return;
                  }
                  handleSaveMapping(
                    editingItem.qboItem,
                    selectedPriceListSku,
                    parseFloat(shippingAmount)
                  );
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
              >
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
