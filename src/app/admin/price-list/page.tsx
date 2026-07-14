"use client";

import { useState, useEffect } from "react";
import React from "react";
import * as XLSX from "xlsx";
import { Sidebar } from "@/components/Sidebar";
import { PriceCalculator } from "@/components/PriceCalculator";
import { supabase } from "@/lib/supabase";

import { canonicalizeRep } from "@/lib/repAliases";

type PriceListItem = {
  id: string;
  version_tag: string;
  category_id: string | null;
  category_name?: string;
  item_no: string;
  description: string | null;
  supplier: string | null;
  weight_lbs: number | null;
  // Input fields
  fob_cost: number | null;
  quantity: number | null;
  ocean_frt: number | null;
  importing: number | null;
  indirect_labor: number | null;
  direct_labor: number | null;
  overhead_cost: number | null;
  zone5_shipping: number | null;
  margin: number | null; // Margin as decimal (e.g., 0.2296 for 22.96%)
  manual_pricing_override: boolean; // Allow manual control of pricing calculations
  tariff_exempt: boolean; // Skip tariff calculation for items exempt from tariffs
  // Derived fields (computed by DB)
  tariff_105: number | null;
  per_unit: number | null;
  cost_with_shipping: number | null;
  sell_price: number | null;
  rounded_normal_price: number | null;
  list_price: number | null;
  black_friday_price: number | null;
  rounded_sale_price: number | null;
  profit: number | null;
  // Derived helpers (not persisted)
  ocean_per_unit?: number | null;
  importing_per_unit?: number | null;
  display_order: number | null;
  shopify_variant_id?: string | null;
  website_product_url?: string | null;
};

type Category = {
  id: string;
  category_name: string;
  display_order: number;
  tariff_exempt?: boolean;
};

type ShopifySyncPreviewItem = {
  item_no: string;
  base_price: number | null;
  compare_at_price: number | null;
};

type WebsiteSyncPreviewItem = {
  id: string;
  item_no: string;
  local_sell_price: number;
  local_list_price: number;
  website_sell_price: number | null;
  website_compare_at_price: number | null;
};

type MockPOLine = {
  id: string;
  itemId: string;
  searchText: string;
  quantity: number;
};

type BulkAdjustField = "fob_cost" | "zone5_shipping" | "list_price";
type BulkAdjustOperation = "add" | "subtract";

const money = (v: number | null) => {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const PRICE_LIST_ORDER: string[] = [
  "2PBP-8",
  "2PCF-9",
  "2PBP-10",
  "2PBPXW-10",
  "2PCFXL-10",
  "2PDDA-10",
  "2PBP-12",
  "2PCFHD-12",
  "2PCFHD-15",
  "4PTA-3",
  "4PTA-6",
  "4PTA-4.5",
  "8PTA",
  "2PFC",
  "4PML-9",
  "HDMBL-9",
  "4PHR-9x",
  "HDMBL-10",
  "4PXL-10",
  "4PXLA-10",
  "4PXL-10B",
  "4PXW-10",
  "4PHDXLA-11",
  "4PHDXL-12",
  "4PHDXLA-12",
  "4PHDXLA-14",
  "4PHDXLA-15",
  "4032XL",
  "4032-6",
  "4032S",
  "4PHDXL-22",
  "4PHDXLA-22",
  "4PHDXL-27",
  "4PHDXLA-27",
  "4PHDXL-33",
  "4PHDXLA-33",
  "HLCJ-6",
  "FBCJ-6",
  "JVCJ-6",
  "HLCJ-14/ YZRCJ-7",
  "HR-10",
  "4PRJ-9",
  "4PHDA-RJ",
  "4PTT",
  "4PJT",
  "FBAR-2",
  "YZXL-10RJT",
  "ALT-11-15",
  "SSALT-11-15",
  "4PDT",
  "ML-8APLFM",
  "FB-9PLFM",
  "HR-10PLFM",
  "XW-10PLFM",
  "4032PLFM",
  "4PCA",
  "MRSL-6",
  "MRSL-75",
  "FRSL-78",
  "T999-E",
  "T650",
  "T620",
  "MCA-1",
  "W820",
  "W810",
  "W690",
  "AS800",
  "A9800",
  "ACB-1",
  "R-45",
  "R-30",
  "RT-1",
  "HDML-15",
  "MCWC-16198",
  "HDML J",
  "HDML-J",
  "BNDL-POF15",
  "BNDL-POF11",
  "BNDL-PA14",
  "BNDL-VA15",
  "APU-1",
  "UHS-5075",
  "UHJS-750",
  "OD-A30",
  "OD-7170",
  "OD-3198A",
  "OD-3198",
  "TJ-1102 / TJ-707",
  "TJ-1101A / TJ2718",
  "Hi Strength Epoxy",
  "AW-32",
  "HPU220-4",
  "HPU220",
  "HPU110",
];

const PRICE_LIST_ORDER_MAP = new Map(
  PRICE_LIST_ORDER.map((sku, index) => [sku.toLowerCase(), index])
);

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

type PrintColKey =
  | "item_no" | "description" | "supplier" | "fob_cost" | "quantity"
  | "tariff_105" | "ocean_frt" | "importing" | "indirect_labor" | "direct_labor" | "overhead_cost" | "zone5_shipping"
  | "cost_with_shipping" | "margin" | "sell_price" | "list_price"
  | "profit" | "weight_lbs";

const ALL_PRINT_COLUMNS: { key: PrintColKey; label: string; num: boolean }[] = [
  { key: "item_no",           label: "Item No",       num: false },
  { key: "description",      label: "Description",   num: false },
  { key: "supplier",         label: "Supplier",      num: false },
  { key: "fob_cost",         label: "FOB Cost",      num: true  },
  { key: "quantity",         label: "Qty",           num: true  },
  { key: "tariff_105",       label: "Tariff",        num: true  },
  { key: "ocean_frt",        label: "Ocean/Unit",    num: true  },
  { key: "importing",        label: "Import/Unit",   num: true  },
  { key: "indirect_labor",   label: "Indirect",      num: true  },
  { key: "direct_labor",     label: "Direct",        num: true  },
  { key: "overhead_cost",    label: "Overhead",      num: true  },
  { key: "zone5_shipping",   label: "Shipping",      num: true  },
  { key: "cost_with_shipping",label: "Cost+Ship",    num: true  },
  { key: "margin",           label: "Margin",        num: true  },
  { key: "sell_price",       label: "Sell Price",    num: true  },
  { key: "list_price",       label: "List Price",    num: true  },
  { key: "profit",           label: "Profit",        num: true  },
  { key: "weight_lbs",       label: "Wt (lbs)",      num: true  },
];

const DEFAULT_PRINT_COLS = new Set<PrintColKey>(ALL_PRINT_COLUMNS.map((c) => c.key));

export default function AdminPriceListPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<PriceListItem | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [discountPercentage, setDiscountPercentage] = useState<number>(20); // Default 20% off list
  const [globalTariffPercent, setGlobalTariffPercent] = useState<number>(100);
  const [globalTariffInput, setGlobalTariffInput] = useState<string>("100");
  const [isSavingTariff, setIsSavingTariff] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [showGroupFilters, setShowGroupFilters] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [showSupplierFilters, setShowSupplierFilters] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [isShopifySyncing, setIsShopifySyncing] = useState(false);
  const [isShopifyPreviewLoading, setIsShopifyPreviewLoading] = useState(false);
  const [showShopifyPreviewModal, setShowShopifyPreviewModal] = useState(false);
  const [shopifyPreviewItems, setShopifyPreviewItems] = useState<ShopifySyncPreviewItem[]>([]);
  const [isWebsiteSyncing, setIsWebsiteSyncing] = useState(false);
  const [isWebsitePreviewLoading, setIsWebsitePreviewLoading] = useState(false);
  const [showWebsiteSyncModal, setShowWebsiteSyncModal] = useState(false);
  const [websiteSyncPreviewItems, setWebsiteSyncPreviewItems] = useState<WebsiteSyncPreviewItem[]>([]);
  const [isAutoMappingWebsite, setIsAutoMappingWebsite] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printCols, setPrintCols] = useState<Set<PrintColKey>>(new Set(DEFAULT_PRINT_COLS));
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [mockPoALines, setMockPoALines] = useState<MockPOLine[]>([]);
  const [mockPoBLines, setMockPoBLines] = useState<MockPOLine[]>([]);
  const [mockPoACostMode, setMockPoACostMode] = useState<"fob" | "delivered">("fob");
  const [mockPoBCostMode, setMockPoBCostMode] = useState<"fob" | "delivered">("fob");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [bulkAdjustField, setBulkAdjustField] = useState<BulkAdjustField>("zone5_shipping");
  const [bulkAdjustOperation, setBulkAdjustOperation] = useState<BulkAdjustOperation>("add");
  const [bulkAdjustAmount, setBulkAdjustAmount] = useState<string>("");
  const [isApplyingBulkAdjust, setIsApplyingBulkAdjust] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<PriceListItem>>({
    version_tag: "v1",
    item_no: "",
    description: "",
    supplier: "",
    category_id: "",
    fob_cost: null,
    quantity: null,
    ocean_frt: null,
    importing: null,
    indirect_labor: null,
    direct_labor: null,
    overhead_cost: null,
    zone5_shipping: null,
    margin: 0,
    tariff_exempt: false,
  });

  // Save discount to localStorage when changed
  const updateDiscount = (value: number) => {
    setDiscountPercentage(value);
    localStorage.setItem("priceListDiscount", value.toString());
  };

  const categoryNameById = new Map(categories.map((cat) => [cat.id, cat.category_name]));
  const applyDiscountToAll = selectedGroups.length === 0;

  const getDiscountForCategoryId = (categoryId: string | null) => {
    if (applyDiscountToAll) return discountPercentage;
    const name = categoryId ? categoryNameById.get(categoryId) : undefined;
    if (!name) return 0;
    return selectedGroups.includes(name) ? discountPercentage : 0;
  };

  useEffect(() => {
    loadData();
    // Load discount from localStorage on mount
    const saved = localStorage.getItem("priceListDiscount");
    if (saved) {
      setDiscountPercentage(Number(saved));
    } else {
      setDiscountPercentage(20);
      localStorage.setItem("priceListDiscount", "20");
    }
  }, []);

  useEffect(() => {
    const syncTariffSetting = async () => {
      try {
        const settingsRes = await fetch("/api/pricing/settings", { cache: "no-store" });
        if (!settingsRes.ok) return;
        const settingsPayload = await settingsRes.json();
        const tariff = Number(settingsPayload?.settings?.global_tariff_percent ?? 100);
        if (!Number.isFinite(tariff)) return;
        setGlobalTariffPercent((prev) => (prev === tariff ? prev : tariff));
        if (!isSavingTariff) {
          setGlobalTariffInput(String(tariff));
        }
      } catch {
        // Keep current values on transient sync errors.
      }
    };

    const interval = setInterval(syncTariffSetting, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        syncTariffSetting();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isSavingTariff]);

  // Recompute items when discount percentage or global tariff changes
  useEffect(() => {
    if (items.length > 0) {
      const recomputedItems = items.map((item) =>
        computeDerivedFields(item, getDiscountForCategoryId(item.category_id))
      );
      setItems(recomputedItems);
    }
  }, [discountPercentage, globalTariffPercent]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const settingsRes = await fetch("/api/pricing/settings");
      if (settingsRes.ok) {
        const settingsPayload = await settingsRes.json();
        const tariff = Number(settingsPayload?.settings?.global_tariff_percent ?? 100);
        setGlobalTariffPercent(tariff);
        setGlobalTariffInput(String(tariff));
      }

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
        .eq("is_active", true)
        .order("display_order", { ascending: true, nullsFirst: false });

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
          item_no: editingItem.item_no,
          description: editingItem.description,
          supplier: editingItem.supplier,
          fob_cost: editingItem.fob_cost,
          quantity: editingItem.quantity,
          tariff_105: editingItem.tariff_105,
          ocean_frt: editingItem.ocean_frt,
          importing: editingItem.importing,
          indirect_labor: editingItem.indirect_labor,
          direct_labor: editingItem.direct_labor,
          overhead_cost: editingItem.overhead_cost,
          zone5_shipping: editingItem.zone5_shipping,
          margin: editingItem.margin,
          weight_lbs: editingItem.weight_lbs,
          manual_pricing_override: editingItem.manual_pricing_override,
          tariff_exempt: editingItem.tariff_exempt,
          shopify_variant_id: editingItem.shopify_variant_id || null,
          website_product_url: editingItem.website_product_url || null,
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

  // Client-side calculation follows DB formulas and global tariff setting.
  const computeDerivedFields = (item: PriceListItem, discountOverride?: number): PriceListItem => {
    const fob_cost = item.fob_cost || 0;
    const quantity = item.quantity || 0;
    const zone5_shipping = item.zone5_shipping || 0;
    const indirect_labor = item.indirect_labor || 0;
    const direct_labor = item.direct_labor || 0;
    const overhead_cost = item.overhead_cost || 0;
    const margin = item.margin || 0;
    const tariffMultiplier = 1 + globalTariffPercent / 100;
    const isTariffExempt = item.tariff_exempt === true;

    // Check if manual override is enabled
    const isManualOverride = item.manual_pricing_override === true;

    // Calculate or preserve tariff/ocean/import based on override flag and tariff exempt flag
    let tariff_105: number;
    let ocean_per_unit: number;
    let importing_per_unit: number;

    if (isTariffExempt) {
      // Tariff exempt: no tariff, ocean, or importing charges
      tariff_105 = 0;
      ocean_per_unit = 0;
      importing_per_unit = 0;
    } else if (isManualOverride) {
      // Manual override mode: use the user-entered values as-is
      tariff_105 = item.tariff_105 || 0;
      ocean_per_unit = item.ocean_frt || 0;
      importing_per_unit = item.importing || 0;
    } else {
      // Auto-calculate mode: use standard formulas
      tariff_105 = fob_cost * tariffMultiplier;
      ocean_per_unit = quantity > 0 ? 8000 / quantity : (item.ocean_frt || 0);
      importing_per_unit = quantity > 0 ? 2100 / quantity : (item.importing || 0);
    }

    // 2) Per unit: Tariff + Ocean per-unit + Importing per-unit
    const per_unit = (isTariffExempt ? fob_cost : tariff_105) + ocean_per_unit + importing_per_unit;

    // 3) Final cost with shipping: Per unit + Zone 5
    const cost_with_shipping = per_unit + zone5_shipping + indirect_labor + direct_labor + overhead_cost;

    // 4) Sell price: Final × (1 + Markup)
    const sell_price = cost_with_shipping * (1 + margin);

    // 5) List price: Sell price / 0.80 (20% off list = sell price)
    const list_price = sell_price / 0.8;

    // 6) Profit: Sell price - Final cost
    const profit = sell_price - cost_with_shipping;

    const appliedDiscount = discountOverride ?? discountPercentage;

    // 7) Final customer price after discount
    const rounded_sale_price = list_price * (1 - (appliedDiscount || 0) / 100);

    // Preserve legacy fields for compatibility.
    const rounded_normal_price = rounded_sale_price;
    const black_friday_price = list_price * 0.75;
    const discounted_sale_price = rounded_sale_price;

    return {
      ...item,
      tariff_105,
      ocean_frt: ocean_per_unit,
      importing: importing_per_unit,
      indirect_labor,
      direct_labor,
      overhead_cost,
      ocean_per_unit,
      importing_per_unit,
      per_unit,
      cost_with_shipping,
      sell_price,
      rounded_normal_price,
      list_price,
      black_friday_price,
      rounded_sale_price,
      profit,
    };
  };

  const handleSaveGlobalTariff = async () => {
    const parsed = Number(globalTariffInput);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 500) {
      setStatus("Tariff % must be a number between 0 and 500.");
      return;
    }

    // Support both input styles:
    // - Percent: 25 => 25%
    // - Multiplier: 1.25 => 25%
    const normalizedTariffPercent = parsed >= 1 && parsed <= 3
      ? (parsed - 1) * 100
      : parsed;

    setIsSavingTariff(true);
    setStatus(null);
    try {
      const response = await fetch("/api/pricing/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ global_tariff_percent: normalizedTariffPercent }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update tariff setting");
      }

      setGlobalTariffPercent(normalizedTariffPercent);
      setGlobalTariffInput(String(Number(normalizedTariffPercent.toFixed(4))));
      setStatus("✓ Global tariff updated and non-manual products recalculated.");
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update tariff setting");
    } finally {
      setIsSavingTariff(false);
    }
  };

  const updateEditingItem = (field: keyof PriceListItem, value: string | number | null) => {
    if (!editingItem) return;
    const updated = { ...editingItem, [field]: value === null || value === "" ? null : Number(value) } as PriceListItem;
    const discount = getDiscountForCategoryId(updated.category_id);
    const withDerived = computeDerivedFields(updated, discount);
    setEditingItem(withDerived);
  };

  const startEditing = (item: PriceListItem) => {
    setEditingId(item.id);
    setEditingItem({ ...item }); // Create a copy
    setShowCalculator(false); // Close calculator when starting to edit
  };

  const createMockLine = (itemId: string, defaultQty: number, searchText = ""): MockPOLine => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemId,
    searchText,
    quantity: defaultQty > 0 ? defaultQty : 1,
  });

  const openCompareModal = () => {
    const firstItem = items[0];
    const secondItem = items[1] || items[0];

    setMockPoACostMode("fob");
    setMockPoBCostMode("fob");

    if (mockPoALines.length === 0 && firstItem) {
      setMockPoALines([
        createMockLine(firstItem.id, Number(firstItem.quantity || 1), firstItem.item_no),
      ]);
    }

    if (mockPoBLines.length === 0 && secondItem) {
      setMockPoBLines([
        createMockLine(secondItem.id, Number(secondItem.quantity || 1), secondItem.item_no),
      ]);
    }

    setShowCompareModal(true);
  };

  const updateMockLine = (
    side: "A" | "B",
    lineId: string,
    updates: Partial<MockPOLine>
  ) => {
    const updater = (lines: MockPOLine[]) =>
      lines.map((line) => (line.id === lineId ? { ...line, ...updates } : line));

    if (side === "A") setMockPoALines(updater);
    else setMockPoBLines(updater);
  };

  const addMockLine = (side: "A" | "B") => {
    const baseItems = items;
    if (baseItems.length === 0) return;

    const firstItem = baseItems[0];
    const newLine = createMockLine(firstItem.id, Number(firstItem.quantity || 1), firstItem.item_no);

    if (side === "A") setMockPoALines((prev) => [...prev, newLine]);
    else setMockPoBLines((prev) => [...prev, newLine]);
  };

  const removeMockLine = (side: "A" | "B", lineId: string) => {
    if (side === "A") {
      setMockPoALines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== lineId) : prev));
    } else {
      setMockPoBLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== lineId) : prev));
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingItem(null);
    setShowCalculator(false); // Close calculator when canceling
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
          supplier: newProduct.supplier || null,
          category_id: newProduct.category_id,
          fob_cost: newProduct.fob_cost,
          quantity: newProduct.quantity,
          ocean_frt: newProduct.quantity ? null : newProduct.ocean_frt,
          importing: newProduct.quantity ? null : newProduct.importing,
          indirect_labor: newProduct.indirect_labor,
          direct_labor: newProduct.direct_labor,
          overhead_cost: newProduct.overhead_cost,
          zone5_shipping: newProduct.zone5_shipping,
          margin: newProduct.margin || 0,
          tariff_exempt: newProduct.tariff_exempt || false,
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
        supplier: "",
        category_id: "",
        fob_cost: null,
        quantity: null,
        ocean_frt: null,
        importing: null,
        indirect_labor: null,
        direct_labor: null,
        overhead_cost: null,
        zone5_shipping: null,
        margin: 0,
        tariff_exempt: false,
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

  const handleOpenShopifyPreview = async () => {
    setIsShopifyPreviewLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/shopify/sync", { method: "GET" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load Shopify preview");
      }

      setShopifyPreviewItems((data?.preview || []) as ShopifySyncPreviewItem[]);
      setShowShopifyPreviewModal(true);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load Shopify preview");
    } finally {
      setIsShopifyPreviewLoading(false);
    }
  };

  const handleConfirmShopifyPush = async () => {
    setIsShopifySyncing(true);
    setStatus(null);

    try {
      const response = await fetch("/api/shopify/sync", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to sync Shopify prices");
      }

      setStatus(`✓ Shopify sync complete. Updated: ${data.success ?? 0}, Failed: ${data.failed ?? 0}, Skipped: ${data.skipped ?? 0}`);
      setShowShopifyPreviewModal(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to sync Shopify prices");
    } finally {
      setIsShopifySyncing(false);
    }
  };

  const handleAutoMapWebsiteBySku = async () => {
    setIsAutoMappingWebsite(true);
    setStatus(null);

    try {
      const response = await fetch("/api/shopify/auto-map-by-sku", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to auto-map website products by SKU");
      }

      setStatus(
        `✓ Website mapping complete. Mapped: ${data.mapped ?? 0}, No match: ${data.skipped_no_match ?? 0}, Ambiguous: ${data.skipped_ambiguous ?? 0}`
      );
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to auto-map website products by SKU");
    } finally {
      setIsAutoMappingWebsite(false);
    }
  };

  const handleOpenWebsiteSyncPreview = async () => {
    setIsWebsitePreviewLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/shopify/sync-from-website", { method: "GET" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load website price preview");
      }

      setWebsiteSyncPreviewItems((data?.preview || []) as WebsiteSyncPreviewItem[]);
      setShowWebsiteSyncModal(true);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load website price preview");
    } finally {
      setIsWebsitePreviewLoading(false);
    }
  };

  const handleConfirmWebsitePull = async () => {
    setIsWebsiteSyncing(true);
    setStatus(null);

    try {
      const response = await fetch("/api/shopify/sync-from-website", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to sync website prices into price list");
      }

      setStatus(
        `✓ Website price sync complete. Updated: ${data.updated ?? 0}, Skipped: ${data.skipped ?? 0}, Failed: ${data.failed ?? 0}`
      );
      setShowWebsiteSyncModal(false);
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to sync website prices into price list");
    } finally {
      setIsWebsiteSyncing(false);
    }
  };

  const handlePrintReport = (selectedCols: Set<PrintColKey> = printCols) => {
    const printDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const activeCols = ALL_PRINT_COLUMNS.filter((c) => selectedCols.has(c.key));

    // Build filtered items grouped by category using current UI filters
    const filteredCategories = [...categories]
      .filter((cat) => applyDiscountToAll || selectedGroups.includes(cat.category_name))
      .map((cat) => {
        const catItems = filteredItems
          .filter((item) => item.category_id === cat.id)
          .map((item) => computeDerivedFields(item, getDiscountForCategoryId(item.category_id)))
          .sort((a, b) => Number(a.sell_price || 0) - Number(b.sell_price || 0));
        return { category: cat, items: catItems };
      })
      .filter(({ items: ci }) => ci.length > 0)
      .sort((a, b) => (a.category.display_order ?? 0) - (b.category.display_order ?? 0));

    const fmt = (v: number | null | undefined) =>
      v == null ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const getCellHtml = (item: PriceListItem, key: PrintColKey) => {
      switch (key) {
        case "item_no":
          return `<td class="mono">${item.item_no}</td>`;
        case "description":
          return `<td>${item.description || "—"}</td>`;
        case "supplier":
          return `<td>${item.supplier || "—"}</td>`;
        case "fob_cost":
          return `<td class="num">$${fmt(item.fob_cost)}</td>`;
        case "quantity":
          return `<td class="num">${item.quantity ?? "—"}</td>`;
        case "tariff_105":
          return `<td class="num">$${fmt(item.tariff_105)}</td>`;
        case "ocean_frt":
          return `<td class="num">$${fmt(item.ocean_frt)}</td>`;
        case "importing":
          return `<td class="num">$${fmt(item.importing)}</td>`;
        case "indirect_labor":
          return `<td class="num">$${fmt(item.indirect_labor)}</td>`;
        case "direct_labor":
          return `<td class="num">$${fmt(item.direct_labor)}</td>`;
        case "overhead_cost":
          return `<td class="num">$${fmt(item.overhead_cost)}</td>`;
        case "zone5_shipping":
          return `<td class="num">$${fmt(item.zone5_shipping)}</td>`;
        case "cost_with_shipping":
          return `<td class="num">$${fmt(item.cost_with_shipping)}</td>`;
        case "margin":
          return `<td class="num">${item.margin != null ? (item.margin * 100).toFixed(2) + "%" : "—"}</td>`;
        case "sell_price":
          return `<td class="num bold">$${fmt(item.sell_price)}</td>`;
        case "list_price":
          return `<td class="num">$${fmt(item.list_price)}</td>`;
        case "profit":
          return `<td class="num profit">$${fmt(item.profit)}</td>`;
        case "weight_lbs":
          return `<td class="num">${item.weight_lbs ?? "—"}</td>`;
        default:
          return "<td></td>";
      }
    };

    const tableRows = filteredCategories
      .map(
        ({ category, items: ci }) => `
          <tr class="cat-header">
            <td colspan="${activeCols.length}">${category.category_name}</td>
          </tr>
          ${ci
            .map(
              (item) => `
            <tr>
              ${activeCols.map((col) => getCellHtml(item, col.key)).join("")}
            </tr>`
            )
            .join("")}`
      )
      .join("");

    const headerCells = activeCols
      .map((col) => `<th${col.num ? ' class="num"' : ""}>${col.label}</th>`)
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Price List Report — ${printDate}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #1e293b; background: #fff; }
    .report-header { padding: 16px 20px 10px; border-bottom: 2px solid #2563eb; display: flex; justify-content: space-between; align-items: flex-end; }
    .report-header h1 { font-size: 16pt; font-weight: 700; color: #1e3a8a; }
    .report-header .meta { font-size: 7.5pt; color: #475569; text-align: right; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #1e3a8a; color: #fff; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 4px 5px; text-align: left; }
    th.num, td.num { text-align: right; }
    td { padding: 3px 5px; border-bottom: 1px solid #e2e8f0; font-size: 7.5pt; vertical-align: middle; }
    tr:nth-child(even) td { background: #f8fafc; }
    tr.cat-header td { background: #dbeafe; color: #1e40af; font-weight: 700; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.05em; padding: 5px 6px; border-top: 2pt solid #2563eb; border-bottom: 1pt solid #93c5fd; }
    td.mono { font-family: 'Courier New', monospace; font-weight: 600; }
    td.bold { font-weight: 700; color: #0f172a; }
    td.profit { color: #15803d; font-weight: 600; }
    .footer { margin-top: 14px; font-size: 7pt; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: portrait; margin: 8mm 6mm; }
      table { font-size: 6.5pt; }
      th, td { padding: 2px 3px; }
      tr.cat-header { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div>
      <h1>Price List Cost Report</h1>
      <div style="font-size:8pt;color:#475569;margin-top:4px;">Tariff Rate: ${globalTariffPercent}% &nbsp;|&nbsp; Discount: ${discountPercentage}% off list</div>
      ${searchQuery.trim() ? `<div style="font-size:8pt;color:#475569;margin-top:2px;">Search filter: ${searchQuery.trim()}</div>` : ""}
    </div>
    <div class="meta">
      Generated: ${printDate}<br/>
      Total products: ${filteredItems.length}
    </div>
  </div>
  <table>
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">OSE Management &mdash; Confidential &mdash; ${printDate}</div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) {
      alert("Pop-up blocked. Please allow pop-ups for this site and try again.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportCSV = () => {
    const allCategories = [...categories]
      .map((cat) => {
        const catItems = items
          .filter((item) => item.category_id === cat.id)
          .map((item) => computeDerivedFields(item, getDiscountForCategoryId(item.category_id)))
          .sort((a, b) => Number(a.sell_price || 0) - Number(b.sell_price || 0));
        return { category: cat, items: catItems };
      })
      .filter(({ items: ci }) => ci.length > 0)
      .sort((a, b) => (a.category.display_order ?? 0) - (b.category.display_order ?? 0));

    const escape = (v: string | number | null | undefined) => {
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const fmt = (v: number | null | undefined) =>
      v == null ? "" : v.toFixed(2);

    const headers = [
      "Category","Item No","Description","Supplier",
      "FOB Cost","Qty","Tariff","Ocean/Unit","Import/Unit",
      "Indirect Labor","Direct Labor","Overhead Cost","Zone5 Shipping","Cost+Ship","Margin %","Sell Price",
      "List Price","Profit","Weight (lbs)",
    ];

    const rows: string[][] = [headers];

    allCategories.forEach(({ category, items: ci }) => {
      ci.forEach((item) => {
        rows.push([
          escape(category.category_name),
          escape(item.item_no),
          escape(item.description),
          escape(item.supplier),
          fmt(item.fob_cost),
          item.quantity != null ? String(item.quantity) : "",
          fmt(item.tariff_105),
          fmt(item.ocean_frt),
          fmt(item.importing),
          fmt(item.indirect_labor),
          fmt(item.direct_labor),
          fmt(item.overhead_cost),
          fmt(item.zone5_shipping),
          fmt(item.cost_with_shipping),
          item.margin != null ? (item.margin * 100).toFixed(2) : "",
          fmt(item.sell_price),
          fmt(item.list_price),
          fmt(item.profit),
          item.weight_lbs != null ? String(item.weight_lbs) : "",
        ]);
      });
    });

    const csv = rows.map((r) => r.join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `price-list-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter items by search query and supplier
  const filteredItems = items.filter((item) => {
    const matchesSearch = !searchQuery || (
      item.item_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    );
    
    const matchesSupplier = selectedSuppliers.length === 0 || 
      (item.supplier && selectedSuppliers.includes(canonicalizeRep(item.supplier)));
    
    return matchesSearch && matchesSupplier;
  });

  const comparableItems = items
    .map((item) => computeDerivedFields(item, getDiscountForCategoryId(item.category_id)))
    .sort((a, b) => a.item_no.localeCompare(b.item_no));

  const comparableItemsById = new Map(comparableItems.map((item) => [item.id, item]));

  const findComparableBySearch = (searchText: string) => {
    const term = searchText.trim().toLowerCase();
    if (!term) return null;

    return (
      comparableItems.find((item) => item.item_no.toLowerCase() === term) ||
      comparableItems.find((item) => item.item_no.toLowerCase().startsWith(term)) ||
      comparableItems.find((item) => (item.description || "").toLowerCase().includes(term)) ||
      null
    );
  };

  const updateMockLineSearch = (side: "A" | "B", lineId: string, searchText: string) => {
    const lines = side === "A" ? mockPoALines : mockPoBLines;
    const current = lines.find((line) => line.id === lineId);
    if (!current) return;

    const match = findComparableBySearch(searchText);

    updateMockLine(side, lineId, {
      searchText,
      itemId: match ? match.id : "",
      quantity: match ? Number(match.quantity || current.quantity || 1) : current.quantity,
    });
  };

  const buildMockLineTotals = (line: MockPOLine, costMode: "fob" | "delivered") => {
    const item = comparableItemsById.get(line.itemId) || null;
    const qty = Number(line.quantity || 0);

    if (!item) {
      return {
        line,
        item: null,
        qty,
        lineOutTheDoorCost: 0,
      };
    }

    const costPerUnit = costMode === "fob" ? Number(item.fob_cost || 0) : Number(item.per_unit || 0);

    return {
      line,
      item,
      qty,
      lineOutTheDoorCost: costPerUnit * qty,
    };
  };

  const mockPoAComputed = mockPoALines.map((line) => buildMockLineTotals(line, mockPoACostMode));
  const mockPoBComputed = mockPoBLines.map((line) => buildMockLineTotals(line, mockPoBCostMode));

  const summarizeMockPo = (rows: ReturnType<typeof buildMockLineTotals>[]) =>
    rows.reduce(
      (acc, row) => ({
        totalQty: acc.totalQty + row.qty,
        totalOutTheDoorCost: acc.totalOutTheDoorCost + row.lineOutTheDoorCost,
      }),
      {
        totalQty: 0,
        totalOutTheDoorCost: 0,
      }
    );

  const totalsA = summarizeMockPo(mockPoAComputed);
  const totalsB = summarizeMockPo(mockPoBComputed);

  const comparisonDiff = {
    outTheDoorPerUnit:
      (totalsB.totalQty > 0 ? totalsB.totalOutTheDoorCost / totalsB.totalQty : 0) -
      (totalsA.totalQty > 0 ? totalsA.totalOutTheDoorCost / totalsA.totalQty : 0),
    outTheDoorTotal: totalsB.totalOutTheDoorCost - totalsA.totalOutTheDoorCost,
  };

  // Get unique suppliers for filter dropdown (canonicalized)
  const uniqueSuppliers = Array.from(
    new Set(items.filter((item) => item.supplier).map((item) => canonicalizeRep(item.supplier!)))
  ).sort();

  // Group items by category, apply calculations, sort items by sell price within each group
  const itemsByCategory = [...categories]
    .filter((cat) => applyDiscountToAll || selectedGroups.includes(cat.category_name))
    .map((cat) => {
      const derivedItems = filteredItems
        .filter((item) => item.category_id === cat.id)
        .map((item) => computeDerivedFields(item, getDiscountForCategoryId(item.category_id)))
        .sort((a, b) => {
          // Sort by sell price within each category (lowest to highest)
          const priceA = Number(a.sell_price || 0);
          const priceB = Number(b.sell_price || 0);
          return priceA - priceB;
        });

      return {
        category: cat,
        items: derivedItems,
      };
    })
    .filter(({ items }) => items.length > 0)
    .sort((a, b) => (a.category.display_order ?? 0) - (b.category.display_order ?? 0))
    .map(({ category, items }) => ({ category, items }));

  const visibleItemIds = itemsByCategory.flatMap(({ items: categoryItems }) => categoryItems.map((item) => item.id));
  const selectedVisibleCount = visibleItemIds.filter((id) => selectedItemIds.has(id)).length;

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      const allVisibleSelected = visibleItemIds.length > 0 && visibleItemIds.every((id) => next.has(id));

      if (allVisibleSelected) {
        visibleItemIds.forEach((id) => next.delete(id));
      } else {
        visibleItemIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  const handleApplyBulkAdjust = async () => {
    const amount = Number(bulkAdjustAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus("Enter a valid amount greater than 0 for bulk adjust.");
      return;
    }

    if (selectedItemIds.size === 0) {
      setStatus("Select at least one item for bulk adjust.");
      return;
    }

    setIsApplyingBulkAdjust(true);
    setStatus(null);
    try {
      const res = await fetch("/api/price-list/bulk-adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIds: Array.from(selectedItemIds),
          field: bulkAdjustField,
          operation: bulkAdjustOperation,
          amount,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Bulk adjust failed");
      }

      setStatus(`✓ Bulk update complete. Updated ${Number(data.updatedCount || 0)} item(s).`);
      setSelectedItemIds(new Set());
      setBulkAdjustAmount("");
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Bulk adjust failed.");
    } finally {
      setIsApplyingBulkAdjust(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Price List" />

        {/* Main Content */}
        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900 hide-scrollbar overflow-x-hidden">

            <div className="mx-auto px-8 py-10 space-y-6">
            {/* Header */}
            <header className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-blue-700">Admin</p>
                <h1 className="mt-1 text-3xl font-semibold text-slate-900">Price List Management</h1>
            {/* Guide Modal */}
            {showGuide && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                    <h2 className="text-lg font-semibold text-slate-900">Price List Guide</h2>
                    <button
                      onClick={() => setShowGuide(false)}
                      className="text-slate-400 hover:text-slate-600"
                      type="button"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="max-h-[75vh] overflow-y-auto px-6 py-6">
                    <div className="rounded-2xl bg-blue-50 p-6 ring-1 ring-blue-200">
                      <h3 className="font-semibold text-blue-900">Price List Guide</h3>
                      <div className="mt-3 text-sm text-blue-800 space-y-2">
                        <p><span className="font-semibold">Manual inputs:</span> FOB cost, quantity (container capacity), shipping, markup %, optional list price.</p>
                        <p><span className="font-semibold">Constants:</span> Tariff rate = {globalTariffPercent}%, Ocean freight = 8000 per container, Importing = 2100 per container.</p>
                        <div className="rounded-xl bg-white/80 p-4 ring-1 ring-blue-200/70 text-xs text-blue-900 space-y-1">
                          <div>Tariff = FOB × (1 + Tariff%/100)</div>
                          <div>Ocean per unit = 8000 ÷ Quantity</div>
                          <div>Importing per unit = 2100 ÷ Quantity</div>
                          <div>Cost (no shipping) = Tariff + Ocean + Importing</div>
                          <div>Final cost = Cost + Shipping</div>
                          <div>Sell price = Final cost × (1 + Markup%/100)</div>
                          <div>List price = Sell price ÷ 0.80 (always 20% off list)</div>
                          <div>Profit = Sell price − Final cost</div>
                        </div>
                        <p className="text-xs text-blue-700">Discount field sets the % off list price (default 20%).</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                      Tariff:
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="500"
                      step="0.01"
                      value={globalTariffInput}
                      onChange={(e) => setGlobalTariffInput(e.target.value)}
                      className="w-20 rounded-lg border border-blue-300 bg-white px-2 py-1.5 text-sm text-slate-900 text-right font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    />
                    <span className="text-sm font-semibold text-blue-700">%</span>
                    <button
                      type="button"
                      onClick={handleSaveGlobalTariff}
                      disabled={isSavingTariff}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSavingTariff ? "Saving..." : "Save Tariff"}
                    </button>

                    <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                      Discount:
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={discountPercentage}
                      onChange={(e) => updateDiscount(Number(e.target.value))}
                      className="w-16 rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-sm text-slate-900 text-right font-semibold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    />
                    <span className="text-sm font-semibold text-emerald-700">% off</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Tariff input supports <strong>25</strong> (percent) or <strong>1.25</strong> (1.25x multiplier).
                </p>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowGroupFilters((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100"
                  >
                    Filter groups
                    <span className="text-[10px] text-slate-500">{showGroupFilters ? "▲" : "▼"}</span>
                  </button>
                  {selectedGroups.length > 0 && (
                    <span className="ml-2 text-xs text-slate-500">Discount applies only to selected groups.</span>
                  )}

                  {showGroupFilters && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedGroups([])}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          selectedGroups.length === 0
                            ? "border-blue-500 bg-blue-600 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        All groups
                      </button>
                      {categories.map((cat) => {
                        const isSelected = selectedGroups.includes(cat.category_name);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setSelectedGroups((prev) =>
                                isSelected
                                  ? prev.filter((name) => name !== cat.category_name)
                                  : [...prev, cat.category_name]
                              );
                            }}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                              isSelected
                                ? "border-blue-500 bg-blue-600 text-white"
                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {cat.category_name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowSupplierFilters((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100"
                  >
                    Filter suppliers
                    <span className="text-[10px] text-slate-500">{showSupplierFilters ? "▲" : "▼"}</span>
                  </button>
                  {selectedSuppliers.length > 0 && (
                    <span className="ml-2 text-xs text-slate-500">{selectedSuppliers.length} supplier(s) selected.</span>
                  )}

                  {showSupplierFilters && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSuppliers([])}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          selectedSuppliers.length === 0
                            ? "border-blue-500 bg-blue-600 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        All suppliers
                      </button>
                      {uniqueSuppliers.map((supplier) => {
                        const isSelected = selectedSuppliers.includes(supplier);
                        return (
                          <button
                            key={supplier}
                            type="button"
                            onClick={() => {
                              setSelectedSuppliers((prev) =>
                                isSelected
                                  ? prev.filter((name) => name !== supplier)
                                  : [...prev, supplier]
                              );
                            }}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                              isSelected
                                ? "border-blue-500 bg-blue-600 text-white"
                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {supplier}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
                  type="button"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Report
                </button>
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
                  type="button"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  Export CSV
                </button>
                <button
                  onClick={() => setShowGuide(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
                  type="button"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                    i
                  </span>
                  Guide
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                  type="button"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Product
                </button>
                <button
                  onClick={handleAutoMapWebsiteBySku}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  disabled={isAutoMappingWebsite}
                >
                  {isAutoMappingWebsite ? "Mapping..." : "Auto-Map Website by SKU"}
                </button>
                <button
                  onClick={handleOpenWebsiteSyncPreview}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  disabled={isWebsitePreviewLoading}
                >
                  {isWebsitePreviewLoading ? "Loading..." : "Match Prices From Website"}
                </button>
                <button
                  onClick={handleOpenShopifyPreview}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  disabled={isShopifyPreviewLoading}
                >
                  {isShopifyPreviewLoading ? "Loading..." : "Push Prices To Website"}
                </button>
              </div>
            </header>

            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bulk Price Adjust</p>
                  <p className="text-xs text-slate-500">Select items below, then add/subtract a fixed amount.</p>
                </div>
                <button
                  type="button"
                  onClick={toggleSelectAllVisible}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {visibleItemIds.length > 0 && selectedVisibleCount === visibleItemIds.length ? "Unselect visible" : "Select visible"}
                </button>
                <span className="text-xs text-slate-600">{selectedItemIds.size} selected</span>

                <select
                  value={bulkAdjustField}
                  onChange={(e) => setBulkAdjustField(e.target.value as BulkAdjustField)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <option value="zone5_shipping">Shipping</option>
                  <option value="fob_cost">FOB Cost</option>
                  <option value="list_price">List Price</option>
                </select>

                <select
                  value={bulkAdjustOperation}
                  onChange={(e) => setBulkAdjustOperation(e.target.value as BulkAdjustOperation)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <option value="add">Add</option>
                  <option value="subtract">Subtract</option>
                </select>

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={bulkAdjustAmount}
                  onChange={(e) => setBulkAdjustAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
                />

                <button
                  type="button"
                  onClick={handleApplyBulkAdjust}
                  disabled={isApplyingBulkAdjust || selectedItemIds.size === 0}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isApplyingBulkAdjust ? "Applying..." : "Apply Bulk Adjust"}
                </button>
              </div>
            </div>

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
                {/* Mobile Notice */}
                <div className="block md:hidden mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-xs text-amber-800">
                  <span className="font-semibold">Mobile view:</span> Some columns are hidden for better visibility. Use desktop for full details.
                </div>

                {/* Price List by Category */}
                {itemsByCategory.map(({ category, items: categoryItems }) => (
                  <section key={category.id} className="rounded-2xl bg-white shadow-md ring-1 ring-slate-200">
                    {/* Category Header */}
                    <div className="border-b-2 border-blue-600 bg-blue-50 px-6 py-3">
                      <h2 className="text-lg font-bold text-blue-900 uppercase tracking-wide">
                        {category.category_name}
                      </h2>
                    </div>

                    {/* Items Table - Desktop View */}
                    <div className="hidden md:block w-full">
                      <table className="w-full divide-y divide-slate-100 text-xs border-collapse">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-1 py-2 text-center font-semibold text-slate-600 whitespace-nowrap">Select</th>
                            <th className="pl-2 pr-1 py-2 text-left font-semibold text-slate-600 whitespace-nowrap sticky left-0 bg-slate-50 z-10">Item No</th>
                            <th className="px-1 py-2 text-left font-semibold text-slate-600 whitespace-nowrap text-xs">Description</th>
                            <th className="px-1 py-2 text-right font-semibold text-slate-600 whitespace-nowrap">Supplier</th>
                            <th className="px-1 py-2 text-right font-semibold text-blue-600 whitespace-nowrap">FOB Cost</th>
                            <th className="px-1 py-2 text-right font-semibold text-blue-600 whitespace-nowrap">Qty</th>
                            <th className="px-1 py-2 text-right font-semibold text-slate-500 whitespace-nowrap">Tariff</th>
                            <th className="px-1 py-2 text-right font-semibold text-blue-600 whitespace-nowrap">Ocean</th>
                            <th className="px-1 py-2 text-right font-semibold text-blue-600 whitespace-nowrap">Import</th>
                            <th className="px-1 py-2 text-right font-semibold text-blue-600 whitespace-nowrap">Indirect</th>
                            <th className="px-1 py-2 text-right font-semibold text-blue-600 whitespace-nowrap">Direct</th>
                            <th className="px-1 py-2 text-right font-semibold text-blue-600 whitespace-nowrap">Overhead</th>
                            <th className="px-1 py-2 text-right font-semibold text-amber-700 whitespace-nowrap">Shipping</th>
                            <th className="px-1 py-2 text-right font-semibold text-slate-500 whitespace-nowrap">Cost+Ship</th>
                            <th className="px-1 py-2 text-right font-semibold text-blue-600 whitespace-nowrap">Margin</th>
                            <th className="px-1 py-2 text-right font-semibold text-slate-500 whitespace-nowrap">Sell</th>
                            <th className="px-1 py-2 text-right font-semibold text-slate-500 whitespace-nowrap">List</th>
                            <th className="px-1 py-2 text-right font-semibold text-emerald-700 whitespace-nowrap">Profit</th>
                            <th className="px-1 py-2 text-right font-semibold text-orange-600 whitespace-nowrap text-xs">Weight</th>
                            <th className="px-1 py-2 text-center font-semibold text-slate-600 whitespace-nowrap sticky right-0 bg-slate-50 z-10">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryItems.map((item, index) => {
                            const isEditing = editingId === item.id;
                            const displayItem = isEditing && editingItem ? editingItem : item;
                            
                            return (
                            <React.Fragment key={item.id}>
                            <tr className={isEditing ? "bg-blue-50/70 border-l-4 border-l-blue-500" : "hover:bg-slate-50"}>
                              <td className="px-1 py-1 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedItemIds.has(item.id)}
                                  onChange={() => toggleItemSelection(item.id)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                              </td>
                              {/* Item No (INPUT) */}
                              <td className="pl-2 pr-0.5 py-1 sticky left-0 bg-inherit z-10">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={displayItem.item_no || ""}
                                    onChange={(e) => setEditingItem((prev) => prev ? ({ ...prev, item_no: e.target.value }) : prev)}
                                    className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-xs font-mono font-medium text-slate-900 bg-white"
                                  />
                                ) : (
                                  <span className="font-mono text-xs font-medium text-slate-900 whitespace-nowrap">{item.item_no}</span>
                                )}
                              </td>

                              {/* Description (INPUT) */}
                              <td className="px-1 py-1 text-left">
                                {isEditing ? (
                                  <div className="space-y-1">
                                    <input
                                      type="text"
                                      value={displayItem.description || ""}
                                      onChange={(e) => setEditingItem((prev) => prev ? ({ ...prev, description: e.target.value }) : prev)}
                                      className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-xs font-medium text-slate-700 bg-white"
                                      placeholder="Description"
                                    />
                                    <input
                                      type="text"
                                      value={displayItem.shopify_variant_id || ""}
                                      onChange={(e) => setEditingItem((prev) => prev ? ({ ...prev, shopify_variant_id: e.target.value || null }) : prev)}
                                      className="w-full rounded border border-indigo-300 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 bg-white"
                                      placeholder="Website Variant ID"
                                    />
                                    <input
                                      type="url"
                                      value={displayItem.website_product_url || ""}
                                      onChange={(e) => setEditingItem((prev) => prev ? ({ ...prev, website_product_url: e.target.value || null }) : prev)}
                                      className="w-full rounded border border-indigo-300 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 bg-white"
                                      placeholder="Website Product URL"
                                    />
                                  </div>
                                ) : (
                                  <div className="space-y-0.5">
                                    <span className="block text-slate-700 text-xs">
                                      {item.description && item.description.length > 20
                                        ? item.description.slice(0, 20) + "..."
                                        : item.description || "—"}
                                    </span>
                                    {item.website_product_url ? (
                                      <a
                                        href={item.website_product_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block text-[11px] font-medium text-indigo-700 hover:text-indigo-900"
                                      >
                                        Website Link
                                      </a>
                                    ) : null}
                                    {item.shopify_variant_id ? (
                                      <span className="block text-[10px] text-slate-500">Variant: {item.shopify_variant_id}</span>
                                    ) : null}
                                  </div>
                                )}
                              </td>

                              {/* Supplier (INPUT) */}
                              <td className="px-1 py-1 text-left">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={displayItem.supplier || ""}
                                    onChange={(e) => setEditingItem((prev) => prev ? ({ ...prev, supplier: e.target.value || null }) : prev)}
                                    className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-xs font-medium text-slate-700 bg-white"
                                  />
                                ) : (
                                  <span className="text-slate-600 text-xs">{item.supplier || "—"}</span>
                                )}
                              </td>

                              {/* FOB Cost (INPUT) */}
                              <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={displayItem.fob_cost !== null && displayItem.fob_cost !== undefined ? displayItem.fob_cost : ""}
                                    onChange={(e) => updateEditingItem("fob_cost", e.target.value === "" ? null : Number(e.target.value))}
                                    className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-right text-xs font-medium text-slate-700 bg-white tabular-nums"
                                  />
                                ) : (
                                  <span className="text-blue-900 font-semibold">${money(item.fob_cost)}</span>
                                )}
                              </td>

                              {/* Quantity (INPUT) */}
                              <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="1"
                                    value={displayItem.quantity !== null && displayItem.quantity !== undefined ? displayItem.quantity : ""}
                                    onChange={(e) => updateEditingItem("quantity", e.target.value === "" ? null : Number(e.target.value))}
                                    disabled={displayItem.manual_pricing_override}
                                    className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-right text-xs font-medium text-slate-700 bg-white tabular-nums disabled:bg-slate-100 disabled:text-slate-500"
                                    title={displayItem.manual_pricing_override ? "Disabled when manual override is on" : ""}
                                  />
                                ) : (
                                  <span className="text-blue-900">{item.quantity ?? "—"}</span>
                                )}
                              </td>

                              {/* Tariff +105% (INPUT/READ-ONLY) */}
                              <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={displayItem.tariff_105 !== null && displayItem.tariff_105 !== undefined ? displayItem.tariff_105 : ""}
                                    onChange={(e) => updateEditingItem("tariff_105", e.target.value === "" ? null : Number(e.target.value))}
                                    disabled={!displayItem.manual_pricing_override}
                                    className={`w-full rounded px-1.5 py-0.5 text-right text-xs font-medium tabular-nums focus:outline-none ${
                                      displayItem.manual_pricing_override
                                        ? "border-2 border-green-500 text-slate-900 bg-green-50 font-semibold focus:ring-2 focus:ring-green-400"
                                        : "border border-slate-300 text-slate-600 bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    }`}
                                    title={displayItem.manual_pricing_override ? "Manual override enabled - edit tariff" : "Enable manual override to edit"}
                                  />
                                ) : (
                                  <span className="text-slate-600 text-xs">${money(displayItem.tariff_105)}</span>
                                )}
                              </td>

                              {/* Ocean Frt (INPUT/READ-ONLY) */}
                              <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={displayItem.ocean_frt !== null && displayItem.ocean_frt !== undefined ? displayItem.ocean_frt : ""}
                                    onChange={(e) => updateEditingItem("ocean_frt", e.target.value === "" ? null : Number(e.target.value))}
                                    disabled={!displayItem.manual_pricing_override}
                                    className={`w-full rounded px-1.5 py-0.5 text-right text-xs font-medium tabular-nums focus:outline-none ${
                                      displayItem.manual_pricing_override
                                        ? "border-2 border-green-500 text-slate-900 bg-green-50 font-semibold focus:ring-2 focus:ring-green-400"
                                        : "border border-slate-300 text-slate-600 bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    }`}
                                    title={displayItem.manual_pricing_override ? "Manual override enabled - edit ocean" : "Enable manual override to edit"}
                                  />
                                ) : (
                                  <span className="text-blue-900">${money(displayItem.ocean_frt)}</span>
                                )}
                              </td>

                              {/* Importing (INPUT/READ-ONLY) */}
                              <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={displayItem.importing !== null && displayItem.importing !== undefined ? displayItem.importing : ""}
                                    onChange={(e) => updateEditingItem("importing", e.target.value === "" ? null : Number(e.target.value))}
                                    disabled={!displayItem.manual_pricing_override}
                                    className={`w-full rounded px-1.5 py-0.5 text-right text-xs font-medium tabular-nums focus:outline-none ${
                                      displayItem.manual_pricing_override
                                        ? "border-2 border-green-500 text-slate-900 bg-green-50 font-semibold focus:ring-2 focus:ring-green-400"
                                        : "border border-slate-300 text-slate-600 bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    }`}
                                    title={displayItem.manual_pricing_override ? "Manual override enabled - edit import" : "Enable manual override to edit"}
                                  />
                                ) : (
                                  <span className="text-blue-900">${money(displayItem.importing)}</span>
                                )}
                              </td>

                              {/* Zone 5 Shipping (INPUT) - labeled as "Price Delivered" for tariff exempt */}
                              <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={displayItem.indirect_labor !== null && displayItem.indirect_labor !== undefined ? displayItem.indirect_labor : ""}
                                    onChange={(e) => updateEditingItem("indirect_labor", e.target.value === "" ? null : Number(e.target.value))}
                                    className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-right text-xs font-medium text-slate-700 bg-white tabular-nums"
                                  />
                                ) : (
                                  <span className="text-blue-900">${money(item.indirect_labor)}</span>
                                )}
                              </td>

                              <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={displayItem.direct_labor !== null && displayItem.direct_labor !== undefined ? displayItem.direct_labor : ""}
                                    onChange={(e) => updateEditingItem("direct_labor", e.target.value === "" ? null : Number(e.target.value))}
                                    className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-right text-xs font-medium text-slate-700 bg-white tabular-nums"
                                  />
                                ) : (
                                  <span className="text-blue-900">${money(item.direct_labor)}</span>
                                )}
                              </td>

                              <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={displayItem.overhead_cost !== null && displayItem.overhead_cost !== undefined ? displayItem.overhead_cost : ""}
                                    onChange={(e) => updateEditingItem("overhead_cost", e.target.value === "" ? null : Number(e.target.value))}
                                    className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-right text-xs font-medium text-slate-700 bg-white tabular-nums"
                                  />
                                ) : (
                                  <span className="text-blue-900">${money(item.overhead_cost)}</span>
                                )}
                              </td>

                              {/* Zone 5 Shipping (INPUT) - labeled as "Price Delivered" for tariff exempt */}
                              <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={displayItem.zone5_shipping !== null && displayItem.zone5_shipping !== undefined ? displayItem.zone5_shipping : ""}
                                    onChange={(e) => updateEditingItem("zone5_shipping", e.target.value === "" ? null : Number(e.target.value))}
                                    className="w-full rounded border border-amber-400 px-1.5 py-0.5 text-right text-xs font-medium text-slate-700 bg-white tabular-nums"
                                  />
                                ) : (
                                  <span className="font-semibold text-amber-700">${money(item.zone5_shipping)}</span>
                                )}
                              </td>


                              {/* Cost w/ Shipping (DERIVED) - always visible */}
                              <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                <span className="text-slate-600 text-xs font-semibold">${money(displayItem.cost_with_shipping)}</span>
                              </td>

                              {/* Margin % (INPUT) */}
                              <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="99.99"
                                    value={displayItem.margin !== null && displayItem.margin !== undefined ? (displayItem.margin * 100).toFixed(2) : ""}
                                    onChange={(e) => updateEditingItem("margin", e.target.value === "" ? null : Number(e.target.value) / 100)}
                                    className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-right text-xs font-medium text-slate-700 bg-white tabular-nums"
                                    placeholder="e.g., 22.96"
                                  />
                                ) : (
                                  <span className="text-blue-900">{item.margin !== null && item.margin !== undefined ? `${(item.margin * 100).toFixed(2)}%` : "—"}</span>
                                )}
                              </td>

                              {/* Sell Price (DERIVED) */}
                              <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                <span className="text-slate-600 text-xs">${money(displayItem.sell_price)}</span>
                              </td>

                              {/* List Price (DERIVED) */}
                              <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                <span className="text-slate-600 text-xs">${money(displayItem.list_price)}</span>
                              </td>

                              {/* Profit (DERIVED) */}
                              <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                <span className="text-emerald-700 text-xs font-bold">${money(displayItem.profit)}</span>
                              </td>

                              {/* Weight (EDITABLE) */}
                              <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingItem?.weight_lbs ?? ""}
                                    onChange={(e) => updateEditingItem("weight_lbs", e.target.value === "" ? null : Number(e.target.value))}
                                    className="w-24 rounded border border-orange-400 px-1.5 py-0.5 text-right text-xs font-medium text-slate-700 bg-white tabular-nums"
                                    placeholder="—"
                                  />
                                ) : (
                                  <span className="text-orange-700 text-xs">{displayItem.weight_lbs ? `${displayItem.weight_lbs.toFixed(0)} lbs` : "—"}</span>
                                )}
                              </td>

                              {/* Action */}
                              <td className="px-1 py-1 text-center whitespace-nowrap sticky right-0 bg-inherit z-10">
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
                                      onClick={() => setEditingItem((prev) => prev ? { ...prev, tariff_exempt: !prev.tariff_exempt } : prev)}
                                      className={`px-2 py-1 text-xs font-semibold rounded ${editingItem?.tariff_exempt ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                                      type="button"
                                      title={editingItem?.tariff_exempt ? "Tariff exempt - no tariff calculation applied" : "Mark as tariff exempt"}
                                    >
                                      {editingItem?.tariff_exempt ? '✓ Exempt' : 'Exempt'}
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
                                    {item.tariff_exempt && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">Exempt</span>
                                    )}
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
                            </React.Fragment>
                          );})}
                          {categoryItems.length === 0 && (
                            <tr>
                              <td colSpan={20} className="px-6 py-4 text-center text-xs text-slate-600">
                                No items in this category
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      {/* Price Calculator Button (when editing) */}
                      {editingId && editingItem && (
                        <button
                          onClick={() => setShowCalculator(true)}
                          className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-colors font-semibold text-sm z-50"
                        >
                          <span className="text-lg">🧮</span>
                          Price Calc
                        </button>
                      )}

                      {/* Price Calculator Modal */}
                      {showCalculator && editingItem && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
                            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">🧮</span>
                                <div>
                                  <h2 className="text-lg font-semibold text-slate-900">{editingItem.item_no}</h2>
                                  <p className="text-xs text-slate-600">Margin: {editingItem.margin ? `${(editingItem.margin * 100).toFixed(2)}%` : '—'}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => setShowCalculator(false)}
                                className="text-slate-400 hover:text-slate-600"
                                type="button"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <div className="p-6">
                              <PriceCalculator
                                finalCost={editingItem.cost_with_shipping || null}
                                currentMargin={editingItem.margin}
                                currentSellPrice={editingItem.sell_price}
                                itemNo={editingItem.item_no}
                                isLoading={isLoading}
                                onSave={async (margin: number, sellPrice: number) => {
                                  // Update margin and recalculate all derived fields
                                  setEditingItem((prev) => {
                                    if (!prev) return prev;
                                    const updated = { ...prev, margin };
                                    const discount = getDiscountForCategoryId(updated.category_id);
                                    return computeDerivedFields(updated, discount);
                                  });
                                  // Show success feedback
                                  setStatus(`✓ Margin updated to ${(margin * 100).toFixed(2)}% (Sell: $${sellPrice.toFixed(2)})`);
                                  setShowCalculator(false);
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mobile Card View */}
                    <div className="block md:hidden divide-y divide-slate-100">
                      {categoryItems.map((item) => {
                        const isEditing = editingId === item.id;
                        const displayItem = isEditing && editingItem ? editingItem : item;
                        
                        return (
                          <div key={item.id} className={`p-3 ${isEditing ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}>
                            <div className="mb-2 flex items-center justify-between">
                              <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={selectedItemIds.has(item.id)}
                                  onChange={() => toggleItemSelection(item.id)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                Select item
                              </label>
                            </div>
                            {/* Item No only (no description on mobile) */}
                            <div className="mb-2">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={displayItem.item_no || ""}
                                  onChange={(e) => setEditingItem((prev) => prev ? ({ ...prev, item_no: e.target.value }) : prev)}
                                  className="w-full mb-2 rounded border border-blue-400 px-2 py-1 text-sm font-mono font-semibold"
                                />
                              ) : (
                                <div className="font-mono text-xs font-bold text-slate-900">{item.item_no}</div>
                              )}
                            </div>

                            {/* Key mobile fields only */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <div className="text-slate-500 mb-0.5 text-[10px] uppercase">Cost+Ship</div>
                                <div className="font-semibold text-slate-900 text-xs">${money(displayItem.cost_with_shipping)}</div>
                              </div>
                              <div>
                                <div className="text-slate-500 mb-0.5 text-[10px] uppercase">Sell</div>
                                <div className="font-semibold text-blue-700 text-xs">${money(displayItem.sell_price)}</div>
                              </div>
                              <div>
                                <div className="text-slate-500 mb-0.5 text-[10px] uppercase">List</div>
                                <div className="font-semibold text-slate-700 text-xs">${money(displayItem.list_price)}</div>
                              </div>
                              <div>
                                <div className="text-slate-500 mb-0.5 text-[10px] uppercase">Profit</div>
                                <div className="font-bold text-emerald-700 text-xs">${money(displayItem.profit)}</div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="mt-2 flex gap-2 pt-2 border-t border-slate-200">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={handleSave}
                                    disabled={isLoading}
                                    className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700"
                                    type="button"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    className="flex-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50"
                                    type="button"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startEditing(item)}
                                    className="flex-1 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                                    type="button"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(item.id)}
                                    disabled={isLoading}
                                    className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded hover:bg-red-100"
                                    type="button"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {categoryItems.length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-600">
                          No items in this category
                        </div>
                      )}
                    </div>
                  </section>
                ))}
              </>
            )}

          </div>
        </main>

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

              {/* Supplier */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Supplier</label>
                <input
                  type="text"
                  value={newProduct.supplier || ""}
                  onChange={(e) => setNewProduct({ ...newProduct, supplier: e.target.value })}
                  placeholder="e.g., HK, YZ, Hiker, Yizhan"
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

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Quantity (container qty)</label>
                  <input
                    type="number"
                    step="1"
                    value={newProduct.quantity ?? ""}
                    onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value ? Number(e.target.value) : null })}
                    placeholder="0"
                    className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <p className="text-xs text-slate-500">
                    Ocean freight and importing are auto-calculated from quantity (8000 and 2100 per container).
                  </p>
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

                <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Indirect Labor</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.indirect_labor ?? ""}
                    onChange={(e) => setNewProduct({ ...newProduct, indirect_labor: e.target.value ? Number(e.target.value) : null })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Direct Labor</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.direct_labor ?? ""}
                    onChange={(e) => setNewProduct({ ...newProduct, direct_labor: e.target.value ? Number(e.target.value) : null })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Overhead Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.overhead_cost ?? ""}
                    onChange={(e) => setNewProduct({ ...newProduct, overhead_cost: e.target.value ? Number(e.target.value) : null })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>

                {/* Margin % */}
                <div>
                  <label className="block text-sm font-semibold text-blue-700 mb-1">Margin %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="99.99"
                    value={newProduct.margin !== null && newProduct.margin !== undefined ? (newProduct.margin * 100).toFixed(2) : "0"}
                    onChange={(e) => setNewProduct({ ...newProduct, margin: e.target.value ? Number(e.target.value) / 100 : 0 })}
                    placeholder="22.96"
                    className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-800">
                    <input
                      type="checkbox"
                      checked={Boolean(newProduct.tariff_exempt)}
                      onChange={(e) => setNewProduct({ ...newProduct, tariff_exempt: e.target.checked })}
                      className="h-4 w-4 rounded border-purple-300 text-purple-600 accent-purple-600"
                    />
                    Tariff Exempt (skip tariff/ocean/importing calculations)
                  </label>
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

      {showShopifyPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Shopify Price Push Preview</h2>
                <p className="text-xs text-slate-600 mt-1">
                  {shopifyPreviewItems.length} mapped product(s) will be updated: base = Sell, compare-at = List.
                </p>
              </div>
              <button
                onClick={() => setShowShopifyPreviewModal(false)}
                className="text-slate-400 hover:text-slate-600"
                type="button"
                disabled={isShopifySyncing}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              {shopifyPreviewItems.length === 0 ? (
                <p className="text-sm text-slate-600">No mapped products found to sync.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="py-2 pr-4">Item No</th>
                      <th className="py-2 pr-4 text-right">Base (Sell)</th>
                      <th className="py-2 text-right">Compare-at (List)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shopifyPreviewItems.map((item) => (
                      <tr key={item.item_no} className="border-b border-slate-100">
                        <td className="py-2 pr-4 font-mono text-xs text-slate-800">{item.item_no}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-slate-800">${money(item.base_price)}</td>
                        <td className="py-2 text-right tabular-nums text-slate-800">${money(item.compare_at_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 rounded-b-2xl">
              <button
                onClick={() => setShowShopifyPreviewModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                type="button"
                disabled={isShopifySyncing}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmShopifyPush}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
                disabled={isShopifySyncing || shopifyPreviewItems.length === 0}
              >
                {isShopifySyncing ? "Pushing..." : "Confirm Push to Shopify"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showWebsiteSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Website Price Pull Preview</h2>
                <p className="text-xs text-slate-600 mt-1">
                  This updates local Sell Price to website price and local List Price to website compare-at when available.
                </p>
              </div>
              <button
                onClick={() => setShowWebsiteSyncModal(false)}
                className="text-slate-400 hover:text-slate-600"
                type="button"
                disabled={isWebsiteSyncing}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              {websiteSyncPreviewItems.length === 0 ? (
                <p className="text-sm text-slate-600">No mapped products found to sync from website.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="py-2 pr-4">Item No</th>
                      <th className="py-2 pr-4 text-right">Local Sell</th>
                      <th className="py-2 pr-4 text-right">Website Sell</th>
                      <th className="py-2 pr-4 text-right">Local List</th>
                      <th className="py-2 text-right">Website Compare-at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {websiteSyncPreviewItems.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-2 pr-4 font-mono text-xs text-slate-800">{item.item_no}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-slate-800">${money(item.local_sell_price)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-indigo-700 font-semibold">${money(item.website_sell_price)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-slate-800">${money(item.local_list_price)}</td>
                        <td className="py-2 text-right tabular-nums text-indigo-700 font-semibold">${money(item.website_compare_at_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 rounded-b-2xl">
              <button
                onClick={() => setShowWebsiteSyncModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                type="button"
                disabled={isWebsiteSyncing}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWebsitePull}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
                disabled={isWebsiteSyncing || websiteSyncPreviewItems.length === 0}
              >
                {isWebsiteSyncing ? "Syncing..." : "Confirm Pull From Website"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showCompareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-6xl rounded-2xl bg-white shadow-2xl max-h-[92vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Mock PO Comparison</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Build two mock purchase orders and compare costs side by side.
                </p>
              </div>
              <button
                onClick={() => setShowCompareModal(false)}
                className="text-slate-400 hover:text-slate-600"
                type="button"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-6 py-5">
              <datalist id="mock-po-product-options">
                {comparableItems.map((item) => (
                  <option
                    key={item.id}
                    value={item.item_no}
                    label={(item.description || "No description").slice(0, 80)}
                  />
                ))}
              </datalist>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Mock PO A</h3>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                        <button
                          type="button"
                          onClick={() => setMockPoACostMode("fob")}
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                            mockPoACostMode === "fob"
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          FOB
                        </button>
                        <button
                          type="button"
                          onClick={() => setMockPoACostMode("delivered")}
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                            mockPoACostMode === "delivered"
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          Delivered
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => addMockLine("A")}
                        className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        + Add Line
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {mockPoALines.map((line) => {
                      const selected = comparableItemsById.get(line.itemId);
                      return (
                        <div key={line.id} className="grid grid-cols-[1fr_92px_34px] gap-2">
                          <input
                            type="text"
                            list="mock-po-product-options"
                            value={line.searchText || selected?.item_no || ""}
                            onChange={(e) => updateMockLineSearch("A", line.id, e.target.value)}
                            placeholder="Type SKU (ex: 2PCF-9)"
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
                          />
                          <input
                            type="number"
                            min={0}
                            step="1"
                            value={line.quantity}
                            onChange={(e) => updateMockLine("A", line.id, { quantity: Number(e.target.value) || 0 })}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-right text-slate-900"
                            title="Quantity"
                          />
                          <button
                            type="button"
                            onClick={() => removeMockLine("A", line.id)}
                            className="rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                            title="Remove line"
                          >
                            ×
                          </button>
                          {selected && (
                            <div className="col-span-3 rounded-md bg-white px-2 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200">
                              {selected.item_no} •{' '}
                              {mockPoACostMode === "fob" ? `FOB $${money(selected.fob_cost)}` : `Delivered $${money(selected.per_unit)}`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Mock PO B</h3>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                        <button
                          type="button"
                          onClick={() => setMockPoBCostMode("fob")}
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                            mockPoBCostMode === "fob"
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          FOB
                        </button>
                        <button
                          type="button"
                          onClick={() => setMockPoBCostMode("delivered")}
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                            mockPoBCostMode === "delivered"
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          Delivered
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => addMockLine("B")}
                        className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                      >
                        + Add Line
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {mockPoBLines.map((line) => {
                      const selected = comparableItemsById.get(line.itemId);
                      return (
                        <div key={line.id} className="grid grid-cols-[1fr_92px_34px] gap-2">
                          <input
                            type="text"
                            list="mock-po-product-options"
                            value={line.searchText || selected?.item_no || ""}
                            onChange={(e) => updateMockLineSearch("B", line.id, e.target.value)}
                            placeholder="Type SKU (ex: 2PCF-9)"
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
                          />
                          <input
                            type="number"
                            min={0}
                            step="1"
                            value={line.quantity}
                            onChange={(e) => updateMockLine("B", line.id, { quantity: Number(e.target.value) || 0 })}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-right text-slate-900"
                            title="Quantity"
                          />
                          <button
                            type="button"
                            onClick={() => removeMockLine("B", line.id)}
                            className="rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                            title="Remove line"
                          >
                            ×
                          </button>
                          {selected && (
                            <div className="col-span-3 rounded-md bg-white px-2 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200">
                              {selected.item_no} •{' '}
                              {mockPoBCostMode === "fob" ? `FOB $${money(selected.fob_cost)}` : `Delivered $${money(selected.per_unit)}`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm mb-3">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Per Unit Metric</th>
                      <th className="px-3 py-2 text-right font-semibold">Mock PO A ({mockPoACostMode === "fob" ? "FOB" : "Delivered"})</th>
                      <th className="px-3 py-2 text-right font-semibold">Mock PO B ({mockPoBCostMode === "fob" ? "FOB" : "Delivered"})</th>
                      <th className="px-3 py-2 text-right font-semibold">Difference (B - A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-200">
                      <td className="px-3 py-2 text-slate-700">Selected Cost Basis per Unit</td>
                      <td className="px-3 py-2 text-right tabular-nums">${money(totalsA.totalQty > 0 ? totalsA.totalOutTheDoorCost / totalsA.totalQty : 0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">${money(totalsB.totalQty > 0 ? totalsB.totalOutTheDoorCost / totalsB.totalQty : 0)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${comparisonDiff.outTheDoorPerUnit >= 0 ? "text-red-700" : "text-emerald-700"}`}>
                        {comparisonDiff.outTheDoorPerUnit >= 0 ? "+" : ""}${money(comparisonDiff.outTheDoorPerUnit)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Metric</th>
                      <th className="px-3 py-2 text-right font-semibold">Mock PO A ({mockPoACostMode === "fob" ? "FOB" : "Delivered"})</th>
                      <th className="px-3 py-2 text-right font-semibold">Mock PO B ({mockPoBCostMode === "fob" ? "FOB" : "Delivered"})</th>
                      <th className="px-3 py-2 text-right font-semibold">Difference (B - A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-200">
                      <td className="px-3 py-2 font-semibold text-slate-800">Total Selected Cost</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">${money(totalsA.totalOutTheDoorCost)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">${money(totalsB.totalOutTheDoorCost)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-semibold ${comparisonDiff.outTheDoorTotal >= 0 ? "text-red-700" : "text-emerald-700"}`}>
                        {comparisonDiff.outTheDoorTotal >= 0 ? "+" : ""}${money(comparisonDiff.outTheDoorTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 rounded-b-2xl">
              <button
                onClick={() => {
                  const firstItem = items[0];
                  const secondItem = items[1] || items[0];
                  setMockPoALines(firstItem ? [createMockLine(firstItem.id, Number(firstItem.quantity || 1), firstItem.item_no)] : []);
                  setMockPoBLines(secondItem ? [createMockLine(secondItem.id, Number(secondItem.quantity || 1), secondItem.item_no)] : []);
                  setMockPoACostMode("fob");
                  setMockPoBCostMode("fob");
                }}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                type="button"
              >
                Reset
              </button>
              <button
                onClick={() => setShowCompareModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Print Column Picker Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Choose Columns to Print</h2>
              <button
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-slate-600"
                type="button"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4">
              <div className="flex gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setPrintCols(new Set(ALL_PRINT_COLUMNS.map((c) => c.key)))}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >Select all</button>
                <button
                  type="button"
                  onClick={() => setPrintCols(new Set())}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >Clear all</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PRINT_COLUMNS.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 cursor-pointer select-none rounded-lg px-3 py-2 hover:bg-slate-50 border border-slate-100">
                    <input
                      type="checkbox"
                      checked={printCols.has(col.key)}
                      onChange={(e) => {
                        const next = new Set(printCols);
                        if (e.target.checked) next.add(col.key);
                        else next.delete(col.key);
                        setPrintCols(next);
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 accent-blue-600"
                    />
                    <span className="text-sm text-slate-700">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (printCols.size === 0) { alert("Select at least one column."); return; }
                  setShowPrintModal(false);
                  handlePrintReport(printCols);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-700 rounded-lg hover:bg-slate-800 flex items-center gap-2"
                type="button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
