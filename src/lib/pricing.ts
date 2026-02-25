export type PricingInput = {
  itemNo: string;
  description: string;
  supplier: string;
  fobCost: number;
  quantity: number; // Container capacity
  shipping: number; // Zone 5 shipping
  margin: number; // Margin % as decimal (e.g., 0.2296 for 22.96%)
  listPrice?: number; // Optional manual list price
  discount?: number; // % off list price (default 20)
};

export type PricingResult = PricingInput & {
  tariff: number;
  oceanPerUnit: number;
  importingPerUnit: number;
  costNoShipping: number;
  finalCost: number;
  sellPrice: number;
  profit: number;
  calculatedListPrice: number;
  appliedListPrice: number; // Manual or calculated
  discountPercent: number;
  discountedPrice: number; // Final sale price
  formattedMargin?: string; // For display as %
};

const FIELD_KEYS: Record<keyof PricingInput, string[]> = {
  itemNo: ["item no", "item", "item #", "item number", "itemno"],
  description: ["description", "desc"],
  supplier: ["supplier", "vendor"],
  fobCost: ["fob cost", "fob", "cost"],
  quantity: ["quantity", "qty", "container capacity"],
  shipping: ["shipping", "zone 5", "zone5"],
  margin: ["margin", "margin %", "margin percent"],
  listPrice: ["list price", "manual list price", "suggested retail"],
  discount: ["discount", "discount %", "discount percent"],
};

const normalizeNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : value !== undefined && value !== null ? String(value).trim() : "";

const floorTo = (value: number, step: number): number => Math.floor(value / step) * step;

export const computePricingRow = (raw: PricingInput): PricingResult => {
  const base: PricingInput = {
    itemNo: normalizeText(raw.itemNo),
    description: normalizeText(raw.description),
    supplier: normalizeText(raw.supplier),
    fobCost: normalizeNumber(raw.fobCost),
    quantity: normalizeNumber(raw.quantity) || 1,
    shipping: normalizeNumber(raw.shipping),
    margin: Math.min(normalizeNumber(raw.margin), 0.9999), // Cap at 99.99%
    listPrice: raw.listPrice !== undefined ? normalizeNumber(raw.listPrice) : undefined,
    discount: raw.discount !== undefined ? normalizeNumber(raw.discount) : 20, // Default 20%
  };

  // Constants
  const OCEAN_FREIGHT_PER_CONTAINER = 3000;
  const IMPORTING_PER_CONTAINER = 2100;

  // Pricing calculations
  const tariff = base.fobCost * 2; // Tariff = FOB × 2
  const oceanPerUnit = OCEAN_FREIGHT_PER_CONTAINER / base.quantity;
  const importingPerUnit = IMPORTING_PER_CONTAINER / base.quantity;
  const costNoShipping = tariff + oceanPerUnit + importingPerUnit;
  const finalCost = costNoShipping + base.shipping;
  
  // Sell price based on margin: Sell = Final / (1 - Margin)
  const sellPrice = base.margin > 0 && base.margin < 1 ? finalCost / (1 - base.margin) : finalCost;
  const profit = sellPrice - finalCost;
  
  // List price: always 20% higher than sell price
  const calculatedListPrice = sellPrice / 0.8; // Sell / 0.80 = List
  const appliedListPrice = base.listPrice !== undefined ? base.listPrice : calculatedListPrice;
  
  // Final discounted price
  const discountPercent = base.discount || 20;
  const discountedPrice = appliedListPrice * (1 - discountPercent / 100);

  return {
    ...base,
    tariff,
    oceanPerUnit,
    importingPerUnit,
    costNoShipping,
    finalCost,
    sellPrice,
    profit,
    calculatedListPrice,
    appliedListPrice,
    discountPercent,
    discountedPrice,
    formattedMargin: `${(base.margin * 100).toFixed(2)}%`,
  };
};

export const mapSheetRowToInput = (raw: Record<string, unknown>): PricingInput | null => {
  const lowerKeyed: Record<string, unknown> = {};
  Object.entries(raw).forEach(([key, val]) => {
    lowerKeyed[key.trim().toLowerCase()] = val;
  });

  const pickField = (field: keyof PricingInput): unknown => {
    const candidates = FIELD_KEYS[field];
    for (const candidate of candidates) {
      if (candidate in lowerKeyed) return lowerKeyed[candidate];
    }
    return undefined;
  };

  const itemNo = normalizeText(pickField("itemNo"));
  if (!itemNo) return null;

  // Margin may be provided as decimal (0.2296) or percentage (22.96) - normalize to decimal
  let marginValue = normalizeNumber(pickField("margin")) || 0;
  if (marginValue > 1) marginValue = marginValue / 100; // Convert from percentage to decimal

  return {
    itemNo,
    description: normalizeText(pickField("description")),
    supplier: normalizeText(pickField("supplier")),
    fobCost: normalizeNumber(pickField("fobCost")),
    quantity: normalizeNumber(pickField("quantity")) || 1,
    shipping: normalizeNumber(pickField("shipping")),
    margin: marginValue,
    listPrice: pickField("listPrice") !== undefined ? normalizeNumber(pickField("listPrice")) : undefined,
    discount: pickField("discount") !== undefined ? normalizeNumber(pickField("discount")) : 20,
  };
};

export const computeAll = (rows: PricingInput[]): PricingResult[] => rows.map(computePricingRow);

export const exportRowShape = {
  baseHeaders: [
    "Item No.",
    "Description",
    "Supplier",
    "FOB Cost",
    "Quantity (Container Capacity)",
    "Shipping",
    "Margin %",
    "List Price (Optional)",
    "Discount %",
  ],
  computedHeaders: [
    "Tariff (FOB × 2)",
    "Ocean Per Unit",
    "Importing Per Unit",
    "Cost (no shipping)",
    "Final Cost",
    "Sell Price",
    "Profit",
    "Calculated List Price",
    "Applied List Price",
    "Discounted Price (Sale)",
  ],
};

export const toExportRow = (row: PricingResult) => ({
  "Item No.": row.itemNo,
  Description: row.description,
  Supplier: row.supplier,
  "FOB Cost": row.fobCost,
  "Quantity (Container Capacity)": row.quantity,
  Shipping: row.shipping,
  "Margin %": row.formattedMargin,
  "List Price (Optional)": row.listPrice ?? "",
  "Discount %": row.discount,
  "Tariff (FOB × 2)": row.tariff,
  "Ocean Per Unit": row.oceanPerUnit,
  "Importing Per Unit": row.importingPerUnit,
  "Cost (no shipping)": row.costNoShipping,
  "Final Cost": row.finalCost,
  "Sell Price": row.sellPrice,
  Profit: row.profit,
  "Calculated List Price": row.calculatedListPrice,
  "Applied List Price": row.appliedListPrice,
  "Discounted Price (Sale)": row.discountedPrice,
});
