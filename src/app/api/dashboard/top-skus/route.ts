import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const supabase = getServerSupabaseClient();
  
  try {
    // Get last 12 months of invoice data with line items
    // Don't filter by sku_match_status to get all SKUs
    const { data, error } = await supabase
      .from("invoices")
      .select(`
        txn_date,
        invoice_lines(
          sku,
          quantity,
          description,
          sku_match_status
        )
      `)
      .gte("txn_date", new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0])
      .order("txn_date", { ascending: false });

    if (error) throw error;

    // Aggregate by month and SKU
    const monthlySkuMap = new Map<string, Map<string, { quantity: number; description: string }>>();

    (data || []).forEach((invoice: any) => {
      const date = new Date(invoice.txn_date);
      const yearMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!monthlySkuMap.has(yearMonth)) {
        monthlySkuMap.set(yearMonth, new Map());
      }

      const skuMap = monthlySkuMap.get(yearMonth)!;
      
      (invoice.invoice_lines || []).forEach((line: any) => {
        // Include all SKUs, not just MATCHED ones
        if (line.sku && line.sku.trim()) {
          const existing = skuMap.get(line.sku) || { quantity: 0, description: line.description || "" };
          existing.quantity += Number(line.quantity) || 0;
          skuMap.set(line.sku, existing);
        }
      });
    });

    // Convert to array format and get top 10 for each month
    const result = Array.from(monthlySkuMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0])) // Sort months descending
      .map(([month, skuMap]) => {
        const topSkus = Array.from(skuMap.entries())
          .map(([sku, data]) => ({
            sku,
            quantity: data.quantity,
            description: data.description,
          }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 10);

        return {
          month,
          topSkus,
        };
      });

    return NextResponse.json({ ok: true, data: result });
  } catch (error: any) {
    console.error("Top SKUs error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch top SKUs" },
      { status: 500 }
    );
  }
}
