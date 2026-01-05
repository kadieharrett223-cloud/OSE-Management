# Price List Excel Import Guide

## Overview

Your Excel price list "OLYMPIC EQUIPMENT REVISED PRICELIST (4-25)" is now integrated with Supabase. The system:

- Stores **input fields** (FOB cost, ocean freight, importing, zone5 shipping, multiplier)
- **Auto-computes derived fields** (tariff_105, sell_price, rounded_sale_price, etc.) via database triggers
- Supports **categories/sections** (2-POST LIFTS, Tire Machines, etc.)
- Supports **versioning** (multiple price lists over time)

## Database Schema

### Tables Created

**`price_list_categories`**
- Stores section headers (2-POST LIFTS, Tire Machines, etc.)
- Each category has a display_order for sorting

**`price_list_items`** (Enhanced)
- **Versioning**: `version_tag`, `as_of_date`, `is_active`
- **Core**: `item_no` (SKU), `description`, `supplier`, `category_id`
- **Input Fields**: `fob_cost`, `ocean_frt`, `importing`, `zone5_shipping`, `multiplier`
- **Derived Fields**: `tariff_105`, `per_unit`, `cost_with_shipping`, `sell_price`, `rounded_normal_price`, `list_price`, `black_friday_price`, `rounded_sale_price`
- **Commission Aliases**: `current_sale_price_per_unit`, `shipping_included_per_unit`

### Pricing Formulas (Auto-Computed)

```sql
tariff_105 = fob_cost * 2
per_unit = tariff_105 + ocean_frt + importing
cost_with_shipping = per_unit + zone5_shipping
sell_price = cost_with_shipping * multiplier
rounded_normal_price = FLOOR(sell_price / 5) * 5
list_price = sell_price * 1.2
black_friday_price = list_price * 0.75
rounded_sale_price = FLOOR(black_friday_price / 100) * 100 - 1
```

**When you insert/update only the input fields, derived fields compute automatically.**

## Migration Steps

### 1. Run Enhanced Schema Migration

In Supabase SQL Editor, run:
```sql
-- File: supabase/migrations/003_enhanced_price_list.sql
```

This will:
- Create `price_list_categories` table
- Recreate `price_list_items` with all pricing columns
- Add auto-compute trigger
- Insert 11 category names

### 2. Import Your Excel Data

#### Option A: Manual SQL Insert (Copy/Paste)

1. Convert Excel to SQL using the importer utility
2. Copy generated SQL
3. Paste into Supabase SQL Editor
4. Run

Example SQL format:
```sql
INSERT INTO price_list_items (
  version_tag, category_id, item_no, description, supplier,
  fob_cost, ocean_frt, importing, zone5_shipping, multiplier
)
VALUES (
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '2-POST LIFTS'),
  '2PBP-8',
  'Two Post Lift 8000 lbs',
  'Olympic Equipment',
  1250.00,
  150.00,
  75.00,
  125.00,
  2.5
)
ON CONFLICT (item_no, version_tag) DO UPDATE SET
  description = EXCLUDED.description,
  fob_cost = EXCLUDED.fob_cost,
  ocean_frt = EXCLUDED.ocean_frt,
  importing = EXCLUDED.importing,
  zone5_shipping = EXCLUDED.zone5_shipping,
  multiplier = EXCLUDED.multiplier;
```

**The trigger will automatically compute all derived fields!**

#### Option B: Use Admin Price List Import (Recommended)

We'll update the admin price list page to:
1. Accept Excel upload
2. Parse using `src/lib/price-list-importer.ts`
3. Batch insert to Supabase
4. Show import summary

### 3. Verify Import

Query to check data:
```sql
SELECT 
  item_no,
  description,
  fob_cost,
  zone5_shipping AS shipping_included,
  rounded_sale_price AS current_sale_price,
  c.category_name
FROM price_list_items p
LEFT JOIN price_list_categories c ON p.category_id = c.id
WHERE version_tag = '2025-04-25'
ORDER BY c.display_order, item_no;
```

## Excel Column Mapping

| Excel Column | Database Column | Type | Notes |
|--------------|----------------|------|-------|
| Item No | `item_no` | TEXT | SKU identifier |
| Description | `description` | TEXT | Product name |
| Supplier | `supplier` | TEXT | Vendor name |
| FOB Cost | `fob_cost` | NUMERIC(12,2) | Base cost |
| Quantity | `quantity` | NUMERIC(12,4) | Reference qty (optional) |
| Ocean frt | `ocean_frt` | NUMERIC(12,2) | Ocean freight |
| importing | `importing` | NUMERIC(12,2) | Import fees |
| Zone 5 | `zone5_shipping` | NUMERIC(12,2) | **Shipping deduction for commissions** |
| Multiplier | `multiplier` | NUMERIC(8,4) | Markup multiplier |
| TARIFF + 105% | `tariff_105` | NUMERIC(12,2) | AUTO-COMPUTED |
| Per Unit | `per_unit` | NUMERIC(12,2) | AUTO-COMPUTED |
| Cost (w/shipping) | `cost_with_shipping` | NUMERIC(12,2) | AUTO-COMPUTED |
| Sell Price | `sell_price` | NUMERIC(12,2) | AUTO-COMPUTED |
| Rounded Normal | `rounded_normal_price` | NUMERIC(12,2) | AUTO-COMPUTED |
| List Price | `list_price` | NUMERIC(12,2) | AUTO-COMPUTED |
| Black Friday | `black_friday_price` | NUMERIC(12,2) | AUTO-COMPUTED |
| Rounded Sale | `rounded_sale_price` | NUMERIC(12,2) | AUTO-COMPUTED (Current Sale Price) |

## Handling Section Headers

Section headers in Excel (like "2-POST LIFTS") should be skipped during import. The importer:
1. Detects all-caps lines
2. Looks up category_id from `price_list_categories`
3. Assigns subsequent items to that category

## Versioning Strategy

### Current Version
`version_tag = '2025-04-25'`
`is_active = true`

### Importing New Price List
1. Set new `version_tag` (e.g., '2025-06-01')
2. Import new data with `is_active = true`
3. Mark old version as inactive:
```sql
UPDATE price_list_items
SET is_active = false
WHERE version_tag = '2025-04-25';
```

### Querying Active Items
```sql
SELECT * FROM price_list_items
WHERE is_active = true;
```

## Commission Integration

The commission system needs two fields:
1. **`current_sale_price_per_unit`** = `rounded_sale_price` (the …99 price)
2. **`shipping_included_per_unit`** = `zone5_shipping`

These are **generated columns** (automatically populated from the source fields).

Commission formula:
```typescript
const commissionableLine = Math.max(
  0,
  qty * unitPriceUsed - (qty * shipping_included_per_unit)
);
const commission = commissionableLine * repCommissionRate;
```

## Next Steps

1. ✅ Run migration `003_enhanced_price_list.sql`
2. ⬜ Export Excel data to SQL or use importer
3. ⬜ Import data to Supabase
4. ⬜ Verify data with test query
5. ⬜ Update admin price list page to use new schema
6. ⬜ Test commission calculations with real SKU data

## Admin Price List Page Updates

The existing `/admin/price-list` page will be updated to:
- Show all pricing columns (input + derived)
- Support Excel upload with category parsing
- Display items grouped by category
- Allow version management
- Show pricing formulas visually

## Testing Formulas

Test a single SKU:
```sql
INSERT INTO price_list_items (
  version_tag, item_no, description,
  fob_cost, ocean_frt, importing, zone5_shipping, multiplier
)
VALUES (
  '2025-04-25', 'TEST-001', 'Test Item',
  1000.00, 100.00, 50.00, 125.00, 2.0
);

-- Check computed values
SELECT 
  item_no,
  fob_cost,
  tariff_105, -- Should be 2000.00 (1000 * 2)
  per_unit, -- Should be 2150.00 (2000 + 100 + 50)
  cost_with_shipping, -- Should be 2275.00 (2150 + 125)
  sell_price, -- Should be 4550.00 (2275 * 2)
  rounded_normal_price, -- Should be 4550.00 (floor to $5)
  list_price, -- Should be 5460.00 (4550 * 1.2)
  black_friday_price, -- Should be 4095.00 (5460 * 0.75)
  rounded_sale_price -- Should be 3999.00 (floor to $100 - 1)
FROM price_list_items
WHERE item_no = 'TEST-001';
```

Expected output:
```
TEST-001 | 1000.00 | 2000.00 | 2150.00 | 2275.00 | 4550.00 | 4550.00 | 5460.00 | 4095.00 | 3999.00
```
