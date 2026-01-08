import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch } from "@/lib/qbo";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build the QuickBooks query for payments by payment date
    let query = "SELECT * FROM Payment";
    const conditions: string[] = [];

    if (startDate) {
      conditions.push(`TxnDate >= '${startDate}'`);
    }
    if (endDate) {
      conditions.push(`TxnDate <= '${endDate}'`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDERBY TxnDate DESC";

    const data = await authorizedQboFetch<any>(
      `/query?query=${encodeURIComponent(query)}&minorversion=65`
    );

    const payments = data?.QueryResponse?.Payment || [];

    // Calculate totals (applied amount only)
    const totalAmount = payments.reduce((sum: number, payment: any) => {
      return sum + (Number(payment.TotalAmt) || 0);
    }, 0);

    const totalApplied = payments.reduce((sum: number, payment: any) => {
      const total = Number(payment.TotalAmt) || 0;
      const unapplied = Number(payment.UnappliedAmt) || 0;
      const applied = total - unapplied;
      return sum + (applied > 0 ? applied : 0);
    }, 0);

    return NextResponse.json({
      ok: true,
      payments,
      count: payments.length,
      totalAmount,
      totalApplied,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to query payments" },
      { status: 500 }
    );
  }
}
