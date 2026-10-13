import { NextResponse } from "next/server";
import { authorizedQboFetchDirect } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";
import { BUSINESS_TIME_ZONE, toYmdInTimeZone } from "@/lib/business-date";

type PaymentEvent = {
  id: string;
  type: "payment" | "invoice";
  customerName: string;
  amount: number;
  txnDate: string;
  docNumber: string | null;
};

// Returns the combined "received today" total using the same event-level
// calculation as the dashboard summary.

export async function GET() {
  try {
    const userId = (await getUserId()) || undefined;
    const today = toYmdInTimeZone(new Date(), BUSINESS_TIME_ZONE);

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

    const invoicesCoveredByPaymentLinks = new Set<string>();
    const events: PaymentEvent[] = [];
    let total = 0;

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
        invoiceLinks.forEach((txn: any, linkIndex: number) => {
          const invoiceId = String(txn.TxnId || "");
          if (!invoiceId) return;
          invoicesCoveredByPaymentLinks.add(invoiceId);
          total += lineAmount;
          events.push({
            id: `payment:${payment.Id || "unknown"}:${invoiceId}:${linkIndex}`,
            type: "payment",
            customerName: payment.CustomerRef?.name || payment.CustomerRef?.value || "Customer",
            amount: lineAmount,
            txnDate: String(payment.TxnDate || today),
            docNumber: null,
          });
        });
      }
      const unlinked = Math.max(applied - linkedAmount, 0);
      if (unlinked > 0) {
        total += unlinked;
        const paymentId = String(payment.Id || "");
        events.push({
          id: `payment:${paymentId}`,
          type: "payment",
          customerName: payment.CustomerRef?.name || payment.CustomerRef?.value || "Customer",
          amount: unlinked,
          txnDate: String(payment.TxnDate || today),
          docNumber: payment.DocNumber ? String(payment.DocNumber) : null,
        });
      }
    });

    paidInvoices.forEach((invoice: any) => {
      const amount = Number(invoice.TotalAmt) || 0;
      if (amount <= 0) return;
      const invoiceId = String(invoice.Id || "");
      if (invoiceId && invoicesCoveredByPaymentLinks.has(invoiceId)) return;

      total += amount;
      events.push({
        id: `invoice:${invoiceId}`,
        type: "invoice",
        customerName: invoice.CustomerRef?.name || invoice.CustomerRef?.value || "Customer",
        amount,
        txnDate: String(invoice.TxnDate || today),
        docNumber: invoice.DocNumber ? String(invoice.DocNumber) : null,
      });
    });

    return NextResponse.json({ ok: true, total, events });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch today's total" },
      { status: 500 }
    );
  }
}
