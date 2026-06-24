import { NextResponse } from "next/server";
import { authorizedQboFetchDirect } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";
import { BUSINESS_TIME_ZONE, toYmdInTimeZone } from "@/lib/business-date";

type PaymentEvent = {
  id: string;
  type: "payment" | "invoice" | "sales_receipt" | "bill_payment";
  customerName: string;
  amount: number;
  txnDate: string;
  docNumber: string | null;
};

// Returns the combined "received today" total: QBO Payment records + fully-paid
// invoices dated today — deduplicated the same way as the dashboard summary's
// paymentsTotal field.  Replaces the heavier /api/qbo/payment/query for the
// topbar so the two numbers stay in sync.

export async function GET() {
  try {
    const userId = (await getUserId()) || undefined;
    const today = toYmdInTimeZone(new Date(), BUSINESS_TIME_ZONE);

    const [rPay, rInv, rSalesReceipt, rBillPayment] = await Promise.allSettled([
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
      authorizedQboFetchDirect<any>(
        `/query?query=${encodeURIComponent(
          `SELECT * FROM SalesReceipt WHERE TxnDate >= '${today}' AND TxnDate <= '${today}' MAXRESULTS 1000`
        )}&minorversion=65`,
        {},
        userId
      ),
      authorizedQboFetchDirect<any>(
        `/query?query=${encodeURIComponent(
          `SELECT * FROM BillPayment WHERE TxnDate >= '${today}' AND TxnDate <= '${today}' MAXRESULTS 1000`
        )}&minorversion=65`,
        {},
        userId
      ),
    ]);

    const payments: any[] = rPay.status === "fulfilled" ? (rPay.value?.QueryResponse?.Payment || []) : [];
    const paidInvoices: any[] = rInv.status === "fulfilled" ? (rInv.value?.QueryResponse?.Invoice || []) : [];
    const salesReceiptsRaw: any[] = rSalesReceipt.status === "fulfilled" ? (rSalesReceipt.value?.QueryResponse?.SalesReceipt || []) : [];
    const billPayments: any[] = rBillPayment.status === "fulfilled" ? (rBillPayment.value?.QueryResponse?.BillPayment || []) : [];
    const salesReceipts: any[] = salesReceiptsRaw.filter((receipt: any) => {
      const txnSource = String(receipt?.TxnSource || "").toUpperCase();
      return txnSource === "INTUITPAYMENT" || !!receipt?.CreditCardPayment;
    });

    // Deduplicate: paid invoices take priority; payment lines that link to
    // already-counted invoices are skipped to avoid double-counting.
    const counted = new Set<string>();
    const events: PaymentEvent[] = [];
    let total = 0;

    paidInvoices.forEach((inv: any) => {
      const amount = Number(inv.TotalAmt) || 0;
      if (amount <= 0) return;
      const invoiceId = String(inv.Id || "");
      counted.add(invoiceId);
      total += amount;
      events.push({
        id: `invoice:${invoiceId}`,
        type: "invoice",
        customerName: inv.CustomerRef?.name || inv.CustomerRef?.value || "Customer",
        amount,
        txnDate: String(inv.TxnDate || today),
        docNumber: inv.DocNumber ? String(inv.DocNumber) : null,
      });
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
          events.push({
            id: `invoice:${invoiceId}`,
            type: "invoice",
            customerName: payment.CustomerRef?.name || payment.CustomerRef?.value || "Customer",
            amount: lineAmount,
            txnDate: String(payment.TxnDate || today),
            docNumber: null,
          });
        }
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

    // Include same-day SalesReceipt payments (common for card flows).
    salesReceipts.forEach((receipt: any) => {
      const amount = Number(receipt.TotalAmt) || 0;
      if (amount <= 0) return;
      total += amount;
      const receiptId = String(receipt.Id || "");
      events.push({
        id: `sales-receipt:${receiptId}`,
        type: "sales_receipt",
        customerName: receipt.CustomerRef?.name || receipt.CustomerRef?.value || "Customer",
        amount,
        txnDate: String(receipt.TxnDate || today),
        docNumber: receipt.DocNumber ? String(receipt.DocNumber) : null,
      });
    });

    billPayments.forEach((billPayment: any) => {
      const amount = Number(billPayment.TotalAmt) || 0;
      if (amount <= 0) return;
      const billPaymentId = String(billPayment.Id || "");
      events.push({
        id: `bill-payment:${billPaymentId}`,
        type: "bill_payment",
        customerName: billPayment.VendorRef?.name || billPayment.PayeeRef?.name || "Vendor",
        amount,
        txnDate: String(billPayment.TxnDate || today),
        docNumber: billPayment.DocNumber ? String(billPayment.DocNumber) : null,
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
