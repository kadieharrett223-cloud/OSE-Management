"use client";

import { useState, useEffect } from "react";
import React from "react";
import * as XLSX from "xlsx";
import { Sidebar } from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";

type PriceListItem = {
  id: string;
  version_tag: string;
  category_id: string | null;
  category_name?: string;
  item_no: string;
  description: string | null;
  supplier: string | null;
  // Input fields
  fob_cost: number | null;
  quantity: number | null;
  ocean_frt: number | null;
  importing: number | null;
  zone5_shipping: number | null;
  multiplier: number | null;
  // Derived fields (computed by DB)
  tariff_105: number | null;
  per_unit: number | null;
  cost_with_shipping: number | null;
  sell_price: number | null;
  rounded_normal_price: number | null;
  list_price: number | null;
  black_friday_price: number | null;
  rounded_sale_price: number | null;
};

type Category = {
  id: string;
  category_name: string;
  display_order: number;
};

const money = (v: number | null) => {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

async function bufferFromFile(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File read failed"));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("Unexpected result"));
    };
    reader.readAsArrayBuffer(file);
  });
}

export default function AdminPriceListPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<PriceListItem | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [discountPercentage, setDiscountPercentage] = useState<number>(20); // Default 20% off
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<PriceListItem>>({
    version_tag: "v1",
    item_no: "",
    description: "",
    category_id: "",
    fob_cost: null,
    ocean_frt: null,
    importing: null,
    zone5_shipping: null,
    multiplier: 1,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load categories
      const { data: cats, error: catError } = await supabase
        .from("price_list_categories")
        .select("*")
        .order("display_order");
      
      if (catError) throw catError;

      // Load price list items with category names
      const { data: priceItems, error: itemError } = await supabase
        .from("price_list_items")
        .select(`
          *,
          price_list_categories!inner(category_name)
        `)
        .eq("is_active", true);

      if (itemError) throw itemError;

      setCategories(cats || []);
      
      // Flatten the joined data - explicitly destructure to avoid nested object issues
      const flatItems = (priceItems || []).map((item: any) => {
        const { price_list_categories, ...itemData } = item;
        return {
          ...itemData,
          category_name: price_list_categories?.category_name
        };
      });
      
      setItems(flatItems);
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setStatus(null);
    try {
      const buffer = await bufferFromFile(file);
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      setStatus(`Imported ${json.length} row(s) from Excel.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingItem) return;
    
    setIsLoading(true);
    setStatus(null);
    try {
      const { error } = await supabase
        .from("price_list_items")
        .update({
          description: editingItem.description,
          fob_cost: editingItem.fob_cost,
          ocean_frt: editingItem.ocean_frt,
          importing: editingItem.importing,
          zone5_shipping: editingItem.zone5_shipping,
          multiplier: editingItem.multiplier,
        })
        .eq("id", editingItem.id);
      
      if (error) throw error;
      
      setStatus("✓ Item saved successfully.");
      setEditingId(null);
      setEditingItem(null);
      await loadData(); // Reload to get computed values
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Client-side calculation matching database trigger
  const computeDerivedFields = (item: PriceListItem): PriceListItem => {
    const fob_cost = item.fob_cost || 0;
    const ocean_frt = item.ocean_frt || 0;
    const importing = item.importing || 0;
    const zone5_shipping = item.zone5_shipping || 0;
    const multiplier = item.multiplier || 1;

    // 1) tariff_105 = fob_cost * 2
    const tariff_105 = fob_cost * 2;
    
    // 2) per_unit = tariff_105 + ocean_frt + importing
    const per_unit = tariff_105 + ocean_frt + importing;
    
    // 3) cost_with_shipping = per_unit + zone5_shipping
    const cost_with_shipping = per_unit + zone5_shipping;
    
    // 4) base_price = cost_with_shipping * multiplier
    const base_price = cost_with_shipping * multiplier;
    
    // 5) list_price = floor(base_price / 5) * 5 (this is the fixed retail price)
    const list_price = Math.floor(base_price / 5) * 5;
    
    // 6) sell_price = list_price * (1 - discount/100)
    // If list price is $1000 and discount is 20%, sell price = $1000 * 0.8 = $800
    const discount = discountPercentage || 20;
    const sell_price = list_price * (1 - discount / 100);
    
    // Keep rounded_normal_price for compatibility (same as sell_price now)
    const rounded_normal_price = sell_price;
    
    // 7) black_friday_price = list_price * 0.75
    const black_friday_price = list_price * 0.75;
    
    // 8) rounded_sale_price = floor(black_friday_price / 100) * 100 - 1
    const rounded_sale_price = Math.floor(black_friday_price / 100) * 100 - 1;

    return {
      ...item,
      tariff_105,
      per_unit,
      cost_with_shipping,
      sell_price,
      rounded_normal_price,
      list_price,
      black_friday_price,
      rounded_sale_price,
    };
  };

  const updateEditingItem = (field: keyof PriceListItem, value: string | number | null) => {
    if (!editingItem) return;
    const updated = { ...editingItem, [field]: value };
    // Recompute derived fields
    const withDerived = computeDerivedFields(updated);
    setEditingItem(withDerived);
  };

  const startEditing = (item: PriceListItem) => {
    setEditingId(item.id);
    setEditingItem({ ...item }); // Create a copy
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingItem(null);
  };

  const handleAddProduct = async () => {
    if (!newProduct.item_no || !newProduct.category_id) {
      setStatus("❌ Item No and Category are required");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("price_list_items")
        .insert([{
          version_tag: newProduct.version_tag || "v1",
          item_no: newProduct.item_no,
          description: newProduct.description || null,
          category_id: newProduct.category_id,
          fob_cost: newProduct.fob_cost,
          ocean_frt: newProduct.ocean_frt,
          importing: newProduct.importing,
          zone5_shipping: newProduct.zone5_shipping,
          multiplier: newProduct.multiplier || 1,
          is_active: true
        }])
        .select();

      if (error) throw error;

      setStatus("✓ Product added successfully!");
      setShowAddModal(false);
      setNewProduct({
        version_tag: "v1",
        item_no: "",
        description: "",
        category_id: "",
        fob_cost: null,
        ocean_frt: null,
        importing: null,
        zone5_shipping: null,
        multiplier: 1,
      });
      await loadData();
    } catch (error: any) {
      console.error("Error adding product:", error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Delete this product from the price list?")) return;
    setIsLoading(true);
    setStatus(null);
    try {
      const { error } = await supabase
        .from("price_list_items")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;

      setStatus("✓ Product deleted (soft delete)");
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Filter items by search query
  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.item_no.toLowerCase().includes(query) ||
      (item.description?.toLowerCase() || "").includes(query)
    );
  });

  // Group items by category and apply discount calculations
  const itemsByCategory = categories.map((cat) => ({
    category: cat,
    items: filteredItems
      .filter((item) => item.category_id === cat.id)
      .map((item) => computeDerivedFields(item)),
  })).filter(({ items }) => items.length > 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Price List" />

        {/* Main Content */}
        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
          <div className="mx-auto px-8 py-10 space-y-6">
            {/* Header */}
            <header className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-blue-700">Admin</p>
                <h1 className="mt-1 text-3xl font-semibold text-slate-900">Price List Management</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  Manage SKU pricing and shipping deductions. Input fields in <span className="text-blue-600 font-medium">blue</span>, computed fields auto-update.
                </p>
                
                {/* Search Bar */}
                <div className="mt-4 flex items-center gap-4">
                  <input
                    type="text"
                    placeholder="Search by Item No or Description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      type="button"
                    >
                      Clear
                    </button>
                  )}
                  
                  {/* Discount Percentage Control */}
                  <div className="flex items-center gap-2 ml-auto">
                    <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                      Discount:
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                      className="w-16 rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-sm text-slate-900 text-right font-semibold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    />
                    <span className="text-sm font-semibold text-emerald-700">% off</span>
                  </div>
                </div>
              </div>

              {/* Add Product Button */}
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md transition-colors flex items-center gap-2"
                type="button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Product
              </button>
            </header>

            {/* Status */}
            {status && (
              <div className={`rounded-lg px-4 py-3 text-sm ${status.includes("✓") ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200" : "bg-red-50 text-red-900 ring-1 ring-red-200"}`}>
                {status}
              </div>
            )}

            {isLoading && items.length === 0 ? (
              <div className="rounded-2xl bg-white p-12 shadow-md ring-1 ring-slate-200 text-center">
                <p className="text-slate-600">Loading price list...</p>
              </div>
            ) : (
              <>
                {/* Price List by Category */}
                {itemsByCategory.map(({ category, items: categoryItems }) => (
                  <section key={category.id} className="rounded-2xl bg-white shadow-md ring-1 ring-slate-200">
                    {/* Category Header */}
                    <div className="border-b-2 border-blue-600 bg-blue-50 px-6 py-3">
                      <h2 className="text-lg font-bold text-blue-900 uppercase tracking-wide">
                        {category.category_name}
                      </h2>
                    </div>

                    {/* Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full divide-y divide-slate-100 text-xs border-collapse table-fixed">
                        <colgroup>
                          <col style={{ width: "75px" }} />
                          <col style={{ width: "140px" }} />
                          <col style={{ width: "60px" }} />
                          <col style={{ width: "60px" }} />
                          <col style={{ width: "60px" }} />
                          <col style={{ width: "65px" }} />
                          <col style={{ width: "55px" }} />
                          <col style={{ width: "60px" }} />
                          <col style={{ width: "60px" }} />
                          <col style={{ width: "65px" }} />
                          <col style={{ width: "60px" }} />
                          <col style={{ width: "60px" }} />
                          <col style={{ width: "85px" }} />
                        </colgroup>
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="pl-3 pr-0.5 py-2 text-left font-semibold text-slate-600 whitespace-nowrap sticky left-0 bg-slate-50 z-10">Item No</th>
                            <th className="pl-0.5 pr-1.5 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">Description</th>
                            <th className="px-2 py-2 text-right font-semibold text-blue-600 whitespace-nowrap">FOB Cost</th>
                            <th className="px-2 py-2 text-right font-semibold text-blue-600 whitespace-nowrap">Ocean Frt</th>
                            <th className="px-2 py-2 text-right font-semibold text-blue-600 whitespace-nowrap">Importing</th>
                            <th className="px-2 py-2 text-right font-semibold text-amber-700 whitespace-nowrap">Shipping</th>
                            <th className="px-2 py-2 text-right font-semibold text-blue-600 whitespace-nowrap">Multiplier</th>
                            <th className="px-2 py-2 text-right font-semibold text-slate-500 whitespace-nowrap">Tariff 105%</th>
                            <th className="px-2 py-2 text-right font-semibold text-slate-500 whitespace-nowrap">Per Unit</th>
                            <th className="px-2 py-2 text-right font-semibold text-slate-500 whitespace-nowrap">Cost w/ Ship</th>
                            <th className="px-2 py-2 text-right font-semibold text-slate-500 whitespace-nowrap">Sell Price</th>
                            <th className="px-2 py-2 text-right font-semibold text-slate-500 whitespace-nowrap">List Price</th>
                            <th className="px-1 py-2 text-center font-semibold text-slate-600 whitespace-nowrap sticky right-0 bg-slate-50 z-10">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryItems.map((item, index) => {
                            const isEditing = editingId === item.id;
                            const displayItem = isEditing && editingItem ? editingItem : item;
                            
                            return (
                            <tr key={item.id} className={isEditing ? "bg-blue-50/70 border-l-4 border-l-blue-500" : "hover:bg-slate-50"}>
                              {/* Item No */}
                              <td className="pl-3 pr-0.5 py-1.5 sticky left-0 bg-inherit z-10">
                                <span className="font-mono text-xs font-medium text-slate-900 whitespace-nowrap">{item.item_no}</span>
                              </td>
                              
                              {/* Description */}
                              <td className="pl-0.5 pr-1.5 py-1.5 truncate max-w-[140px]" title={item.description || ""}>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={displayItem.description || ""}
                                    onChange={(e) => updateEditingItem("description", e.target.value)}
                                    className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-700 font-medium bg-white"
                                  />
                                ) : (
                                  <span className="text-slate-600">{item.description || "—"}</span>
                                )}
                              </td>

                              {/* FOB Cost (INPUT) */}
                              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={displayItem.fob_cost !== null && displayItem.fob_cost !== undefined ? displayItem.fob_cost : ""}
                                    onChange={(e) => updateEditingItem("fob_cost", e.target.value === "" ? null : Number(e.target.value))}
                                    className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-right text-xs font-medium text-slate-700 bg-white tabular-nums"
                                  />
                                ) : (
                                  <span className="text-blue-900">${money(item.fob_cost)}</span>
                                )}
                              </td>

                              {/* Ocean Freight (INPUT) */}
                              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={displayItem.ocean_frt !== null && displayItem.ocean_frt !== undefined ? displayItem.ocean_frt : ""}
                                    onChange={(e) => updateEditingItem("ocean_frt", e.target.value === "" ? null : Number(e.target.value))}
                                    className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-right text-xs text-slate-700 bg-white tabular-nums"
                                  />
                                ) : (
                                  <span className="text-blue-900">${money(item.ocean_frt)}</span>
                                )}
                              </td>

                              {/* Importing (INPUT) */}
                              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={displayItem.importing !== null && displayItem.importing !== undefined ? displayItem.importing : ""}
                                    onChange={(e) => updateEditingItem("importing", e.target.value === "" ? null : Number(e.target.value))}
                                    className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-right text-xs text-slate-700 bg-white tabular-nums"
                                  />
                                ) : (
                                  <span className="text-blue-900">${money(item.importing)}</span>
                                )}
                              </td>

                              {/* Shipping (INPUT - CRITICAL) */}
                              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={displayItem.zone5_shipping !== null && displayItem.zone5_shipping !== undefined ? displayItem.zone5_shipping : ""}
                                    onChange={(e) => updateEditingItem("zone5_shipping", e.target.value === "" ? null : Number(e.target.value))}
                                    className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-right text-xs font-medium text-slate-700 bg-white tabular-nums"
                                  />
                                ) : (
                                  <span className="font-semibold text-amber-700">${money(item.zone5_shipping)}</span>
                                )}
                              </td>

                              {/* Multiplier (INPUT) */}
                              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={displayItem.multiplier !== null && displayItem.multiplier !== undefined ? displayItem.multiplier : ""}
                                    onChange={(e) => updateEditingItem("multiplier", e.target.value === "" ? null : Number(e.target.value))}
                                    className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-right text-xs text-slate-700 bg-white tabular-nums"
                                  />
                                ) : (
                                  <span className="text-blue-900">{item.multiplier ?? "—"}</span>
                                )}
                              </td>

                              {/* Tariff 105% (DERIVED) */}
                              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                                <span className={isEditing ? "text-slate-300 text-xs" : "text-slate-500 text-xs"}>${money(displayItem.tariff_105)}</span>
                              </td>

                              {/* Per Unit (DERIVED) */}
                              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                                <span className={isEditing ? "text-slate-300 text-xs" : "text-slate-500 text-xs"}>${money(displayItem.per_unit)}</span>
                              </td>

                              {/* Cost with Shipping (DERIVED) */}
                              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                                <span className={isEditing ? "text-slate-300 text-xs" : "text-slate-500 text-xs"}>${money(displayItem.cost_with_shipping)}</span>
                              </td>

                              {/* Sell Price (DERIVED) */}
                              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                                <span className={isEditing ? "text-slate-300 text-xs" : "text-slate-500 text-xs"}>${money(displayItem.sell_price)}</span>
                              </td>

                              {/* List Price (DERIVED) */}
                              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                                <span className={isEditing ? "text-slate-300 text-xs" : "text-slate-500 text-xs"}>${money(displayItem.list_price)}</span>
                              </td>

                              {/* Action */}
                              <td className="px-1 py-1.5 text-center whitespace-nowrap sticky right-0 bg-inherit z-10">
                                {isEditing ? (
                                  <div className="flex gap-1 justify-center items-center">
                                    <button
                                      onClick={handleSave}
                                      disabled={isLoading}
                                      className="px-2 py-1 text-xs font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                      type="button"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={cancelEditing}
                                      disabled={isLoading}
                                      className="px-2 py-1 text-xs font-semibold text-slate-600 bg-transparent hover:bg-slate-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                      type="button"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1 justify-center items-center">
                                    <button
                                      onClick={() => startEditing(item)}
                                      className="px-2 py-1 text-xs font-medium text-blue-600 bg-transparent hover:bg-blue-50 rounded"
                                      type="button"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteProduct(item.id)}
                                      disabled={isLoading}
                                      className="px-2 py-1 text-xs font-semibold text-red-600 bg-transparent hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                      type="button"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );})}
                          {categoryItems.length === 0 && (
                            <tr>
                              <td colSpan={13} className="px-6 py-4 text-center text-xs text-slate-600">
                                No items in this category
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </>
            )}

            {/* Documentation */}
            <section className="rounded-2xl bg-blue-50 p-6 ring-1 ring-blue-200">
              <h3 className="font-semibold text-blue-900">💡 Price List Notes</h3>
              <ul className="mt-3 space-y-2 text-sm text-blue-800">
                <li>
                  <strong className="text-blue-600">Input fields (blue)</strong>: FOB Cost, Ocean Freight, Importing, Zone 5 Shipping, Multiplier
                </li>
                <li>
                  <strong className="text-amber-700">Shipping (amber)</strong>: Critical for commission deductions
                </li>
                <li>
                  <strong className="text-emerald-700">Sale Price (green)</strong>: Auto-computed, used as sale price per unit for commissions
                </li>
                <li>
                  All derived fields (Per Unit, Sell Price, etc.) are auto-computed by the database
                </li>
              </ul>
            </section>
          </div>
        </main>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Add New Product</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
                type="button"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-6 space-y-4">
              {/* Item No */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Item No <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={newProduct.item_no || ""}
                  onChange={(e) => setNewProduct({ ...newProduct, item_no: e.target.value })}
                  placeholder="e.g., 2PBP-12"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Category <span className="text-red-600">*</span>
                </label>
                <select
                  value={newProduct.category_id || ""}
                  onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                >
                  <option value="">Select a category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newProduct.description || ""}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  placeholder="Product description"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              {/* Input Fields Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* FOB Cost */}
                <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">FOB Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.fob_cost ?? ""}
                    onChange={(e) => setNewProduct({ ...newProduct, fob_cost: e.target.value ? Number(e.target.value) : null })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>

                {/* Ocean Freight */}
                <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Ocean Freight</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.ocean_frt ?? ""}
                    onChange={(e) => setNewProduct({ ...newProduct, ocean_frt: e.target.value ? Number(e.target.value) : null })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>

                {/* Importing */}
                <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Importing</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.importing ?? ""}
                    onChange={(e) => setNewProduct({ ...newProduct, importing: e.target.value ? Number(e.target.value) : null })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>

                {/* Zone 5 Shipping */}
                <div>
                  <label className="block text-sm font-semibold text-amber-700 mb-1">Shipping</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.zone5_shipping ?? ""}
                    onChange={(e) => setNewProduct({ ...newProduct, zone5_shipping: e.target.value ? Number(e.target.value) : null })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-amber-400 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
                  />
                </div>

                {/* Multiplier */}
                <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Multiplier</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.multiplier ?? 1}
                    onChange={(e) => setNewProduct({ ...newProduct, multiplier: e.target.value ? Number(e.target.value) : 1 })}
                    placeholder="1.0"
                    className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProduct}
                disabled={isLoading || !newProduct.item_no || !newProduct.category_id}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                type="button"
              >
                {isLoading ? "Adding..." : "Add Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
