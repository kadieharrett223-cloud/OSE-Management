import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch } from "@/lib/qbo";

// Returns paid invoice totals grouped by month between startDate and endDate (inclusive)
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  }

  try {
    let query = "SELECT * FROM Invoice";
    const conditions: string[] = [];

    conditions.push(`TxnDate >= '${startDate}'`);
    conditions.push(`TxnDate <= '${endDate}'`);
    // Paid invoices only
    conditions.push("Balance = '0'");

    query += " WHERE " + conditions.join(" AND ");
    query += " ORDERBY TxnDate ASC";

    const data = await authorizedQboFetch<any>(
      `/query?query=${encodeURIComponent(query)}&minorversion=65`
    );

    const invoices = data?.QueryResponse?.Invoice || [];

    const monthlyPaid: Record<string, number> = {};

    invoices.forEach((inv: any) => {
      const date = inv?.TxnDate;
      if (!date) return;
      const [year, month] = date.split("-");
      const key = `${year}-${month}`; // YYYY-MM
      const total = Number(inv.TotalAmt) || 0;
      const balance = Number(inv.Balance) || 0;
      const paid = total - balance;
      monthlyPaid[key] = (monthlyPaid[key] || 0) + (paid > 0 ? paid : 0);
    });

    return NextResponse.json({ ok: true, monthlyPaid, count: invoices.length });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load monthly invoices" }, { status: 500 });
  }
}
