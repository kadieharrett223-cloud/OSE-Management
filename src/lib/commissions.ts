export type PriceListItem = {
  sku: string;
  currentSalePricePerUnit: number; // Rounded Sale Price
  shippingIncludedPerUnit: number;
};

export type InvoiceLineInput = {
  sku: string;
  quantity: number;
  unitPrice?: number; // actual sold unit price (current sale price if missing)
  description?: string;
};

export type CommissionCalcOptions = {
  repCommissionRate: number; // e.g. 0.05 for 5%
  missingSkuStrategy?: "exclude" | "zero-shipping";
};

export type CommissionLine = {
  sku: string;
  quantity: number;
  unitPriceUsed: number;
  shippingIncludedPerUnit: number;
  shippingDeductionLine: number;
  commissionableLine: number;
  commissionLine: number;
  mappingStatus: "MATCHED" | "NEEDS_MAPPING";
  description?: string;
};

export type CommissionInvoiceResult = {
  lines: CommissionLine[];
  invoiceCommission: number;
  invoiceCommissionable: number;
  shippingDeducted: number;
  needsMappingCount: number;
};

const normalize = (n: number | undefined | null) => (Number.isFinite(n as number) ? Number(n) : 0);

export function buildPriceListMap(items: PriceListItem[]) {
  const map = new Map<string, PriceListItem>();
  items.forEach((item) => map.set(item.sku.toLowerCase(), item));
  return map;
}

export function calculateCommissionForInvoice(
  lines: InvoiceLineInput[],
  priceList: PriceListItem[],
  options: CommissionCalcOptions,
): CommissionInvoiceResult {
  const missingStrategy = options.missingSkuStrategy ?? "exclude";
  const priceMap = buildPriceListMap(priceList);

  const computedLines: CommissionLine[] = lines.map((line) => {
    const qty = normalize(line.quantity);
    const priceListItem = priceMap.get((line.sku || "").toLowerCase());

    const fallbackPrice = priceListItem?.currentSalePricePerUnit ?? 0;
    const unitPriceUsed = normalize(line.unitPrice) || fallbackPrice;

    const shippingIncludedPerUnit = priceListItem?.shippingIncludedPerUnit ?? 0;
    const shippingDeductionLine = qty * shippingIncludedPerUnit;

    const hasMapping = Boolean(priceListItem);
    const commissionableBase = qty * unitPriceUsed;

    let commissionableLine: number;
    if (!hasMapping && missingStrategy === "exclude") {
      commissionableLine = 0;
    } else {
      const shippingDeduct = hasMapping ? shippingDeductionLine : 0;
      commissionableLine = Math.max(0, commissionableBase - shippingDeduct);
    }

    const commissionLine = commissionableLine * options.repCommissionRate;

    return {
      sku: line.sku,
      description: line.description,
      quantity: qty,
      unitPriceUsed,
      shippingIncludedPerUnit,
      shippingDeductionLine,
      commissionableLine,
      commissionLine,
      mappingStatus: hasMapping ? "MATCHED" : "NEEDS_MAPPING",
    };
  });

  const invoiceCommission = computedLines.reduce((sum, l) => sum + l.commissionLine, 0);
  const invoiceCommissionable = computedLines.reduce((sum, l) => sum + l.commissionableLine, 0);
  const shippingDeducted = computedLines.reduce((sum, l) => sum + l.shippingDeductionLine, 0);
  const needsMappingCount = computedLines.filter((l) => l.mappingStatus === "NEEDS_MAPPING").length;

  return {
    lines: computedLines,
    invoiceCommission,
    invoiceCommissionable,
    shippingDeducted,
    needsMappingCount,
  };
}

export function aggregateMonthly(
  invoices: CommissionInvoiceResult[],
): { totalCommission: number; totalCommissionable: number; shippingDeducted: number; invoiceCount: number } {
  const totals = invoices.reduce(
    (acc, inv) => {
      acc.totalCommission += inv.invoiceCommission;
      acc.totalCommissionable += inv.invoiceCommissionable;
      acc.shippingDeducted += inv.shippingDeducted;
      acc.invoiceCount += 1;
      return acc;
    },
    { totalCommission: 0, totalCommissionable: 0, shippingDeducted: 0, invoiceCount: 0 },
  );
  return totals;
}
