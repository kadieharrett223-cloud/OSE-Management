# QuickBooks Item Matching System

## Overview

This system automatically matches your QuickBooks inventory items with your Supabase price list, ensuring that shipping deductions are accurately applied based on the actual products being sold.

## How It Works

### Matching Strategy (Priority Order)

1. **Direct QBO Item ID Match** (Most Reliable)
   - Matches using the unique QuickBooks item ID
   - Once matched, this is the primary lookup method
   - Most accurate and fastest

2. **SKU Match** (Standard)
   - Matches by comparing product SKU
   - Works if SKUs are consistent between QBO and price list

3. **Item Name Match** (Fallback)
   - Fuzzy matches based on product name/description
   - Lower confidence but helps identify products

### Database Changes

The `price_list_items` table now has three new fields:

```sql
qbo_item_id TEXT          -- QuickBooks item ID (unique reference)
qbo_item_name TEXT        -- QBO item name (cached for reference)
last_synced_with_qbo TIMESTAMPTZ  -- When the match was created/updated
```

## Setup Instructions

### Step 1: Deploy the Migration

The migration (`024_add_qbo_item_reference.sql`) has been created and will be applied automatically when you next deploy to Supabase. Or manually run:

```sql
ALTER TABLE price_list_items
ADD COLUMN qbo_item_id TEXT,
ADD COLUMN qbo_item_name TEXT,
ADD COLUMN last_synced_with_qbo TIMESTAMPTZ;
```

### Step 2: Sync Items

Call the sync API to automatically match items:

```bash
# View matches without syncing
curl "http://localhost:3003/api/admin/sync/price-list-items"

# Sync matches to database
curl "http://localhost:3003/api/admin/sync/price-list-items?sync=true"
```

### API Response Example

```json
{
  "ok": true,
  "qboItemsCount": 147,
  "priceListItemsCount": 95,
  "matchesFound": 89,
  "synced": 85,
  "matches": [
    {
      "priceListSku": "SKU-001",
      "qboItemId": "123456",
      "qboItemName": "Widget Pro - Black",
      "matchType": "exact",
      "confidence": 1.0
    }
  ]
}
```

## How Shipping Deductions Work Now

When an invoice is processed:

1. **Line item comes in from QuickBooks**
   ```
   Item Name: "Widget Pro - Black"
   Item ID: 123456
   Quantity: 10
   Unit Price: $99.99
   ```

2. **System looks up shipping deduction**
   - First tries: QBO Item ID (123456) → finds match → uses stored shipping_included_per_unit
   - Falls back to SKU match if needed

3. **Deduction is applied**
   ```
   Line Total: $999.90
   Shipping Deducted: $15.00 per unit × 10 = $150.00
   Commissionable: $999.90 - $150.00 = $849.90
   Commission (5%): $42.45
   ```

## Manual Matching

If the auto-sync doesn't match an item perfectly, you can manually update it in the database:

```sql
UPDATE price_list_items
SET qbo_item_id = '123456',
    qbo_item_name = 'Widget Pro - Black',
    last_synced_with_qbo = NOW()
WHERE sku = 'SKU-001';
```

## Troubleshooting

### Items not matching?

1. Check that SKUs match between QBO and price list (case-insensitive)
2. Manually sync a few items to see the match results
3. Check the `matches` array in the API response for "fuzzy" matches with low confidence
4. Manually update `qbo_item_id` for items that need special handling

### Commission calculations off?

1. Verify the `shipping_included_per_unit` amount in the price list
2. Check if the invoice line item is matching correctly (check `matched` flag)
3. Review the sync response to confirm items are matched

### Performance

- Lookups are indexed by `qbo_item_id` for O(1) performance
- Price list is cached in memory during invoice processing
- Re-syncing only updates items with new matches

## Next Steps

1. Run the migration to add the new columns
2. Call the sync API with `?sync=true` to match items
3. Review the matches and manually correct any mismatches
4. Monitor commission calculations to verify accuracy

Once synced, the system will automatically use the QBO item ID for precise, reliable shipping deductions on all future invoices.
