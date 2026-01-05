-- Fix RLS policies for invoices table

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Invoices: Allow all for authenticated users" ON invoices;

-- Create simple allow-all policy for development
CREATE POLICY "Allow all access to invoices" ON invoices
  FOR ALL USING (TRUE) WITH CHECK (TRUE);
