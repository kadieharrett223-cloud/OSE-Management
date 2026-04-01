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
  status: "Open" | "Paid";
}

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

    const invoices: QboInvoiceForMatch[] = allInvoices.map((inv: any) => {
      const balance = Number(inv.Balance) || 0;
      return {
        id: inv.Id,
        docNumber: inv.DocNumber || "",
        poNumber: (inv.PONumber || inv.PONum || inv.CustomField?.find((f: any) => f.Name === "P.O. Number")?.StringValue || "").trim(),
        customerName: inv.CustomerRef?.name || "",
        txnDate: inv.TxnDate || "",
        totalAmt: Number(inv.TotalAmt) || 0,
        balance,
        status: balance <= 0 ? "Paid" : "Open",
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
