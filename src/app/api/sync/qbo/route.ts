import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase';
import { calculateCommissionForInvoice } from '@/lib/commissions';
import { authorizedQboFetch } from '@/lib/qbo';
import { isSalaryRep } from '@/lib/repAliases';

/**
 * POST /api/sync/qbo
 * 
 * Server-side QuickBooks Online invoice sync.
 * Called by cron job every 2-5 minutes or manually via Refresh button.
 * 
 * Steps:
 * 1. Fetch invoices from QBO (server-side OAuth)
 * 2. For each invoice:
 *    - Match to rep by Sales Rep field
 *    - Calculate commission per line using price_list_items
 *    - Upsert invoice + lines to Supabase
 * 3. Recompute commission_snapshots for affected reps/months
 * 
 * Security: Requires admin auth or cron secret
 */
export async function POST(request: Request) {
  try {
    const supabase = getServerSupabaseClient();

    // Fetch real invoices from QBO
    let qboInvoices: any[] = [];
    try {
      const query = "SELECT * FROM Invoice";
      const response = await authorizedQboFetch<any>(
        `/query?query=${encodeURIComponent(query)}&minorversion=65`
      );
      qboInvoices = response.QueryResponse?.Invoice || [];
    } catch (error: any) {
      console.error('QBO query failed:', error);
      return NextResponse.json(
        { error: `QBO query failed: ${error.message}` },
        { status: 500 }
      );
    }

    // Fetch all reps and price list items
    const { data: reps, error: repsError } = await supabase
      .from('reps')
      .select('*')
      .eq('is_active', true);

    if (repsError) throw repsError;

    const { data: priceList, error: priceListError } = await supabase
      .from('price_list_items')
      .select('*');

    if (priceListError) throw priceListError;

    const repByName = new Map(reps?.map((r: any) => [r.rep_name, r]) || []);
    const priceMap = new Map(priceList?.map((p: any) => [p.sku, p]) || []);

    let syncedCount = 0;
    const affectedRepMonths = new Set<string>();

    for (const qboInv of qboInvoices) {
      let salesRepName = "";
      
      if (qboInv.CustomField && Array.isArray(qboInv.CustomField)) {
        const repField = qboInv.CustomField.find((f: any) => 
          f.Name === "Sales Rep" || f.Name === "SalesRep" || f.Name === "Rep"
        );
        if (repField && repField.StringValue) {
          salesRepName = repField.StringValue.trim();
        }
      }
      
      if (!salesRepName && qboInv.CustomerMemo?.value) {
        const memo = qboInv.CustomerMemo.value;
        const repMatch = memo.match(/Rep:\s*([A-Za-z\s/]+)/i);
        if (repMatch) {
          salesRepName = repMatch[1].trim();
        }
      }
      
      // Handle split reps: extract commission rep (non-salary rep)
      let commissionRepName = salesRepName;
      
      if (salesRepName.includes('/')) {
        const parts = salesRepName.split('/').map((p: string) => p.trim());
        // Find the non-salary rep (commission rep)
        const nonSalaryRep = parts.find((p: string) => !isSalaryRep(p));
        if (nonSalaryRep) {
          commissionRepName = nonSalaryRep;
        } else {
          // Both are salary reps - shouldn't happen but use first as fallback
          commissionRepName = parts[0];
        }
      }
      
      const commissionRep = repByName.get(commissionRepName || '');
      const goalRep = repByName.get(goalRepName || '');
      
      if (!commissionRep) {
        console.warn(`No rep found for invoice ${qboInv.DocNumber}, Sales Rep: ${commissionRepName}`);
        continue;
      }

      // Calculate commission for each line
      const lines = qboInv.Line.map((line: any) => {
        const sku = line.SalesItemLineDetail?.ItemRef?.name || '';
        const qty = line.SalesItemLineDetail?.Qty || 0;
        const unitPrice = line.SalesItemLineDetail?.UnitPrice || 0;
        const priceItem = priceMap.get(sku);

        const shippingDeducted = priceItem ? qty * priceItem.shipping_included_per_unit : 0;
        const commissionableAmount = Math.max(0, line.Amount - shippingDeducted);
        const commissionAmount = commissionableAmount * commissionRep.commission_rate;

        return {
          qbo_line_id: line.Id,
          line_num: line.LineNum,
          sku,
          description: line.Description || '',
          quantity: qty,
          unit_price: unitPrice,
          line_total: line.Amount,
          shipping_deducted: shippingDeducted,
          commissionable_amount: commissionableAmount,
          commission_amount: commissionAmount,
          sku_match_status: priceItem ? 'MATCHED' : 'NEEDS_MAPPING',
        };
      });

      const commissionTotal = lines.reduce((sum: number, l: any) => sum + l.commission_amount, 0);
      const commissionableTotal = lines.reduce((sum: number, l: any) => sum + l.commissionable_amount, 0);
      const shippingDeductedTotal = lines.reduce((sum: number, l: any) => sum + l.shipping_deducted, 0);

      // Upsert invoice
      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .upsert(
          {
            qbo_invoice_id: qboInv.Id,
            invoice_number: qboInv.DocNumber,
            rep_id: commissionRep.id,
            txn_date: qboInv.TxnDate,
            total_amount: qboInv.TotalAmt,
            commission_total: commissionTotal,
            commissionable_total: commissionableTotal,
            shipping_deducted_total: shippingDeductedTotal,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'qbo_invoice_id' }
        )
        .select()
        .single();

      if (invError) throw invError;

      // Delete existing lines and insert new
      await supabase.from('invoice_lines').delete().eq('invoice_id', invoice.id);

      const { error: linesError } = await supabase
        .from('invoice_lines')
        .insert(lines.map((l: any) => ({ ...l, invoice_id: invoice.id })));

      if (linesError) throw linesError;

      syncedCount++;

      // Track affected rep/month for snapshot update (both commission and goal reps)
      const txnDate = new Date(qboInv.TxnDate);
      const year = txnDate.getFullYear();
      const month = txnDate.getMonth() + 1;
      affectedRepMonths.add(`${commissionRep.id}|${year}|${month}`);
      if (goalRep.id !== commissionRep.id) {
        affectedRepMonths.add(`${goalRep.id}|${year}|${month}`);
      }
    }

    // Recompute commission snapshots for affected rep/months
    for (const key of affectedRepMonths) {
      const [repId, year, month] = key.split('|');
      await recomputeCommissionSnapshot(supabase, repId, parseInt(year), parseInt(month));
    }

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      affectedSnapshots: affectedRepMonths.size,
    });
    @@      // Track affected rep/month for snapshot update
    @@      const txnDate = new Date(qboInv.TxnDate);
    @@      const year = txnDate.getFullYear();
    @@      const month = txnDate.getMonth() + 1;
    @@      affectedRepMonths.add(`${commissionRep.id}|${year}|${month}`);

async function recomputeCommissionSnapshot(
  supabase: any,
  repId: string,
  year: number,
  month: number
) {
  // Query all invoices for this rep/month
  const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('rep_id', repId)
    .gte('txn_date', startDate)
    .lte('txn_date', endDate);

  if (error) throw error;

  const totalCommission = invoices?.reduce((sum: number, inv: any) => sum + parseFloat(inv.commission_total), 0) || 0;
  const totalCommissionable = invoices?.reduce((sum: number, inv: any) => sum + parseFloat(inv.commissionable_total), 0) || 0;
  const totalShippingDeducted = invoices?.reduce((sum: number, inv: any) => sum + parseFloat(inv.shipping_deducted_total), 0) || 0;
  const invoiceCount = invoices?.length || 0;

  // Upsert snapshot
  const { error: snapError } = await supabase.from('commission_snapshots').upsert(
    {
      rep_id: repId,
      year,
      month,
      total_commission: totalCommission,
      total_commissionable: totalCommissionable,
      total_shipping_deducted: totalShippingDeducted,
      invoice_count: invoiceCount,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: 'rep_id,year,month' }
  );

  if (snapError) throw snapError;
}
