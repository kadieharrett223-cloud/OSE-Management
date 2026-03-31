import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch, QboApiError } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";

const normalizeStatus = (status: string | null) => (status || "").trim().toLowerCase();

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = normalizeStatus(searchParams.get("status"));
    const allPages = searchParams.get("allPages") === "true";
    const totalsOnly = searchParams.get("totalsOnly") === "true";

    const useBalanceFilter = status === "paid" || status === "unpaid";

    const baseConditions: string[] = [];
    if (startDate) {
      baseConditions.push(`TxnDate >= '${startDate}'`);
    }
    if (endDate) {
      baseConditions.push(`TxnDate <= '${endDate}'`);
    }

    const queryWithOptionalBalance = (includeBalance: boolean) => {
      const conditions = [...baseConditions];
      if (includeBalance && useBalanceFilter) {
        if (status === "paid") {
          conditions.push("Balance = '0'");
        } else {
          conditions.push("Balance > '0'");
        }
      }

      let query = "SELECT * FROM Invoice";
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }
      query += " ORDERBY TxnDate DESC";
      return query;
    };

    const applyInMemoryStatusFilter = (rows: any[]) => {
      if (!useBalanceFilter) return rows;
      if (status === "paid") {
        return rows.filter((inv: any) => (Number(inv?.Balance) || 0) <= 0);
      }
      return rows.filter((inv: any) => (Number(inv?.Balance) || 0) > 0);
    };

    const maxResults = 1000;

    const runQuery = async (query: string, filterInMemory: boolean) => {
      const invoices: any[] = [];
      let totalAmount = 0;
      let totalPaid = 0;

      const accumulate = (pageInvoices: any[]) => {
        totalAmount += pageInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.TotalAmt) || 0), 0);
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

          const rawPageInvoices = data?.QueryResponse?.Invoice || [];
          const pageInvoices = filterInMemory ? applyInMemoryStatusFilter(rawPageInvoices) : rawPageInvoices;

          if (!totalsOnly) {
            invoices.push(...pageInvoices);
          }
          accumulate(pageInvoices);

          if (rawPageInvoices.length < maxResults) {
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

        const rawPageInvoices = data?.QueryResponse?.Invoice || [];
        const pageInvoices = filterInMemory ? applyInMemoryStatusFilter(rawPageInvoices) : rawPageInvoices;

        if (!totalsOnly) {
          invoices.push(...pageInvoices);
        }
        accumulate(pageInvoices);
      }

      return { invoices, totalAmount, totalPaid };
    };

    const primaryQuery = queryWithOptionalBalance(true);
    console.log(`[invoice/query] Primary query: ${primaryQuery}`);

    let result;
    try {
      result = await runQuery(primaryQuery, false);
    } catch (error: any) {
      const canFallback =
        useBalanceFilter &&
        error instanceof QboApiError &&
        (error.status === 400 || error.status === 500);

      if (!canFallback) {
        throw error;
      }

      const fallbackQuery = queryWithOptionalBalance(false);
      console.warn("[invoice/query] Primary query failed; retrying with fallback query", {
        primaryQuery,
        fallbackQuery,
        errorStatus: error.status,
      });
      result = await runQuery(fallbackQuery, true);
    }

    return NextResponse.json({
      ok: true,
      invoices: result.invoices,
      count: result.invoices.length,
      totalAmount: result.totalAmount,
      totalPaid: result.totalPaid,
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
