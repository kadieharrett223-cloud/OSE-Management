import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch, QboApiError } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status"); // "Paid", "Unpaid", etc.
    const allPages = searchParams.get("allPages") === "true";
    const totalsOnly = searchParams.get("totalsOnly") === "true";

    // Build the QuickBooks query
    let query = "SELECT * FROM Invoice";
    const conditions: string[] = [];

    if (startDate) {
      conditions.push(`TxnDate >= '${startDate}'`);
    }
    if (endDate) {
      conditions.push(`TxnDate <= '${endDate}'`);
    }
    if (status) {
      // QuickBooks uses Balance = 0 for paid invoices
      if (status.toLowerCase() === "paid") {
        conditions.push("Balance = 0");
      } else if (status.toLowerCase() === "unpaid") {
        conditions.push("Balance > 0");
      }
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDERBY TxnDate DESC";

    console.log(`[invoice/query] Final query: ${query}`);

    const maxResults = 1000;
    const invoices: any[] = [];
    let totalAmount = 0;
    let totalPaid = 0;

    const accumulateTotals = (pageInvoices: any[]) => {
      totalAmount += pageInvoices.reduce((sum: number, inv: any) => {
        return sum + (Number(inv.TotalAmt) || 0);
      }, 0);

      totalPaid += pageInvoices.reduce((sum: number, inv: any) => {
        const balance = Number(inv.Balance) || 0;
        const total = Number(inv.TotalAmt) || 0;
        return sum + (total - balance);
      }, 0);
    };

    if (allPages) {
      let startPosition = 1;
      while (true) {
        const pagedQuery = `${query} STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
        const data = await authorizedQboFetch<any>(
          `/query?query=${encodeURIComponent(pagedQuery)}&minorversion=65`,
          {},
          userId || undefined
        );

        const pageInvoices = data?.QueryResponse?.Invoice || [];
        console.log(`[invoice/query] Page ${startPosition}: fetched ${pageInvoices.length} invoices`);
        accumulateTotals(pageInvoices);

        if (!totalsOnly) {
          invoices.push(...pageInvoices);
        }

        if (pageInvoices.length < maxResults) {
          console.log(`[invoice/query] Final totals: totalPaid=${totalPaid}, totalAmount=${totalAmount}`);
          break;
        }

        startPosition += maxResults;
      }
    } else {
      const data = await authorizedQboFetch<any>(
        `/query?query=${encodeURIComponent(query)}&minorversion=65`,
        {},
        userId || undefined
      );

      const pageInvoices = data?.QueryResponse?.Invoice || [];
      console.log(`[invoice/query] Fetched ${pageInvoices.length} invoices, totalPaid: ${totalPaid}`, {
        query,
        firstInvoice: pageInvoices[0],
      });
      accumulateTotals(pageInvoices);
      if (!totalsOnly) {
        invoices.push(...pageInvoices);
      }
    }

    return NextResponse.json({
      ok: true,
      invoices,
      count: invoices.length,
      totalAmount,
      totalPaid,
    });
  } catch (error: any) {
    if (error instanceof QboApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to query invoices" },
      { status: 500 }
    );
  }
}
