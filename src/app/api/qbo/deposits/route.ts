import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch, QboApiError } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";

export interface DepositLine {
  account: string;
  amount: number;
  description: string;
  entityName: string;
  entityType: string;
  linkedPaymentId?: string;
}

export interface QboDeposit {
  id: string;
  txnDate: string;
  depositToAccount: string;
  totalAmt: number;
  memo: string;
  reconcileStatus: string;
  paymentCount: number;
  lines: DepositLine[];
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    // uncleared=true → only deposits not yet reconciled to the bank (processing)
    const uncleared = searchParams.get("uncleared") === "true";

    let query = "SELECT * FROM Deposit";
    const conditions: string[] = [];

    if (uncleared) conditions.push("ReconcileStatus = 'NotReconciled'");
    if (startDate) conditions.push(`TxnDate >= '${startDate}'`);
    if (endDate) conditions.push(`TxnDate <= '${endDate}'`);

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += ` ORDERBY TxnDate DESC MAXRESULTS ${limit}`;

    const data = await authorizedQboFetch<any>(
      `/query?query=${encodeURIComponent(query)}&minorversion=65`,
      {},
      userId || undefined
    );

    const rawDeposits: any[] = data?.QueryResponse?.Deposit || [];

    const deposits: QboDeposit[] = rawDeposits.map((dep: any) => {
      const lines: DepositLine[] = (dep.Line || [])
        .filter((line: any) => line.DepositLineDetail || line.Amount)
        .map((line: any) => {
          const detail = line.DepositLineDetail || {};
          return {
            account: detail.AccountRef?.name || "Unknown",
            amount: Number(line.Amount) || 0,
            description: line.Description || "",
            entityName: detail.Entity?.name || detail.EntityRef?.name || "",
            entityType: detail.Entity?.type || detail.EntityRef?.type || "",
            linkedPaymentId: detail.LinkedTxn?.TxnId || undefined,
          };
        });

      const paymentLines = lines.filter((l) => l.entityName);
      return {
        id: dep.Id,
        txnDate: dep.TxnDate,
        depositToAccount: dep.DepositToAccountRef?.name || "Unknown",
        totalAmt: Number(dep.TotalAmt) || 0,
        memo: dep.PrivateNote || dep.Memo || "",
        reconcileStatus: dep.ReconcileStatus || "Unknown",
        paymentCount: paymentLines.length,
        lines,
      };
    });

    const totalDeposited = deposits.reduce((sum, d) => sum + d.totalAmt, 0);

    return NextResponse.json({
      ok: true,
      deposits,
      count: deposits.length,
      totalDeposited,
    });
  } catch (error: any) {
    if (error instanceof QboApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch QBO deposits" },
      { status: 500 }
    );
  }
}
