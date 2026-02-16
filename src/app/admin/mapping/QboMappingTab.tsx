"use client";

import { useState, useEffect } from "react";

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

export default function QboMappingTab() {
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
  const [createNewItem, setCreateNewItem] = useState(false);
  const [newItemSku, setNewItemSku] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const qboResponse = await fetch("/api/qbo/item");
      const qboData = await qboResponse.json();

      if (!qboData.ok) {
        throw new Error("Failed to fetch QBO items");
      }

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
      loadData();
    } catch (error: any) {
      setStatusMessage({ type: "error", text: error.message });
    }
  };

  const openEditModal = (item: MappedItem) => {
    setEditingItem(item);
    setShippingAmount(item.priceListItem?.shipping_included_per_unit?.toString() || "0");
    setSelectedPriceListSku(item.priceListItem?.sku || "");
    setCreateNewItem(false);
    setNewItemSku("");
    setNewItemDescription("");
  };

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

    return data.item as { sku: string };
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

  if (loading) {
    return <div className="p-6 text-center text-gray-600">Loading QBO items...</div>;
  }

  return (
    <div className="p-6">
      {statusMessage && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            statusMessage.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by item name, SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${
              filterStatus === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            All ({mappedItems.length})
          </button>
          <button
            onClick={() => setFilterStatus("matched")}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${
              filterStatus === "matched"
                ? "bg-green-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Matched ({mappedItems.filter((i) => i.isMatched).length})
          </button>
          <button
            onClick={() => setFilterStatus("unmatched")}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${
              filterStatus === "unmatched"
                ? "bg-yellow-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Unmatched ({mappedItems.filter((i) => !i.isMatched).length})
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">QBO Item</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">QBO SKU</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Price List SKU</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Shipping Deduction</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredItems.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {item.isMatched ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Matched
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      ⚠ Unmapped
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">{item.qboItem.name}</div>
                  <div className="text-xs text-gray-500">{item.qboItem.type}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {item.qboItem.sku || "—"}
                </td>
                <td className="px-4 py-3">
                  {item.priceListItem ? (
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.priceListItem.sku}</div>
                      <div className="text-xs text-gray-500">{item.priceListItem.description}</div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Not mapped</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {item.priceListItem ? (
                    <span className="text-sm font-semibold text-blue-600">
                      ${money(item.priceListItem.shipping_included_per_unit)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => openEditModal(item)}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    {item.isMatched ? "Edit" : "Map"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit/Map Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingItem.isMatched ? "Edit Mapping" : "Create Mapping"}
              </h2>
              <p className="text-gray-600 mt-1">
                QuickBooks Item: <span className="font-semibold">{editingItem.qboItem.name}</span>
              </p>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Map to Price List SKU
                </label>
                <select
                  value={selectedPriceListSku}
                  onChange={(e) => setSelectedPriceListSku(e.target.value)}
                  disabled={createNewItem}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select a price list item...</option>
                  {priceListItems.map((item) => (
                    <option key={item.id} value={item.sku}>
                      {item.sku} - {item.description}
                    </option>
                  ))}
                </select>
                <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={createNewItem}
                    onChange={(e) => setCreateNewItem(e.target.checked)}
                  />
                  Create a new price list item
                </label>
              </div>

              {createNewItem && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      New SKU
                    </label>
                    <input
                      type="text"
                      value={newItemSku}
                      onChange={(e) => setNewItemSku(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="SKU"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={newItemDescription}
                      onChange={(e) => setNewItemDescription(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="Description"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Shipping Deduction (per unit)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={shippingAmount}
                    onChange={(e) => setShippingAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  This amount will be deducted from each unit when calculating commissions
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editingItem || !shippingAmount) {
                    setStatusMessage({ type: "error", text: "Please fill in all fields" });
                    return;
                  }

                  if (createNewItem) {
                    if (!newItemSku || !newItemDescription) {
                      setStatusMessage({ type: "error", text: "Please provide SKU and description" });
                      return;
                    }
                    setIsSaving(true);
                    createPriceListItem()
                      .then((item) =>
                        handleSaveMapping(
                          editingItem.qboItem,
                          item.sku || newItemSku,
                          parseFloat(shippingAmount)
                        )
                      )
                      .catch((error: any) => {
                        setStatusMessage({ type: "error", text: error.message || "Failed to save mapping" });
                      })
                      .finally(() => setIsSaving(false));
                    return;
                  }

                  if (!selectedPriceListSku) {
                    setStatusMessage({ type: "error", text: "Please select a price list item" });
                    return;
                  }

                  setIsSaving(true);
                  handleSaveMapping(
                    editingItem.qboItem,
                    selectedPriceListSku,
                    parseFloat(shippingAmount)
                  ).finally(() => setIsSaving(false));
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Mapping"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
