export type PricingInput = {
  itemNo: string;
  description: string;
  supplier: string;
  fobCost: number;
  oceanFrt: number;
  importing: number;
  zone5: number;
  multiplier: number;
  quantity?: number;
};

export type PricingResult = PricingInput & {
  tariff105: number;
  perUnit: number;
  costWithShipping: number;
  sellPrice: number;
  roundedNormalPrice: number;
  listPrice: number;
  blackFridayPrice: number;
  roundedSalePrice: number;
};

const FIELD_KEYS: Record<keyof PricingInput, string[]> = {
  itemNo: ["item no", "item", "item #", "item number", "itemno"],
  description: ["description", "desc"],
  supplier: ["supplier", "vendor"],
  fobCost: ["fob cost", "fob", "cost"],
  oceanFrt: ["ocean frt", "ocean", "ocean freight"],
  importing: ["importing", "import"],
  zone5: ["zone 5", "zone5", "zone"],
  multiplier: ["multiplier", "mult", "markup"],
  quantity: ["quantity", "qty"],
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
    oceanFrt: normalizeNumber(raw.oceanFrt),
    importing: normalizeNumber(raw.importing),
    zone5: normalizeNumber(raw.zone5),
    multiplier: normalizeNumber(raw.multiplier) || 1,
    quantity: raw.quantity !== undefined ? normalizeNumber(raw.quantity) : undefined,
  };

  const tariff105 = base.fobCost * 2;
  const perUnit = tariff105 + base.oceanFrt + base.importing;
  const costWithShipping = perUnit + base.zone5;
  const sellPrice = costWithShipping * base.multiplier;
  const roundedNormalPrice = floorTo(sellPrice, 5);
  const listPrice = sellPrice * 1.2;
  const blackFridayPrice = listPrice * 0.75;
  const roundedSalePrice = floorTo(blackFridayPrice, 100) - 1;

  return {
    ...base,
    tariff105,
    perUnit,
    costWithShipping,
    sellPrice,
    roundedNormalPrice,
    listPrice,
    blackFridayPrice,
    roundedSalePrice,
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

  return {
    itemNo,
    description: normalizeText(pickField("description")),
    supplier: normalizeText(pickField("supplier")),
    fobCost: normalizeNumber(pickField("fobCost")),
    oceanFrt: normalizeNumber(pickField("oceanFrt")),
    importing: normalizeNumber(pickField("importing")),
    zone5: normalizeNumber(pickField("zone5")),
    multiplier: normalizeNumber(pickField("multiplier")) || 1,
    quantity: pickField("quantity") !== undefined ? normalizeNumber(pickField("quantity")) : undefined,
  };
};

export const computeAll = (rows: PricingInput[]): PricingResult[] => rows.map(computePricingRow);

export const exportRowShape = {
  baseHeaders: [
    "Item No.",
    "Description",
    "Supplier",
    "FOB Cost",
    "Ocean frt",
    "importing",
    "Zone 5",
    "Multiplier",
  ],
  computedHeaders: [
    "TARIFF + 105%",
    "Per Unit",
    "Cost (w/shipping)",
    "Sell Price",
    "Rounded Normal Price",
    "List Price",
    "Black Friday Pricing",
    "Rounded Sale Price",
  ],
};

export const toExportRow = (row: PricingResult) => ({
  "Item No.": row.itemNo,
  Description: row.description,
  Supplier: row.supplier,
  "FOB Cost": row.fobCost,
  "Ocean frt": row.oceanFrt,
  importing: row.importing,
  "Zone 5": row.zone5,
  Multiplier: row.multiplier,
  "TARIFF + 105%": row.tariff105,
  "Per Unit": row.perUnit,
  "Cost (w/shipping)": row.costWithShipping,
  "Sell Price": row.sellPrice,
  "Rounded Normal Price": row.roundedNormalPrice,
  "List Price": row.listPrice,
  "Black Friday Pricing": row.blackFridayPrice,
  "Rounded Sale Price": row.roundedSalePrice,
});
