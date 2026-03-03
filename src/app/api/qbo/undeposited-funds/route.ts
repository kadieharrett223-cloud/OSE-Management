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

    // Fetch paid invoices and calculate amount paid today
    const invoiceQuery = `SELECT TxnDate, TotalAmt, Balance, Id, CustomerRef FROM Invoice WHERE TxnDate = '${today}'`;
    const invoiceResult = await authorizedQboFetch<any>(
      `/query?query=${encodeURIComponent(invoiceQuery)}&minorversion=65`,
      {},
      userId || undefined
    );

    const invoices = invoiceResult?.QueryResponse?.Invoice || [];
    let paidInvoicesTotal = 0;
    const paidByInvoiceId = new Map<string, number>();

    invoices.forEach((inv: any) => {
      const invoiceId = String(inv?.Id || "");
      if (!invoiceId) return;
      const total = Number(inv?.TotalAmt) || 0;
      const balance = Number(inv?.Balance) || 0;
      const paid = Math.max(total - balance, 0);
      if (paid > 0) {
        paidByInvoiceId.set(invoiceId, paid);
        paidInvoicesTotal += paid;
      }
    });

    // Fetch payments for today
    const paymentQuery = `SELECT * FROM Payment WHERE TxnDate = '${today}'`;
    const paymentResult = await authorizedQboFetch<any>(
      `/query?query=${encodeURIComponent(paymentQuery)}&minorversion=65`,
      {},
      userId || undefined
    );

    const payments = paymentResult?.QueryResponse?.Payment || [];
    let paymentsTotal = 0;

    payments.forEach((payment: any) => {
      const total = Number(payment?.TotalAmt) || 0;
      const unapplied = Number(payment?.UnappliedAmt) || 0;
      const applied = Math.max(total - unapplied, 0);
      if (applied <= 0) return;

      let linkedAmount = 0;
      const lines = Array.isArray(payment?.Line) ? payment.Line : [];
      
      lines.forEach((line: any) => {
        const lineAmount = Number(line?.Amount) || 0;
        const linked = Array.isArray(line?.LinkedTxn) ? line.LinkedTxn : [];
        const invoiceLinks = linked.filter((txn: any) => txn?.TxnType === "Invoice" && txn?.TxnId);
        
        if (invoiceLinks.length > 0) {
          linkedAmount += lineAmount;
        }
      });

      const unlinkedApplied = Math.max(applied - linkedAmount, 0);
      paymentsTotal += unlinkedApplied;
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

    const todaySalesTotal = paidInvoicesTotal + paymentsTotal;

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
      { error: error.message || "Failed to query payments and funds" },
      { status: 500 }
    );
  }
}
