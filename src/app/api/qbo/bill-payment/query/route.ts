import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch, QboApiError } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = "SELECT * FROM BillPayment";
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
      `/query?query=${encodeURIComponent(query)}&minorversion=65`,
      {},
      userId || undefined
    );

    const payments = data?.QueryResponse?.BillPayment || [];

    const totalAmount = payments.reduce((sum: number, payment: any) => {
      return sum + (Number(payment.TotalAmt) || 0);
    }, 0);

    return NextResponse.json({
      ok: true,
      payments,
      count: payments.length,
      totalAmount,
    });
  } catch (error: any) {
    if (error instanceof QboApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to query bill payments" },
      { status: 500 }
    );
  }
}
