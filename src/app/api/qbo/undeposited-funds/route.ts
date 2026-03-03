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

    // Fetch both paid invoices and payments for today to get total customer payments received
    const [invoiceRes, paymentRes, undepositedRes] = await Promise.all([
      authorizedQboFetch<any>(
        `/query?query=${encodeURIComponent(`SELECT * FROM Invoice WHERE TxnDate = '${today}' AND Balance = 0`)}`,
        {},
        userId || undefined
      ),
      authorizedQboFetch<any>(
        `/query?query=${encodeURIComponent(`SELECT * FROM Payment WHERE TxnDate = '${today}'`)}`,
        {},
        userId || undefined
      ),
      authorizedQboFetch<any>(
        `/query?query=${encodeURIComponent("SELECT * FROM Account WHERE Name = 'Undeposited Funds'")}`,
        {},
        userId || undefined
      ),
    ]);

    const paidByInvoiceId = new Map<string, number>();
    let totalApplied = 0;

    // Process paid invoices (balance = 0)
    const invoices = invoiceRes?.QueryResponse?.Invoice || [];
    invoices.forEach((inv: any) => {
      const invoiceId = String(inv?.Id || "");
      if (!invoiceId) return;
      const total = Number(inv?.TotalAmt) || 0;
      const paid = total;
      if (paid > 0) {
        paidByInvoiceId.set(invoiceId, paid);
        totalApplied += paid;
      }
    });

    // Process payments
    const payments = paymentRes?.QueryResponse?.Payment || [];
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
        if (invoiceLinks.length === 0) return;
        linkedAmount += lineAmount;
      });

      const unlinkedApplied = Math.max(applied - linkedAmount, 0);
      totalApplied += unlinkedApplied;
      totalApplied += Math.min(linkedAmount, applied);
    });

    // Get undeposited funds balance
    const accounts = undepositedRes?.QueryResponse?.Account || [];
    const undepositedAccount = accounts[0];
    const undeposited = undepositedAccount ? Number(undepositedAccount.CurrentBalance || 0) : 0;

    return NextResponse.json({
      ok: true,
      todaySalesTotal: totalApplied,
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
