import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface PriceListItem {
  sku: string;
  description: string;
  current_sale_price_per_unit: number;
  shipping_included_per_unit: number;
}

/**
 * Fetch all price list items from Supabase
 */
export async function getPriceList(): Promise<Map<string, PriceListItem>> {
  try {
    const { data, error } = await supabase
      .from("price_list_items")
      .select("sku, description, current_sale_price_per_unit, shipping_included_per_unit");

    if (error) {
      console.error("Error fetching price list:", error);
      return new Map();
    }

    const priceMap = new Map<string, PriceListItem>();
    for (const item of data || []) {
      priceMap.set(item.sku.toUpperCase(), item);
    }
    return priceMap;
  } catch (err) {
    console.error("Failed to fetch price list:", err);
    return new Map();
  }
}

/**
 * Match a QBO item to price list and calculate shipping deduction
 * Returns: { matched: boolean, shippingDeducted: number, commissionable: number }
 */
export function matchItemAndCalculateShipping(
  qboItemName: string,
  qboItemRefValue: string,
  quantity: number,
  unitPrice: number,
  priceListMap: Map<string, PriceListItem>
): {
  matched: boolean;
  matchedSku?: string;
  shippingPerUnit: number;
  shippingDeducted: number;
  commissionable: number;
} {
  const lineTotal = quantity * unitPrice;

  // Try to match by SKU (item name from QBO)
  const searchKey = qboItemName?.toUpperCase() || qboItemRefValue?.toUpperCase();
  const priceListItem = priceListMap.get(searchKey);

  if (priceListItem) {
    const shippingDeducted = quantity * priceListItem.shipping_included_per_unit;
    const commissionable = lineTotal - shippingDeducted;

    return {
      matched: true,
      matchedSku: priceListItem.sku,
      shippingPerUnit: priceListItem.shipping_included_per_unit,
      shippingDeducted,
      commissionable: Math.max(0, commissionable), // Never negative
    };
  }

  // No match found - treat entire line as commissionable (shipping = $0)
  return {
    matched: false,
    shippingPerUnit: 0,
    shippingDeducted: 0,
    commissionable: lineTotal,
  };
}

/**
 * Calculate invoice totals with shipping deductions
 */
export function calculateInvoiceTotals(
  lineItems: Array<{
    shippingDeducted: number;
    commissionable: number;
    amount: number;
  }>
): {
  totalAmount: number;
  totalShippingDeducted: number;
  totalCommissionable: number;
} {
  return {
    totalAmount: lineItems.reduce((sum, line) => sum + line.amount, 0),
    totalShippingDeducted: lineItems.reduce((sum, line) => sum + line.shippingDeducted, 0),
    totalCommissionable: lineItems.reduce((sum, line) => sum + line.commissionable, 0),
  };
}
