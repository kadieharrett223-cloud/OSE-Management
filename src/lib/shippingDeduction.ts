import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// Prefer service role key on the server so RLS doesn't block shipping data reads
const supabase = createClient(
  supabaseUrl,
  serviceRoleKey || supabaseAnonKey,
  serviceRoleKey
    ? { auth: { autoRefreshToken: false, persistSession: false } }
    : undefined
);

export interface PriceListItem {
  id?: string;
  item_no: string; // Changed from sku to item_no
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
      .select("id, item_no, description, current_sale_price_per_unit, shipping_included_per_unit");

    if (error) {
      console.error("Error fetching price list:", error);
      return new Map();
    }

    console.log(`[shippingDeduction] Loaded ${data?.length || 0} price list items`);
    const priceMap = new Map<string, PriceListItem>();
    for (const item of data || []) {
      // Map by item_no (primary key)
      priceMap.set(item.item_no.toUpperCase(), item);
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

  // Priority 1: Try to match by exact name/SKU key
  const searchKey = qboItemName?.toUpperCase() || qboItemRefValue?.toUpperCase();
  const priceListItem = searchKey ? priceListMap.get(searchKey) : undefined;

  if (priceListItem) {
    const shippingDeducted = quantity * priceListItem.shipping_included_per_unit;
    const commissionable = lineTotal - shippingDeducted;

    console.log(`[match] ✓ Exact match: "${qboItemName}" → SKU ${priceListItem.item_no}, ship=$${shippingDeducted}`);
    return {
      matched: true,
      matchedSku: priceListItem.item_no,
      shippingPerUnit: priceListItem.shipping_included_per_unit,
      shippingDeducted,
      commissionable: Math.max(0, commissionable),
    };
  }

  // Priority 2: Fuzzy contains match (item_no contained in the QBO item name)
  if (qboItemName) {
    const upperName = qboItemName.toUpperCase();
    const seen = new Set<string>();
    let best: PriceListItem | undefined;
    for (const value of priceListMap.values()) {
      if (!value || !value.item_no) continue;
      if (seen.has(value.item_no)) continue; // avoid duplicate entries created by multiple keys
      seen.add(value.item_no);
      const itemNoUpper = value.item_no.toUpperCase();
      if (upperName.includes(itemNoUpper)) {
        if (!best || itemNoUpper.length > best.item_no.length) {
          best = value;
        }
      }
    }
    if (best) {
      const shippingDeducted = quantity * best.shipping_included_per_unit;
      const commissionable = lineTotal - shippingDeducted;
      console.log(`[match] ✓ Fuzzy match: "${qboItemName}" → SKU ${best.item_no}, ship=$${shippingDeducted}`);
      return {
        matched: true,
        matchedSku: best.item_no,
        shippingPerUnit: best.shipping_included_per_unit,
        shippingDeducted,
        commissionable: Math.max(0, commissionable),
      };
    }
  }

  // No match found - treat entire line as commissionable (shipping = $0)
  console.log(`[match] ✗ No match for: "${qboItemName}" (ref=${qboItemRefValue}), lineTotal=$${lineTotal}`);
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
