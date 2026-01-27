import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch } from "@/lib/qbo";

interface RepSales {
  repName: string;
  totalSales: number;
  invoiceCount: number;
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status") || "paid";

    // Build the QuickBooks query
    let query = "SELECT * FROM Invoice";
    const conditions: string[] = [];

    if (startDate) {
      conditions.push(`TxnDate >= '${startDate}'`);
    }
    if (endDate) {
      conditions.push(`TxnDate <= '${endDate}'`);
    }
    
    if (status.toLowerCase() === "paid") {
      conditions.push("Balance = '0'");
    } else if (status.toLowerCase() === "unpaid") {
      conditions.push("Balance > '0'");
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDERBY TxnDate DESC MAXRESULTS 1000";

    const data = await authorizedQboFetch<any>(
      `/query?query=${encodeURIComponent(query)}&minorversion=65`
    );

    const invoices = data?.QueryResponse?.Invoice || [];
    
    // Group by rep name - simple aggregation
    const repMap = new Map<string, { totalSales: number; invoiceCount: number }>();

    for (const invoice of invoices) {
      let repName = "Unassigned";
      
      // Try custom field first
      if (invoice.CustomField && Array.isArray(invoice.CustomField)) {
        const repField = invoice.CustomField.find((f: any) => 
          f.Name === "Sales Rep" || f.Name === "SalesRep" || f.Name === "Rep"
        );
        if (repField && repField.StringValue) {
          repName = repField.StringValue.trim();
        }
      }
      
      // Fall back to customer memo
      if (repName === "Unassigned" && invoice.CustomerMemo?.value) {
        const memo = invoice.CustomerMemo.value;
        const repMatch = memo.match(/Rep:\s*([A-Za-z\s/]+)/i);
        if (repMatch) {
          repName = repMatch[1].trim();
        }
      }

      const totalAmount = Number(invoice.TotalAmt) || 0;
      const balance = Number(invoice.Balance) || 0;
      const paidAmount = totalAmount - balance;

      if (!repMap.has(repName)) {
        repMap.set(repName, { totalSales: 0, invoiceCount: 0 });
      }

      const entry = repMap.get(repName)!;
      entry.totalSales += paidAmount;
      entry.invoiceCount += 1;
      
      console.log(`[sales-by-rep] Invoice ${invoice.DocNumber}: rep=${repName}, paid=$${paidAmount}`);
    }

    // Convert to array and sort by sales
    const repSales: RepSales[] = Array.from(repMap.entries())
      .map(([repName, { totalSales, invoiceCount }]) => ({
        repName,
        totalSales,
        invoiceCount,
      }))
      .sort((a, b) => b.totalSales - a.totalSales);

    return NextResponse.json({
      ok: true,
      reps: repSales,
      totalInvoices: invoices.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch sales by rep" },
      { status: 500 }
    );
  }
}
