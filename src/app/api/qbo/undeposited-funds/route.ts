import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch, QboApiError } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";

const toYmdLocal = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const today = toYmdLocal(new Date());

    // Fetch paid invoices for today (same as dashboard "Sales Today")
    const invoiceQuery = `SELECT * FROM Invoice WHERE TxnDate = '${today}' AND Balance = 0 ORDERBY TxnDate DESC`;
    const invoiceResult = await authorizedQboFetch<any>(
      `/query?query=${encodeURIComponent(invoiceQuery)}&minorversion=65`,
      {},
      userId || undefined
    );

    const invoices = invoiceResult?.QueryResponse?.Invoice || [];
    let todaySalesTotal = 0;

    invoices.forEach((inv: any) => {
      const total = Number(inv?.TotalAmt) || 0;
      const balance = Number(inv?.Balance) || 0;
      const paid = Math.max(total - balance, 0);
      if (paid > 0) {
        todaySalesTotal += paid;
      }
    });

    // Fetch undeposited funds account balance
    const accountQuery = "SELECT * FROM Account WHERE Name = 'Undeposited Funds'";
    const accountResult = await authorizedQboFetch<any>(
      `/query?query=${encodeURIComponent(accountQuery)}&minorversion=65`,
      {},
      userId || undefined
    );

    const accounts = accountResult?.QueryResponse?.Account || [];
    const undepositedAccount = accounts[0];
    const undeposited = undepositedAccount ? Number(undepositedAccount.CurrentBalance || 0) : 0;

    return NextResponse.json({
      ok: true,
      todaySalesTotal,
      undeposited,
    });
  } catch (error: any) {
    if (error instanceof QboApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to query sales and funds" },
      { status: 500 }
    );
  }
}
