import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch } from "@/lib/qbo";

interface RepSales {
  repName: string;
  totalSales: number;
  commission: number;
  invoiceCount: number;
  commissionRate: number;
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status") || "paid"; // Default to paid

    // Build the QuickBooks query
    let query = "SELECT * FROM Invoice";
    const conditions: string[] = [];

    if (startDate) {
      conditions.push(`TxnDate >= '${startDate}'`);
    }
    if (endDate) {
      conditions.push(`TxnDate <= '${endDate}'`);
    }
    
    // QuickBooks uses Balance = 0 for paid invoices
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
    
    // Group invoices by sales rep
    const repMap = new Map<string, RepSales>();

    for (const invoice of invoices) {
      // QuickBooks invoice structure has SalesTermRef but sales rep is in custom field or CustomerRef
      // We'll use the CustomerMemo or a custom field to identify the rep
      // For now, we'll check if there's a SalesTermRef or custom field
      
      let repName = "Unassigned";
      
      // Check for sales rep in custom fields
      if (invoice.CustomField && Array.isArray(invoice.CustomField)) {
        const repField = invoice.CustomField.find((f: any) => 
          f.Name === "Sales Rep" || f.Name === "SalesRep" || f.Name === "Rep"
        );
        if (repField && repField.StringValue) {
          repName = repField.StringValue;
        }
      }
      
      // Alternative: Check CustomerMemo for rep name
      if (repName === "Unassigned" && invoice.CustomerMemo?.value) {
        const memo = invoice.CustomerMemo.value;
        // Try to extract rep name from memo if it follows a pattern
        const repMatch = memo.match(/Rep:\s*([A-Za-z\s]+)/i);
        if (repMatch) {
          repName = repMatch[1].trim();
        }
      }

      const totalAmount = Number(invoice.TotalAmt) || 0;
      const balance = Number(invoice.Balance) || 0;
      const paidAmount = totalAmount - balance;

      // Get or create rep entry
      if (!repMap.has(repName)) {
        repMap.set(repName, {
          repName,
          totalSales: 0,
          commission: 0,
          invoiceCount: 0,
          commissionRate: 0.05, // Default 5% - should be fetched from DB
        });
      }

      const repData = repMap.get(repName)!;
      repData.totalSales += paidAmount;
      repData.invoiceCount += 1;
      repData.commission = repData.totalSales * repData.commissionRate;
    }

    // Convert map to array and sort by sales
    const repSales = Array.from(repMap.values()).sort(
      (a, b) => b.totalSales - a.totalSales
    );

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
