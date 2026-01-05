import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase';
import { calculateCommissionForInvoice } from '@/lib/commissions';

/**
 * POST /api/sync/qbo
 * 
 * Server-side QuickBooks Online invoice sync.
 * Called by cron job every 2-5 minutes.
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
    // Verify cron secret or admin auth
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();

    // TODO: Implement QBO OAuth token refresh
    // const qboAccessToken = await refreshQBOToken();

    // TODO: Fetch invoices from QBO API
    // For now, return placeholder
    const mockQBOInvoices = [
      {
        Id: 'qbo-inv-001',
        DocNumber: '2024-001',
        TxnDate: '2024-01-15',
        TotalAmt: 10000,
        Line: [
          {
            Id: '1',
            LineNum: 1,
            SalesItemLineDetail: {
              ItemRef: { name: 'SKU-001' },
              Qty: 10,
              UnitPrice: 100,
            },
            Amount: 1000,
          },
        ],
        CustomField: [
          { DefinitionId: 'SalesRep', StringValue: 'John Smith' },
        ],
      },
    ];

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

    for (const qboInv of mockQBOInvoices) {
      const salesRepName = qboInv.CustomField?.find((f: any) => f.DefinitionId === 'SalesRep')?.StringValue;
      const rep = repByName.get(salesRepName || '');

      if (!rep) {
        console.warn(`No rep found for invoice ${qboInv.DocNumber}, Sales Rep: ${salesRepName}`);
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
        const commissionAmount = commissionableAmount * rep.commission_rate;

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
            rep_id: rep.id,
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

      // Track affected rep/month for snapshot update
      const txnDate = new Date(qboInv.TxnDate);
      affectedRepMonths.add(`${rep.id}|${txnDate.getFullYear()}|${txnDate.getMonth() + 1}`);
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
  } catch (error) {
    console.error('QBO sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

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
