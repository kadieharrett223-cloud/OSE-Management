-- Add wholesaler relationship to invoices

ALTER TABLE invoices 
ADD COLUMN wholesaler_id UUID REFERENCES wholesalers(id) ON DELETE SET NULL;

CREATE INDEX idx_invoices_wholesaler_id ON invoices(wholesaler_id);

-- Add payment status tracking
ALTER TABLE invoices
ADD COLUMN payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'partial'));

CREATE INDEX idx_invoices_payment_status ON invoices(payment_status);
