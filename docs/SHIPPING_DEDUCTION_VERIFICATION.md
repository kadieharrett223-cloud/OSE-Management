# Shipping Deduction Verification Guide

## The Flow: How Shipping Deduction Works

```
QuickBooks Invoice
    ↓
    ├─ Line Item 1: Widget (SKU: SKU-001, Qty: 10, Price: $100)
    ├─ Line Item 2: Gadget (SKU: SKU-002, Qty: 5, Price: $50)
    └─ Line Item 3: Tax (non-product line)
    ↓
API: /api/qbo/invoice/by-rep
    ↓
    ├─ Fetch Price List from Supabase
    │   └─ SKU-001: shipping_included_per_unit = $15
    │   └─ SKU-002: shipping_included_per_unit = $10
    ↓
For Each Line Item:
    ├─ Match to Price List (by QBO Item ID → SKU → Name)
    ├─ Calculate: shipping_deducted = qty × shipping_per_unit
    │   └─ SKU-001: 10 × $15 = $150
    │   └─ SKU-002: 5 × $10 = $50
    ├─ Calculate: commissionable = line_total - shipping_deducted
    │   └─ SKU-001: ($100 × 10) - $150 = $1000 - $150 = $850
    │   └─ SKU-002: ($50 × 5) - $50 = $250 - $50 = $200
    └─ Return line details with shipping_deducted flag
    ↓
Commission Calculation:
    └─ commission = commissionable × 5%
        └─ SKU-001: $850 × 5% = $42.50
        └─ SKU-002: $200 × 5% = $10.00
        └─ Total: $52.50
```

## Where the Shipping Deduction Happens

### 1. **Code Location: `/src/app/api/qbo/invoice/by-rep/route.ts` (Lines 100-150)**

This is where each invoice line item gets processed:

```typescript
// For each line item in the invoice:
const matched = matchItemAndCalculateShipping(
  itemName,        // "Widget" (from QBO)
  itemRef,         // "SKU-001" (QBO item ID/reference)
  qty,             // 10
  unitPrice,       // $100
  priceList        // Map of price list data
);

// Returns:
// {
//   matched: true,
//   matchedSku: "SKU-001",
//   shippingPerUnit: 15,           // FROM PRICE LIST
//   shippingDeducted: 150,         // qty × shipping_per_unit
//   commissionable: 850            // line_total - shipping_deducted
// }

totalShippingDeducted += matched.shippingDeducted;  // Adds to invoice total
```

### 2. **Code Location: `/src/lib/shippingDeduction.ts` (Matching Logic)**

This is where the price list is queried and items are matched:

```typescript
export async function getPriceList(): Promise<Map<string, PriceListItem>> {
  // Fetches from Supabase: price_list_items table
  // Each item has:
  // - sku (primary key)
  // - shipping_included_per_unit (THE VALUE BEING DEDUCTED)
  // - qbo_item_id (if synced)
  // - qbo_item_name (if synced)
}

export function matchItemAndCalculateShipping(...) {
  // Priority 1: Match by QBO Item ID (if synced)
  // Priority 2: Match by SKU
  // Priority 3: Match by Item Name
  
  // When matched, deducts: qty × shipping_included_per_unit
}
```

## Where to Verify Shipping Deduction is Working

### **Step 1: Check the Commissions Page UI**
📍 URL: `http://localhost:3003/commissions`

Look at the "Invoices" table:
- **Shipping Deducted** column shows the total deduction per invoice
- **Commission** column shows the final amount (calculated on commissionable, not gross)

Example:
```
Invoice #: 2024-001
Date: Jan 15, 2024
Shipping Deducted: $150.00  ← This is the sum of all line deductions
Commission: $42.50          ← This is 5% of commissionable (not gross)
```

### **Step 2: Expand Invoice Details**
Click "Show lines" on any invoice to see line-by-line breakdown:
```
Line Items:
  Widget (SKU-001)
  10 × $100.00 = $1,000.00

  Gadget (SKU-002)
  5 × $50.00 = $250.00
```

(Note: Currently shows line-item prices, but shipping deduction is applied behind the scenes)

### **Step 3: Check the API Response Directly**
Make a curl request to see the raw data:

```bash
curl "http://localhost:3003/api/qbo/invoice/by-rep?repName=KLH&startDate=2024-01-01&endDate=2024-01-31&status=paid"
```

Response will show:
```json
{
  "ok": true,
  "invoices": [
    {
      "id": "inv123",
      "invoiceNumber": "2024-001",
      "totalAmount": 1250.00,
      "totalShippingDeducted": 150.00,      // ← Deduction sum
      "totalCommissionable": 1100.00,       // ← After deduction
      "commission": 55.00,                  // ← 5% of commissionable
      "lines": [
        {
          "sku": "SKU-001",
          "qty": 10,
          "unitPrice": 100.00,
          "lineAmount": 1000.00,
          "shippingDeducted": 150.00,       // ← Line-level deduction
          "commissionable": 850.00,         // ← After deduction
          "matched": true                   // ← Was found in price list
        }
      ]
    }
  ]
}
```

### **Step 4: Check the Price List Sync Status**
Make a request to see which items are matched:

```bash
curl "http://localhost:3003/api/admin/sync/price-list-items"
```

Response shows:
```json
{
  "ok": true,
  "priceListItemsCount": 95,
  "matchesFound": 89,
  "synced": 0,
  "matches": [
    {
      "priceListSku": "SKU-001",
      "qboItemId": "123456",
      "qboItemName": "Widget",
      "matchType": "exact",
      "confidence": 1.0
    }
  ]
}
```

## Troubleshooting: Why Shipping Might Not Be Deducting

### **Symptom 1: Shipping Deducted = $0 for an invoice**

**Causes:**
1. ❌ Item not matched to price list (`matched: false`)
2. ❌ Item in price list but `shipping_included_per_unit` = 0
3. ❌ Item is non-product line (tax, discount, freight)

**Fix:**
- Check the invoice details API response - is `matched: true`?
- Check Supabase: does the SKU exist in `price_list_items`?
- Check the `shipping_included_per_unit` value for that SKU

### **Symptom 2: Commission Looks Wrong**

**Formula Check:**
```
Commission = (Line Total - Shipping Deducted) × 5%

Example:
Line Total:          $1,000
Shipping Deducted:   -$150
Commissionable:      $850
Commission (5%):     $42.50
```

If commission looks high: shipping might not be deducting
If commission looks low: shipping might be over-deducting

### **Symptom 3: Some Items Matched, Others Aren't**

**Solution:** Run the sync API with auto-fix

```bash
# View unmatched items
curl "http://localhost:3003/api/admin/sync/price-list-items"

# Auto-match and sync to database
curl "http://localhost:3003/api/admin/sync/price-list-items?sync=true"
```

## Database Check: Direct SQL Query

To verify the price list has shipping data:

```sql
-- Check all SKUs in price list
SELECT 
  sku,
  description,
  shipping_included_per_unit,
  qbo_item_id,
  qbo_item_name
FROM price_list_items
ORDER BY sku;

-- Check specific SKU
SELECT * FROM price_list_items 
WHERE sku = 'SKU-001';
```

## Quick Verification Checklist

- [ ] **Price List has data?**
  - Query: `SELECT COUNT(*) FROM price_list_items;` (should be > 0)
  - Each item has `shipping_included_per_unit` set

- [ ] **QBO Items synced?**
  - Call: `GET /api/admin/sync/price-list-items`
  - Check: `matchesFound > 0`

- [ ] **Invoices show shipping deduction?**
  - Check: `/commissions` page, "Shipping Deducted" column
  - Not zero for products that should have deductions

- [ ] **Commission matches formula?**
  - Check: Commission = Commissionable × 5%
  - Not: Commission = Total × 5%

- [ ] **Line items are marked as matched?**
  - API response: `"matched": true` for each line
  - If false: item not found in price list

## Summary

**The shipping deduction system:**
1. ✅ Fetches price list on each invoice processing
2. ✅ Matches each line item to the price list (by QBO Item ID → SKU → Name)
3. ✅ Calculates: `shippingDeducted = qty × shipping_included_per_unit`
4. ✅ Calculates: `commissionable = lineTotal - shippingDeducted`
5. ✅ Calculates: `commission = commissionable × 5%`

To verify it's working, check the **Commissions page** or call the **API directly** to see the `shippingDeducted` amounts on each line item.
