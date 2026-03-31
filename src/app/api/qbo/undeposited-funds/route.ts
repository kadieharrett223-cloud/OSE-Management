import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch, QboApiError } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";

export interface UndepositedPayment {
  id: string;
  txnDate: string;
  customerName: string;
  totalAmt: number;
  unappliedAmt: number;
  appliedAmt: number;
  depositAccount: string;
  memo: string;
  /** Invoice numbers this payment applied to */
  invoiceNums: string[];
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();

    // Run both queries in parallel: account balance + undeposited payments
    const accountQuery = "SELECT * FROM Account WHERE Name = 'Undeposited Funds'";
    // Payments deposited to "Undeposited Funds" are not yet batched to a bank account
    const paymentQuery =
      "SELECT * FROM Payment WHERE DepositToAccountRef = 'Undeposited Funds' ORDERBY TxnDate DESC MAXRESULTS 50";

    const [accountData, paymentData] = await Promise.allSettled([
      authorizedQboFetch<any>(
        `/query?query=${encodeURIComponent(accountQuery)}&minorversion=65`,
        {},
        userId || undefined
      ),
      authorizedQboFetch<any>(
        `/query?query=${encodeURIComponent(paymentQuery)}&minorversion=65`,
        {},
        userId || undefined
      ),
    ]);

    // Account balance
    const accounts =
      accountData.status === "fulfilled"
        ? accountData.value?.QueryResponse?.Account || []
        : [];
    const undepositedAccount = accounts[0];
    const undeposited = undepositedAccount
      ? Number(undepositedAccount.CurrentBalance || 0)
      : 0;

    // Individual payments sitting in Undeposited Funds
    const rawPayments: any[] =
      paymentData.status === "fulfilled"
        ? paymentData.value?.QueryResponse?.Payment || []
        : [];

    const payments: UndepositedPayment[] = rawPayments.map((p: any) => {
      const total = Number(p.TotalAmt) || 0;
      const unapplied = Number(p.UnappliedAmt) || 0;
      const applied = Math.max(total - unapplied, 0);

      // Collect linked invoice numbers
      const invoiceNums: string[] = [];
      (p.Line || []).forEach((line: any) => {
        (line.LinkedTxn || []).forEach((txn: any) => {
          if (txn.TxnType === "Invoice" && txn.TxnId) {
            invoiceNums.push(txn.TxnId);
          }
        });
      });

      return {
        id: p.Id,
        txnDate: p.TxnDate,
        customerName: p.CustomerRef?.name || "Unknown",
        totalAmt: total,
        unappliedAmt: unapplied,
        appliedAmt: applied,
        depositAccount: p.DepositToAccountRef?.name || "Undeposited Funds",
        memo: p.PrivateNote || "",
        invoiceNums,
      };
    });

    return NextResponse.json({
      ok: true,
      account: undepositedAccount,
      undeposited,
      payments,
      paymentCount: payments.length,
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
