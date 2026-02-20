# Deployment Guide - Chinese Invoices Feature

## Overview

The following migrations need to be applied to Supabase to enable the Chinese invoices and internal notes features.

## Migrations to Deploy

Run these migrations in order in your Supabase SQL Editor:

### 1. Add Internal Notes to Purchase Orders
**File:** `supabase/migrations/036_add_po_internal_notes.sql`

1. Go to Supabase Dashboard → SQL Editor
2. Copy entire file contents
3. Paste and run
4. Verify: The `purchase_orders` table should have new `internal_notes` column

### 2. Create Chinese Invoices Table
**File:** `supabase/migrations/037_chinese_invoices_log.sql`

1. Copy entire file contents
2. Paste and run in SQL Editor
3. Verify: New `chinese_invoices` table created with all columns and indexes

### 3. Enhance with File Metadata
**File:** `supabase/migrations/038_enhance_chinese_invoices_files.sql`

1. Copy entire file contents
2. Paste and run in SQL Editor
3. Verify: `chinese_invoices` table has `file_name`, `file_size`, `file_mime_type`, `file_uploaded_at`

### 4. Create Storage Bucket and Policies (Chinese Invoices)
**File:** `supabase/migrations/039_create_chinese_invoices_storage.sql`

1. Copy entire file contents
2. Paste and run in SQL Editor
3. Verify in Storage tab: New bucket `chinese-invoices` exists and is private

### 5. Create Chinese PO Files Table
**File:** `supabase/migrations/040_chinese_po_files.sql`

1. Copy entire file contents
2. Paste and run in SQL Editor
3. Verify: New `chinese_po_files` table created with all columns and indexes

### 6. Create Storage Bucket and Policies (Chinese PO Files)
**File:** `supabase/migrations/041_create_chinese_po_files_storage.sql`

1. Copy entire file contents
2. Paste and run in SQL Editor
3. Verify in Storage tab: New bucket `chinese-po-files` exists and is private

## Verification Checklist

After running all migrations:

- [ ] Purchase orders have `internal_notes` column
- [ ] `chinese_invoices` table exists with all fields
- [ ] `chinese_po_files` table exists with all fields
- [ ] Indexes created for performance on both tables
- [ ] RLS policies enabled on all tables
- [ ] Storage bucket `chinese-invoices` exists and is private
- [ ] Storage bucket `chinese-po-files` exists and is private
- [ ] Storage policies allow authenticated uploads/downloads
- [ ] Triggers for auto-updating `updated_at` timestamps in place

## Using the Feature

### Backend: API Endpoints

```bash
# Upload invoice
POST /api/purchase-orders/{poId}/chinese-invoices

# Get invoices for PO
GET /api/purchase-orders/{poId}/chinese-invoices

# Delete invoice
DELETE /api/purchase-orders/{poId}/chinese-invoices/{invoiceId}

# Update internal notes
PATCH /api/purchase-orders/{poId}
```

## Using the Features

### Backend: API Endpoints

```bash
# Upload invoice
POST /api/purchase-orders/{poId}/chinese-invoices

# Get invoices for PO
GET /api/purchase-orders/{poId}/chinese-invoices

# Delete invoice
DELETE /api/purchase-orders/{poId}/chinese-invoices/{invoiceId}

# Upload Chinese PO file
POST /api/purchase-orders/{poId}/chinese-po-files

# Get PO files
GET /api/purchase-orders/{poId}/chinese-po-files

# Delete PO file
DELETE /api/purchase-orders/{poId}/chinese-po-files/{fileId}

# Update internal notes
PATCH /api/purchase-orders/{poId}
```

### Frontend: Quick Integration Examples

**Chinese Invoices:**
```tsx
import { PODetailsChineseInvoices } from '@/components/PODetailsChineseInvoices';

<PODetailsChineseInvoices 
  poId={po.id}
  poNumber={po.po_number}
  currentInternalNotes={po.internal_notes}
  onInternalNotesUpdate={(notes) => {
    // Handle update
  }}
/>
```

**Chinese PO Files (New):**
```tsx
import { ChinesePOFiles } from '@/components/ChinesePOFiles';

<ChinesePOFiles 
  poId={po.id}
  poNumber={po.po_number}
/>
```

**Both Together on PO Detail Page:**
```tsx
export default function PODetailsPage({ po }: { po: PurchaseOrder }) {
  return (
    <div className="space-y-6">
      {/* PO Details */}
      <div>PO #{po.po_number}</div>
      
      {/* Internal Notes + Chinese Invoices */}
      <PODetailsChineseInvoices
        poId={po.id}
        poNumber={po.po_number}
        currentInternalNotes={po.internal_notes}
      />
      
      {/* Chinese PO Files */}
      <ChinesePOFiles
        poId={po.id}
        poNumber={po.po_number}
      />
    </div>
  );
}
```

## Rollback (if needed)

If you need to roll back, you can drop the tables:

```sql
DROP TABLE IF EXISTS chinese_po_files CASCADE;
DROP TABLE IF EXISTS chinese_invoices CASCADE;
ALTER TABLE purchase_orders DROP COLUMN IF EXISTS internal_notes;
```

## Support

- See `docs/CHINESE_INVOICES.md` for complete documentation
- See component files in `src/components/` for usage examples
- Type definitions in `src/types/chinese-invoices.ts`

## Next Steps

1. ✅ Commit to git (done)
2. ✅ Push to GitHub (done)
3. → Run migrations in Supabase (you are here)
4. → Deploy Next.js frontend to your hosting
5. → Test the feature with drag-and-drop uploads
