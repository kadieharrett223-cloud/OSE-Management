import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface PriceListItem {
  id?: string;
  sku: string;
  description: string;
  current_sale_price_per_unit: number;
  shipping_included_per_unit: number;
  qbo_item_id?: string;
  qbo_item_name?: string;
}

export interface QboItem {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  type?: string;
}

/**
 * Fetch all price list items from Supabase
 * Maps by SKU, QBO item ID, and item name for flexible lookup
 */
export async function getPriceList(): Promise<Map<string, PriceListItem>> {
  try {
    const { data, error } = await supabase
      .from("price_list_items")
      .select("id, sku, description, current_sale_price_per_unit, shipping_included_per_unit, qbo_item_id, qbo_item_name");

    if (error) {
      console.error("Error fetching price list:", error);
      return new Map();
    }

    const priceMap = new Map<string, PriceListItem>();
    for (const item of data || []) {
      // Map by SKU (primary key)
      priceMap.set(item.sku.toUpperCase(), item);
      
      // Map by QBO item ID if available (for direct matching)
      if (item.qbo_item_id) {
        priceMap.set(`QBO:${item.qbo_item_id}`, item);
      }
      
      // Map by QBO item name if available (for fuzzy matching)
      if (item.qbo_item_name) {
        priceMap.set(item.qbo_item_name.toUpperCase(), item);
      }
    }
    return priceMap;
  } catch (err) {
    console.error("Failed to fetch price list:", err);
    return new Map();
  }
}

/**
 * Build a fuzzy match map for QBO items
 * Maps by name, SKU, and partial matches
 */
export function buildQboItemMap(qboItems: QboItem[]): Map<string, QboItem> {
  const map = new Map<string, QboItem>();
  
  for (const item of qboItems) {
    // Map by name (uppercase)
    map.set(item.name.toUpperCase(), item);
    
    // Map by SKU if available
    if (item.sku) {
      map.set(item.sku.toUpperCase(), item);
    }
    
    // Map by ID
    map.set(item.id, item);
  }
  
  return map;
}

/**
 * Match a QBO item to price list and calculate shipping deduction
 * Strategy:
 * 1. Try direct match on item name/SKU
 * 2. Try partial fuzzy match
 * 3. If no match, treat as non-commissionable (full deduction)
 */
export function matchItemAndCalculateShipping(
  qboItemName: string,
  qboItemRefValue: string,
  quantity: number,
  unitPrice: number,
  priceListMap: Map<string, PriceListItem>,
  qboItemMap?: Map<string, QboItem>
): {
  matched: boolean;
  matchedSku?: string;
  shippingPerUnit: number;
  shippingDeducted: number;
  commissionable: number;
} {
  const lineTotal = quantity * unitPrice;

  // Priority 1: Try to match by QBO item ID (most reliable - direct reference)
  if (qboItemRefValue) {
    const qboIdKey = `QBO:${qboItemRefValue}`;
    const priceListItem = priceListMap.get(qboIdKey);
    
    if (priceListItem) {
      const shippingDeducted = quantity * priceListItem.shipping_included_per_unit;
      const commissionable = lineTotal - shippingDeducted;

      return {
        matched: true,
        matchedSku: priceListItem.sku,
        shippingPerUnit: priceListItem.shipping_included_per_unit,
        shippingDeducted,
        commissionable: Math.max(0, commissionable),
      };
    }
  }

  // Priority 2: Try to match by SKU (item name from QBO)
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
      commissionable: Math.max(0, commissionable),
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
