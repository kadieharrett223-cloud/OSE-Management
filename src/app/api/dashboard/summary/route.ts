import { NextResponse } from "next/server";
import { authorizedQboFetch } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

function toYmd(date: Date) {
  return date.toLocaleDateString("en-CA"); // YYYY-MM-DD local
}

function buildPaymentQuery(startDate: string, endDate: string) {
  return `SELECT * FROM Payment WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' ORDERBY TxnDate DESC MAXRESULTS 1000`;
}

function buildBillPaymentQuery(startDate: string, endDate: string) {
  return `SELECT * FROM BillPayment WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' ORDERBY TxnDate DESC MAXRESULTS 1000`;
}

function buildUnpaidInvoiceQuery(maxResults = 1000) {
  return `SELECT * FROM Invoice WHERE Balance > '0' ORDERBY TxnDate DESC MAXRESULTS ${maxResults}`;
}

async function qboQuery<T = any>(query: string, userId?: string): Promise<T> {
  return authorizedQboFetch<T>(
    `/query?query=${encodeURIComponent(query)}&minorversion=65`,
    {},
    userId || undefined
  );
}

export async function GET() {
  try {
    const userId = await getUserId();

    const now = new Date();
    const today = toYmd(now);

    // Month start
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    // Week start (Monday)
    const weekStartDate = new Date(now);
    const dayOfWeek = weekStartDate.getDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    weekStartDate.setDate(weekStartDate.getDate() - daysSinceMonday);
    const weekStart = toYmd(weekStartDate);

    // Last month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthStartStr = toYmd(lastMonthStart);
    const lastMonthEndStr = toYmd(lastMonthEnd);

    // Last month comparison period (same days elapsed)
    const daysSoFar = now.getDate();
    const lastMonthCompareDays = Math.min(daysSoFar, lastMonthEnd.getDate());
    const lastMonthCompareEnd = new Date(
      lastMonthStart.getFullYear(),
      lastMonthStart.getMonth(),
      lastMonthCompareDays
    );
    const lastMonthCompareEndStr = toYmd(lastMonthCompareEnd);

    // Run all QBO queries in parallel
    const [
      paymentsTodayResult,
      paymentsWeekResult,
      paymentsMonthResult,
      paymentsLastMonthResult,
      paymentsCurrentTrendResult,
      paymentsLastMonthTrendResult,
      billPaymentsMonthResult,
      billPaymentsTodayResult,
      unpaidInvoicesResult,
    ] = await Promise.allSettled([
      qboQuery(buildPaymentQuery(today, today), userId || undefined),
      qboQuery(buildPaymentQuery(weekStart, today), userId || undefined),
      qboQuery(buildPaymentQuery(monthStart, today), userId || undefined),
      qboQuery(buildPaymentQuery(lastMonthStartStr, lastMonthEndStr), userId || undefined),
      qboQuery(buildPaymentQuery(monthStart, today), userId || undefined),
      qboQuery(buildPaymentQuery(lastMonthStartStr, lastMonthCompareEndStr), userId || undefined),
      qboQuery(buildBillPaymentQuery(monthStart, today), userId || undefined),
      qboQuery(buildBillPaymentQuery(today, today), userId || undefined),
      qboQuery(buildUnpaidInvoiceQuery(1000), userId || undefined),
    ]);

    // Also fetch purchase orders from DB (not QBO)
    let recentPurchaseOrders: any[] = [];
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, po_number, vendor_name, total_amount, status, order_date")
        .order("order_date", { ascending: false })
        .limit(5);
      recentPurchaseOrders = data || [];
    } catch {}

    const extract = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
      result.status === "fulfilled" ? result.value : fallback;

    const paymentsToday = extract(paymentsTodayResult, { QueryResponse: {} } as any)?.QueryResponse?.Payment || [];
    const paymentsWeek = extract(paymentsWeekResult, { QueryResponse: {} } as any)?.QueryResponse?.Payment || [];
    const paymentsMonth = extract(paymentsMonthResult, { QueryResponse: {} } as any)?.QueryResponse?.Payment || [];
    const paymentsLastMonth = extract(paymentsLastMonthResult, { QueryResponse: {} } as any)?.QueryResponse?.Payment || [];
    const paymentsCurrentTrend = extract(paymentsCurrentTrendResult, { QueryResponse: {} } as any)?.QueryResponse?.Payment || [];
    const paymentsLastMonthTrend = extract(paymentsLastMonthTrendResult, { QueryResponse: {} } as any)?.QueryResponse?.Payment || [];
    const billPaymentsMonth = extract(billPaymentsMonthResult, { QueryResponse: {} } as any)?.QueryResponse?.BillPayment || [];
    const billPaymentsToday = extract(billPaymentsTodayResult, { QueryResponse: {} } as any)?.QueryResponse?.BillPayment || [];
    const unpaidInvoices = extract(unpaidInvoicesResult, { QueryResponse: {} } as any)?.QueryResponse?.Invoice || [];

    const sumApplied = (payments: any[]) =>
      payments.reduce((sum: number, p: any) => {
        const total = Number(p.TotalAmt) || 0;
        const unapplied = Number(p.UnappliedAmt) || 0;
        return sum + Math.max(total - unapplied, 0);
      }, 0);

    const sumBillPayments = (payments: any[]) =>
      payments.reduce((sum: number, p: any) => sum + (Number(p.TotalAmt) || 0), 0);

    // Build cumulative daily series
    const buildCumulativeSeries = (payments: any[], days: number) => {
      const daily = Array(days).fill(0);
      payments.forEach((p: any) => {
        const d = new Date(p.TxnDate);
        const idx = Math.max(0, Math.min(days - 1, d.getDate() - 1));
        const total = Number(p.TotalAmt) || 0;
        const unapplied = Number(p.UnappliedAmt) || 0;
        daily[idx] += Math.max(total - unapplied, 0);
      });
      const cumulative: number[] = [];
      let running = 0;
      for (let i = 0; i < days; i++) {
        running += daily[i];
        cumulative.push(running);
      }
      return cumulative;
    };

    const buildExpenseSeries = (payments: any[], days: number) => {
      const daily = Array(days).fill(0);
      payments.forEach((p: any) => {
        const d = new Date(p.TxnDate);
        if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return;
        const idx = Math.max(0, Math.min(days - 1, d.getDate() - 1));
        daily[idx] += Number(p.TotalAmt) || 0;
      });
      const cumulative: number[] = [];
      let running = 0;
      for (let i = 0; i < days; i++) {
        running += daily[i];
        cumulative.push(running);
      }
      return cumulative;
    };

    const currentMonthTrend = buildCumulativeSeries(paymentsCurrentTrend, daysSoFar);
    const lastMonthTrend = buildCumulativeSeries(paymentsLastMonthTrend, lastMonthCompareDays);
    const expenseTrend = buildExpenseSeries(billPaymentsMonth, daysSoFar);

    // Top vendors this month
    const vendorTotals = new Map<string, number>();
    billPaymentsMonth.forEach((p: any) => {
      const name = p.VendorRef?.name || p.PayeeRef?.name || "Unknown Vendor";
      vendorTotals.set(name, (vendorTotals.get(name) || 0) + (Number(p.TotalAmt) || 0));
    });
    const topExpenses = Array.from(vendorTotals.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Vendor payments today summary
    const vendorSummaryMap = new Map<string, { totalPaid: number; paymentCount: number; lastTxnDate: string }>();
    let vendorPaymentsTotal = 0;
    billPaymentsToday.forEach((p: any) => {
      const paid = Number(p.TotalAmt) || 0;
      if (paid <= 0) return;
      const name = p.VendorRef?.name || p.PayeeRef?.name || "Unknown Vendor";
      vendorPaymentsTotal += paid;
      const existing = vendorSummaryMap.get(name);
      if (existing) {
        existing.totalPaid += paid;
        existing.paymentCount += 1;
        if (p.TxnDate && p.TxnDate > existing.lastTxnDate) existing.lastTxnDate = p.TxnDate;
      } else {
        vendorSummaryMap.set(name, { totalPaid: paid, paymentCount: 1, lastTxnDate: p.TxnDate || today });
      }
    });
    const vendorPaymentsToday = Array.from(vendorSummaryMap.entries())
      .map(([vendorName, v]) => ({ vendorName, ...v }))
      .sort((a, b) => b.totalPaid - a.totalPaid);

    // Outstanding invoices
    const outstandingCount = unpaidInvoices.length;
    const outstandingTotal = unpaidInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.Balance) || 0), 0);

    // Partial paid invoices
    const partialPaid = unpaidInvoices
      .map((inv: any) => {
        const total = Number(inv.TotalAmt) || 0;
        const balance = Number(inv.Balance) || 0;
        const paid = Math.max(total - balance, 0);
        if (!(paid > 0 && balance > 0)) return null;
        return {
          id: String(inv.Id || ""),
          docNumber: String(inv.DocNumber || "N/A"),
          customerName: String(inv.CustomerRef?.name || inv.CustomerRef?.value || "Unknown"),
          txnDate: String(inv.TxnDate || ""),
          totalAmt: total,
          paidAmt: paid,
          balance,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.balance - a.balance);

    // Recent open invoices
    const recentInvoices = unpaidInvoices.slice(0, 50).map((inv: any) => {
      const total = Number(inv.TotalAmt) || 0;
      const balance = Number(inv.Balance) || 0;
      return {
        id: inv.Id,
        docNumber: inv.DocNumber,
        customerName: inv.CustomerRef?.name || "Unknown",
        totalAmt: total,
        balance,
        txnDate: inv.TxnDate,
        status: balance <= 0 ? "Paid" : "Open",
      };
    });

    // Customer payments today (from paymentsToday)
    const itemizedCustomerPayments: any[] = [];
    const paidByInvoiceId = new Map<string, number>();
    paymentsToday.forEach((payment: any) => {
      const total = Number(payment.TotalAmt) || 0;
      const unapplied = Number(payment.UnappliedAmt) || 0;
      const applied = Math.max(total - unapplied, 0);
      if (applied <= 0) return;
      let linkedAmount = 0;
      const lines = Array.isArray(payment.Line) ? payment.Line : [];
      lines.forEach((line: any) => {
        const lineAmount = Number(line.Amount) || 0;
        const linked = Array.isArray(line.LinkedTxn) ? line.LinkedTxn : [];
        const invoiceLinks = linked.filter((txn: any) => txn.TxnType === "Invoice" && txn.TxnId);
        if (invoiceLinks.length === 0) return;
        linkedAmount += lineAmount;
        invoiceLinks.forEach((txn: any) => {
          const invoiceId = String(txn.TxnId || "");
          if (!invoiceId || paidByInvoiceId.has(invoiceId)) return;
          paidByInvoiceId.set(invoiceId, lineAmount);
          itemizedCustomerPayments.push({
            id: `pay-link-${payment.Id}-${invoiceId}`,
            customerName: payment.CustomerRef?.name || payment.CustomerRef?.value || "Unknown",
            appliedAmount: lineAmount,
            totalAmount: lineAmount,
            txnDate: payment.TxnDate || today,
          });
        });
      });
      const unlinked = Math.max(applied - linkedAmount, 0);
      if (unlinked > 0) {
        itemizedCustomerPayments.push({
          id: `pay-${payment.Id || Math.random().toString(36).slice(2)}`,
          customerName: payment.CustomerRef?.name || payment.CustomerRef?.value || "Unknown",
          appliedAmount: unlinked,
          totalAmount: total,
          txnDate: payment.TxnDate || today,
        });
      }
    });
    itemizedCustomerPayments.sort((a, b) => b.appliedAmount - a.appliedAmount);

    return NextResponse.json({
      ok: true,
      // Payment totals
      salesToday: sumApplied(paymentsToday),
      salesWeek: sumApplied(paymentsWeek),
      salesMonth: sumApplied(paymentsMonth),
      salesLastMonth: sumApplied(paymentsLastMonth),
      // Trends
      currentMonthTrend,
      lastMonthTrend,
      expenseTrend,
      // Expenses
      paidExpensesTotal: sumBillPayments(billPaymentsMonth),
      topExpenses,
      // Vendor payments today
      vendorPaymentsTotal,
      vendorPaymentsToday,
      // Invoices
      outstandingCount,
      outstandingTotal,
      partialPaid,
      recentInvoices,
      // Customer payments today
      paymentsTotal: itemizedCustomerPayments.reduce((s: number, r: any) => s + (Number(r.appliedAmount) || 0), 0),
      customerPaymentsToday: itemizedCustomerPayments,
      // Purchase orders
      recentPurchases: recentPurchaseOrders.map((po: any) => ({
        id: po.id,
        poNumber: po.po_number,
        vendorName: po.vendor_name || "Unknown",
        totalAmount: Number(po.total_amount) || 0,
        status: po.status || "UNKNOWN",
        orderDate: po.order_date,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load dashboard summary" },
      { status: 500 }
    );
  }
}
