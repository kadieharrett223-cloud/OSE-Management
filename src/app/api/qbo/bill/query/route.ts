import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch, QboApiError } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status"); // "Paid", "Unpaid", etc.

    let query = "SELECT * FROM Bill";
    const conditions: string[] = [];

    if (startDate) {
      conditions.push(`TxnDate >= '${startDate}'`);
    }
    if (endDate) {
      conditions.push(`TxnDate <= '${endDate}'`);
    }
    if (status) {
      if (status.toLowerCase() === "paid") {
        conditions.push("Balance = '0'");
      } else if (status.toLowerCase() === "unpaid") {
        conditions.push("Balance > '0'");
      }
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDERBY DueDate DESC";

    const data = await authorizedQboFetch<any>(
      `/query?query=${encodeURIComponent(query)}&minorversion=65`,
      {},
      userId || undefined
    );

    const bills = data?.QueryResponse?.Bill || [];

    const totalAmount = bills.reduce((sum: number, bill: any) => {
      return sum + (Number(bill.TotalAmt) || 0);
    }, 0);

    const totalBalance = bills.reduce((sum: number, bill: any) => {
      return sum + (Number(bill.Balance) || 0);
    }, 0);

    return NextResponse.json({
      ok: true,
      bills,
      count: bills.length,
      totalAmount,
      totalBalance,
    });
  } catch (error: any) {
    if (error instanceof QboApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to query bills" },
      { status: 500 }
    );
  }
}
