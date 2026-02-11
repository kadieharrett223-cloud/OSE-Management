import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch, QboApiError } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const today = new Date();
    const startDate = new Date(today.getFullYear() - 1, today.getMonth(), 1)
      .toISOString()
      .split("T")[0];

    const query = `SELECT * FROM Invoice WHERE TxnDate >= '${startDate}' ORDERBY TxnDate DESC`;

    const data = await authorizedQboFetch<any>(
      `/query?query=${encodeURIComponent(query)}&minorversion=65`,
      {},
      userId || undefined
    );

    const invoices = data?.QueryResponse?.Invoice || [];

    // Aggregate by month and SKU
    const monthlySkuMap = new Map<string, Map<string, { quantity: number; description: string }>>();

    invoices.forEach((invoice: any) => {
      const date = new Date(invoice.TxnDate);
      const yearMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;

      if (!monthlySkuMap.has(yearMonth)) {
        monthlySkuMap.set(yearMonth, new Map());
      }

      const skuMap = monthlySkuMap.get(yearMonth)!;

      (invoice.Line || []).forEach((line: any) => {
        if (line.DetailType !== "SalesItemLineDetail") return;

        const detail = line.SalesItemLineDetail || {};
        const sku = detail.ItemRef?.name || detail.ItemRef?.value || "";
        const quantity = Number(detail.Qty ?? 0);
        if (!sku || !quantity) return;

        const normalizedSku = sku.toLowerCase();
        if (
          normalizedSku.includes("note") ||
          normalizedSku.includes("misc") ||
          normalizedSku.includes("discount") ||
          normalizedSku.includes("shipping")
        ) return;

        const existing = skuMap.get(sku) || { quantity: 0, description: line.Description || "" };
        existing.quantity += quantity;
        skuMap.set(sku, existing);
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
    if (error instanceof QboApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Top SKUs error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch top SKUs" },
      { status: 500 }
    );
  }
}
