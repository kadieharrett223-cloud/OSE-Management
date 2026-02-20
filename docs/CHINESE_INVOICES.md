# Chinese Invoices & Internal Notes Feature

## Overview

This feature allows you to:
1. **Track Chinese factory invoices** - Upload one or more invoices per Purchase Order
2. **Add internal notes** - Store internal notes on POs for team communication
3. **Drag-and-drop uploads** - Easily upload invoice PDFs and images
4. **File management** - Download and delete invoices as needed

## Database Schema

### Migration 036: Internal Notes
- Adds `internal_notes` column to `purchase_orders` table
- Full-text search index for finding notes
- RLS policies for authenticated access

### Migration 037: Chinese Invoices Log
- Creates `chinese_invoices` table
- Fields:
  - `id`: UUID primary key
  - `purchase_order_id`: Link to PO (cascade delete)
  - `invoice_number`: Unique invoice ID (text)
  - `invoice_date`: Date of invoice
  - `factory_name`: Name of supplying factory
  - `total_amount`: Amount in specified currency
  - `currency`: Defaults to CNY (Chinese Yuan)
  - `payment_status`: RECEIVED, PROCESSED, PAID, etc.
  - `invoice_file_path`: Path in Supabase storage
  - `notes`: Internal notes about specific invoice
  - `created_by_user_id`: Audit trail
  - Timestamps: `created_at`, `updated_at`

### Migration 038: File Metadata
Enhances invoices with:
- `file_name`: Original filename
- `file_size`: Size in bytes
- `file_mime_type`: MIME type (pdf, image/png, etc.)
- `file_uploaded_at`: Upload timestamp

### Migration 039: Storage Bucket
- Creates 'chinese-invoices' storage bucket
- Policies for authenticated users to read, write, update, and delete

## API Endpoints

### Upload Chinese Invoice
```
POST /api/purchase-orders/{poId}/chinese-invoices
Content-Type: multipart/form-data

Fields:
- file (File) - required
- poId (string) - required
- invoiceNumber (string) - required
- invoiceDate (string, YYYY-MM-DD)
- factoryName (string)
- totalAmount (number)

Response: { ok: true, data: invoice_record }
```

### Get Invoices for PO
```
GET /api/purchase-orders/{poId}/chinese-invoices

Response: { ok: true, data: [invoice_records] }
```

### Delete Invoice
```
DELETE /api/purchase-orders/{poId}/chinese-invoices/{invoiceId}

Response: { ok: true, message: "Invoice deleted" }
```

### Update Internal Notes
```
PATCH /api/purchase-orders/{poId}
Content-Type: application/json

Body: { internal_notes: "Your notes here..." }

Response: { ok: true, data: updated_po }
```

## React Components

### ChineseInvoiceUploader
Drag-and-drop file uploader for Chinese invoices.

```tsx
import { ChineseInvoiceUploader } from '@/components/ChineseInvoiceUploader';

<ChineseInvoiceUploader 
  poId={poId}
  onUploadComplete={(invoice) => {
    // Handle upload completion
    console.log('Invoice uploaded:', invoice);
  }}
/>
```

**Features:**
- Drag & drop interface
- File picker fallback
- Invoice metadata form (number, date, factory, amount)
- Real-time upload status
- Success/error messaging

**Accepted files:** PDF, PNG, JPG, JPEG, GIF, WEBP

### ChineseInvoicesList
Displays list of uploaded invoices with actions.

```tsx
import { ChineseInvoicesList } from '@/components/ChineseInvoicesList';

<ChineseInvoicesList 
  poId={poId}
  refreshTrigger={refreshCount}
/>
```

**Features:**
- List all invoices for a PO
- Download files to local machine
- View invoice metadata (date, factory, amount)
- Delete invoices
- Payment status badges
- File size display

### PODetailsChineseInvoices
Complete integration component combining uploader, list, and internal notes.

```tsx
import { PODetailsChineseInvoices } from '@/components/PODetailsChineseInvoices';

<PODetailsChineseInvoices 
  poId={poId}
  poNumber={poNumber}
  currentInternalNotes={notes}
  onInternalNotesUpdate={(newNotes) => {
    // Handle notes update
  }}
/>
```

**Features:**
- Inline note editor with save
- Upload interface
- Invoice list with management
- All-in-one PO details view

## Implementation Example

Add to your PO details page:

```tsx
// pages/purchase-orders/[id].tsx
import { PODetailsChineseInvoices } from '@/components/PODetailsChineseInvoices';

export default function PODetailsPage({ po }: { po: PurchaseOrder }) {
  return (
    <div className="space-y-6">
      {/* Existing PO details */}
      <div>PO #{po.po_number}</div>
      
      {/* Chinese Invoices & Notes */}
      <PODetailsChineseInvoices
        poId={po.id}
        poNumber={po.po_number}
        currentInternalNotes={po.internal_notes}
        onInternalNotesUpdate={(notes) => {
          // Optionally refresh PO data
        }}
      />
    </div>
  );
}
```

## File Storage

- **Bucket:** `chinese-invoices`
- **Organization:** `{poId}/{invoiceNumber}/{timestamp}-{originalFilename}`
- **Access:** Authenticated users only
- **Size Limit:** Configurable in Supabase settings

## Payment Status Options

- `RECEIVED` - Invoice received from factory (default)
- `PROCESSED` - Invoice processed/reviewed
- `PAID` - Payment made to factory
- Custom status as needed

## Security

- **Authentication:** All endpoints require authenticated user session
- **Row Level Security:** Supabase RLS policies enforce access control
- **File Upload:** 
  - Server-side file validation
  - MIME type checking
  - Virus scanning available via Supabase integrations
- **Audit Trail:** `created_by_user_id` tracks who uploaded each invoice

## Notes

1. **One-to-Many Relationship:** One PO can have multiple Chinese invoices (typically 1-2)
2. **Cascade Delete:** Deleting a PO automatically deletes associated invoices
3. **File Cleanup:** Deleting an invoice removes the file from storage
4. **Full-Text Search:** Internal notes are indexed for quick searching
5. **Timestamps:** All records include creation and update timestamps for audit purposes
