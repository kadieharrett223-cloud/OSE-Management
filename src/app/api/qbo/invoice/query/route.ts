import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch } from "@/lib/qbo";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status"); // "Paid", "Unpaid", etc.

    // Build the QuickBooks query
    let query = "SELECT * FROM Invoice";
    const conditions: string[] = [];

    if (startDate) {
      conditions.push(`TxnDate >= '${startDate}'`);
    }
    if (endDate) {
      conditions.push(`TxnDate <= '${endDate}'`);
    }
    if (status) {
      // QuickBooks uses Balance = 0 for paid invoices
      if (status.toLowerCase() === "paid") {
        conditions.push("Balance = '0'");
      } else if (status.toLowerCase() === "unpaid") {
        conditions.push("Balance > '0'");
      }
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDERBY TxnDate DESC";

    const data = await authorizedQboFetch<any>(
      `/query?query=${encodeURIComponent(query)}&minorversion=65`
    );

    const invoices = data?.QueryResponse?.Invoice || [];
    
    // Calculate totals
    const totalAmount = invoices.reduce((sum: number, inv: any) => {
      return sum + (Number(inv.TotalAmt) || 0);
    }, 0);

    const totalPaid = invoices.reduce((sum: number, inv: any) => {
      const balance = Number(inv.Balance) || 0;
      const total = Number(inv.TotalAmt) || 0;
      return sum + (total - balance);
    }, 0);

    return NextResponse.json({
      ok: true,
      invoices,
      count: invoices.length,
      totalAmount,
      totalPaid,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to query invoices" },
      { status: 500 }
    );
  }
}
