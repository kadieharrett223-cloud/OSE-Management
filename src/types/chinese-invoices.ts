// Type definitions for Chinese Invoices feature

export type ChineseInvoicePaymentStatus = 
  | 'RECEIVED' 
  | 'PROCESSED' 
  | 'PAID'
  | string;

export type ChineseInvoiceCurrency = 
  | 'CNY'
  | 'USD'
  | 'EUR'
  | string;

export interface ChineseInvoice {
  id: string;
  created_at: string;
  updated_at: string;
  purchase_order_id: string;
  invoice_number: string;
  invoice_date: string; // YYYY-MM-DD
  factory_name: string | null;
  total_amount: number | null;
  currency: ChineseInvoiceCurrency;
  payment_status: ChineseInvoicePaymentStatus;
  invoice_file_path: string;
  file_name: string | null;
  file_size: number | null;
  file_mime_type: string | null;
  file_uploaded_at: string | null;
  notes: string | null;
  created_by_user_id: string | null;
}

export interface CreateChineseInvoiceInput {
  invoice_number: string;
  invoice_date?: string;
  factory_name?: string;
  total_amount?: number;
  currency?: ChineseInvoiceCurrency;
  payment_status?: ChineseInvoicePaymentStatus;
  notes?: string;
}

export interface UpdateChineseInvoiceInput {
  invoice_date?: string;
  factory_name?: string;
  total_amount?: number;
  currency?: ChineseInvoiceCurrency;
  payment_status?: ChineseInvoicePaymentStatus;
  notes?: string;
}

export interface PurchaseOrderWithInvoices {
  id: string;
  po_number: string;
  vendor_name: string;
  order_date: string;
  status: string;
  total_amount: number;
  internal_notes: string | null;
  chinese_invoices?: ChineseInvoice[];
  lines?: PurchaseOrderLine[];
  payments?: PurchaseOrderPayment[];
}

export interface PurchaseOrderLine {
  id: string;
  purchase_order_id: string;
  line_number: number;
  sku: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface PurchaseOrderPayment {
  id: string;
  purchase_order_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
}

export interface UploadInvoiceResponse {
  ok: boolean;
  data: ChineseInvoice;
  message: string;
}

export interface FetchInvoicesResponse {
  ok: boolean;
  data: ChineseInvoice[];
}
