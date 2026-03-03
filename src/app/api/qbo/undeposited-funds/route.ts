import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch, QboApiError } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();

    // Query for payments that have not been deposited yet
    // Undeposited funds are payments where DepositToAccountRef is empty or null
    const query = "SELECT * FROM Payment WHERE DepositToAccountRef IS NULL ORDERBY TxnDate DESC";

    const data = await authorizedQboFetch<any>(
      `/query?query=${encodeURIComponent(query)}&minorversion=65`,
      {},
      userId || undefined
    );

    const payments = data?.QueryResponse?.Payment || [];

    // Sum up the applied amounts (money that's arrived but not yet deposited)
    const undeposited = payments.reduce((sum: number, payment: any) => {
      const total = Number(payment.TotalAmt) || 0;
      const unapplied = Number(payment.UnappliedAmt) || 0;
      const applied = Math.max(total - unapplied, 0);
      return sum + applied;
    }, 0);

    return NextResponse.json({
      ok: true,
      payments,
      count: payments.length,
      undeposited,
    });
  } catch (error: any) {
    if (error instanceof QboApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to query undeposited funds" },
      { status: 500 }
    );
  }
}
