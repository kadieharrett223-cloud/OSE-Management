import { NextResponse } from "next/server";
import { authorizedQboFetchDirect } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";

// Returns the combined "received today" total: QBO Payment records + fully-paid
// invoices dated today — deduplicated the same way as the dashboard summary's
// paymentsTotal field.  Replaces the heavier /api/qbo/payment/query for the
// topbar so the two numbers stay in sync.

function toYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET() {
  try {
    const userId = (await getUserId()) || undefined;
    const today = toYmd(new Date());

    const [rPay, rInv] = await Promise.allSettled([
      authorizedQboFetchDirect<any>(
        `/query?query=${encodeURIComponent(
          `SELECT * FROM Payment WHERE TxnDate >= '${today}' AND TxnDate <= '${today}' MAXRESULTS 1000`
        )}&minorversion=65`,
        {},
        userId
      ),
      authorizedQboFetchDirect<any>(
        `/query?query=${encodeURIComponent(
          `SELECT * FROM Invoice WHERE Balance = '0' AND TxnDate >= '${today}' AND TxnDate <= '${today}' MAXRESULTS 500`
        )}&minorversion=65`,
        {},
        userId
      ),
    ]);

    const payments: any[] = rPay.status === "fulfilled" ? (rPay.value?.QueryResponse?.Payment || []) : [];
    const paidInvoices: any[] = rInv.status === "fulfilled" ? (rInv.value?.QueryResponse?.Invoice || []) : [];

    // Deduplicate: paid invoices take priority; payment lines that link to
    // already-counted invoices are skipped to avoid double-counting.
    const counted = new Set<string>();
    let total = 0;

    paidInvoices.forEach((inv: any) => {
      const amount = Number(inv.TotalAmt) || 0;
      if (amount <= 0) return;
      counted.add(String(inv.Id || ""));
      total += amount;
    });

    payments.forEach((payment: any) => {
      const payTotal = Number(payment.TotalAmt) || 0;
      const unapplied = Number(payment.UnappliedAmt) || 0;
      const applied = Math.max(payTotal - unapplied, 0);
      if (applied <= 0) return;

      let linkedAmount = 0;
      for (const line of Array.isArray(payment.Line) ? payment.Line : []) {
        const lineAmount = Number(line.Amount) || 0;
        const invoiceLinks = (Array.isArray(line.LinkedTxn) ? line.LinkedTxn : []).filter(
          (txn: any) => txn.TxnType === "Invoice" && txn.TxnId
        );
        if (!invoiceLinks.length) continue;
        linkedAmount += lineAmount;
        for (const txn of invoiceLinks) {
          const invoiceId = String(txn.TxnId || "");
          if (!invoiceId || counted.has(invoiceId)) continue;
          counted.add(invoiceId);
          total += lineAmount;
        }
      }
      const unlinked = Math.max(applied - linkedAmount, 0);
      if (unlinked > 0) total += unlinked;
    });

    return NextResponse.json({ ok: true, total });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch today's total" },
      { status: 500 }
    );
  }
}
