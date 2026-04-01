import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch, QboApiError } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";

export interface QboInvoiceForMatch {
  id: string;
  docNumber: string;
  /** PO number entered on the invoice — we store Shopify order # here */
  poNumber: string;
  customerName: string;
  txnDate: string;
  totalAmt: number;
  balance: number;
  status: "Open" | "Paid" | "Cancelled";
}

const normName = (value: string) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const sp = req.nextUrl.searchParams;
    const startDate = sp.get("startDate");
    const endDate = sp.get("endDate");

    const conditions: string[] = [];
    if (startDate) conditions.push(`TxnDate >= '${startDate}'`);
    if (endDate) conditions.push(`TxnDate <= '${endDate}'`);

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
    const maxResults = 1000;

    const allInvoices: any[] = [];
    let startPosition = 1;

    while (true) {
      const query = `SELECT * FROM Invoice${whereClause} ORDERBY TxnDate DESC STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      let data: any;

      try {
        data = await authorizedQboFetch<any>(
          `/query?query=${encodeURIComponent(query)}&minorversion=65`,
          {},
          userId || undefined
        );
      } catch (err) {
        if (err instanceof QboApiError && (err.status === 400 || err.status === 500)) {
          // Retry without date filter
          const fallbackQuery = `SELECT * FROM Invoice ORDERBY TxnDate DESC STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
          data = await authorizedQboFetch<any>(
            `/query?query=${encodeURIComponent(fallbackQuery)}&minorversion=65`,
            {},
            userId || undefined
          );
        } else {
          throw err;
        }
      }

      const page: any[] = data?.QueryResponse?.Invoice || [];
      allInvoices.push(...page);

      if (page.length < maxResults) break;
      startPosition += maxResults;
    }

    const allChecks: any[] = [];
    let checkStartPosition = 1;

    while (true) {
      const checkQuery = `SELECT * FROM Check${whereClause} ORDERBY TxnDate DESC STARTPOSITION ${checkStartPosition} MAXRESULTS ${maxResults}`;
      let checkData: any;

      try {
        checkData = await authorizedQboFetch<any>(
          `/query?query=${encodeURIComponent(checkQuery)}&minorversion=65`,
          {},
          userId || undefined
        );
      } catch (err) {
        if (err instanceof QboApiError && (err.status === 400 || err.status === 500)) {
          const checkFallbackQuery = `SELECT * FROM Check ORDERBY TxnDate DESC STARTPOSITION ${checkStartPosition} MAXRESULTS ${maxResults}`;
          checkData = await authorizedQboFetch<any>(
            `/query?query=${encodeURIComponent(checkFallbackQuery)}&minorversion=65`,
            {},
            userId || undefined
          );
        } else {
          throw err;
        }
      }

      const checkPage: any[] = checkData?.QueryResponse?.Check || [];
      allChecks.push(...checkPage);

      if (checkPage.length < maxResults) break;
      checkStartPosition += maxResults;
    }

    const checkKeys = new Set<string>();
    for (const check of allChecks) {
      const payeeName = normName(check.PayeeRef?.name || "");
      const amount = Number(check.TotalAmt) || 0;
      if (!payeeName || amount <= 0) continue;
      checkKeys.add(`${payeeName}|${amount.toFixed(2)}`);
    }

    const invoices: QboInvoiceForMatch[] = allInvoices.map((inv: any) => {
      const balance = Number(inv.Balance) || 0;
      const totalAmt = Number(inv.TotalAmt) || 0;
      const customerName = inv.CustomerRef?.name || "";
      const hasMatchingCheck = checkKeys.has(`${normName(customerName)}|${totalAmt.toFixed(2)}`);
      const isCancelled = balance <= 0 || hasMatchingCheck;
      return {
        id: inv.Id,
        docNumber: inv.DocNumber || "",
        poNumber: (inv.PONumber || inv.PONum || inv.CustomField?.find((f: any) => f.Name === "P.O. Number")?.StringValue || "").trim(),
        customerName,
        txnDate: inv.TxnDate || "",
        totalAmt,
        balance,
        status: isCancelled ? "Cancelled" : balance <= 0 ? "Paid" : "Open",
      };
    });

    return NextResponse.json({ ok: true, invoices, count: invoices.length });
  } catch (err: any) {
    console.error("[qbo/invoice/shopify-match] Error:", err);
    if (err instanceof QboApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err.message || "Failed to fetch invoices" }, { status: 500 });
  }
}
