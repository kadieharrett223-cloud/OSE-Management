import { NextResponse } from "next/server";
import { authorizedQboFetchDirect } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { BUSINESS_TIME_ZONE, getBusinessDateContext, parseYmd } from "@/lib/business-date";

async function qbo<T = any>(query: string, userId?: string): Promise<T> {
  return authorizedQboFetchDirect<T>(
    `/query?query=${encodeURIComponent(query)}&minorversion=65`,
    {},
    userId || undefined
  );
}

export async function GET() {
  try {
    const userId = (await getUserId()) || undefined;
    const now = new Date();
    const {
      today,
      weekStart,
      monthStart,
      lastMonthStart,
      lastMonthEnd,
      lastMonthCompareEnd,
      lastMonthCompareDays,
      daysSoFar,
      currentYear,
      currentMonth,
    } = getBusinessDateContext(now, BUSINESS_TIME_ZONE);
    const todayUtc = new Date(`${today}T00:00:00Z`);
    const yesterdayUtc = new Date(todayUtc);
    yesterdayUtc.setUTCDate(yesterdayUtc.getUTCDate() - 1);
    const yesterday = yesterdayUtc.toISOString().slice(0, 10);

    const payQ = (s: string, e: string) =>
      `SELECT * FROM Payment WHERE TxnDate >= '${s}' AND TxnDate <= '${e}' ORDERBY TxnDate DESC MAXRESULTS 1000`;
    const billQ = (s: string, e: string) =>
      `SELECT * FROM BillPayment WHERE TxnDate >= '${s}' AND TxnDate <= '${e}' ORDERBY TxnDate DESC MAXRESULTS 1000`;
    const normalizePaymentMethod = (payment: any) => {
      const methodName = String(payment?.PaymentMethodRef?.name || payment?.PaymentMethodRef?.value || "").trim();
      if (methodName) return methodName;

      if (payment?.CreditCardPayment || payment?.ProcessPayment) return "Charged Online";

      const privateNote = String(payment?.PrivateNote || "").toLowerCase();
      if (privateNote.includes("shopify")) return "Shopify";

      return "Unknown";
    };
    const buildCustomerPayments = (payments: any[], paidInvoices: any[], fallbackDate: string) => {
      const itemizedCustomerPayments: any[] = [];
      const coveredInvoiceIds = new Set<string>();

      payments.forEach((payment: any) => {
        const total = Number(payment.TotalAmt) || 0;
        const unapplied = Number(payment.UnappliedAmt) || 0;
        const applied = Math.max(total - unapplied, 0);
        if (applied <= 0) return;

        let linkedAmount = 0;
        (Array.isArray(payment.Line) ? payment.Line : []).forEach((line: any) => {
          const lineAmount = Number(line.Amount) || 0;
          const invoiceLinks = (Array.isArray(line.LinkedTxn) ? line.LinkedTxn : []).filter(
            (txn: any) => txn.TxnType === "Invoice" && txn.TxnId
          );
          if (!invoiceLinks.length) return;

          linkedAmount += lineAmount;
          invoiceLinks.forEach((txn: any) => {
            const invoiceId = String(txn.TxnId || "");
            if (!invoiceId || coveredInvoiceIds.has(invoiceId)) return;
            coveredInvoiceIds.add(invoiceId);
            itemizedCustomerPayments.push({
              id: `pay-link-${payment.Id}-${invoiceId}`,
              customerName: payment.CustomerRef?.name || payment.CustomerRef?.value || "Unknown",
              appliedAmount: lineAmount,
              totalAmount: lineAmount,
              txnDate: payment.TxnDate || fallbackDate,
              paymentMethod: normalizePaymentMethod(payment),
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
            txnDate: payment.TxnDate || fallbackDate,
            paymentMethod: normalizePaymentMethod(payment),
          });
        }
      });

      paidInvoices.forEach((inv: any) => {
        const total = Number(inv.TotalAmt) || 0;
        if (total <= 0) return;

        const invoiceId = String(inv.Id || "");
        if (invoiceId && coveredInvoiceIds.has(invoiceId)) return;

        itemizedCustomerPayments.push({
          id: `inv-${inv.Id}`,
          customerName: inv.CustomerRef?.name || inv.CustomerRef?.value || "Unknown",
          appliedAmount: total,
          totalAmount: total,
          txnDate: inv.TxnDate || fallbackDate,
          paymentMethod: "Invoice Payment",
        });
      });

      itemizedCustomerPayments.sort((a, b) => b.appliedAmount - a.appliedAmount);
      return itemizedCustomerPayments;
    };

    // All QBO queries fire truly in parallel (no serial queue)
    const [
      rPayToday,
      rPayYesterday,
      rPayWeek,
      rPayMonth,
      rPayLastMonth,
      rPayLastMonthTrend,
      rBillMonth,
      rBillToday,
      rUnpaid,
      rPaidInvToday,
      rPaidInvYesterday,
    ] = await Promise.allSettled([
      qbo(payQ(today, today), userId),
      qbo(payQ(yesterday, yesterday), userId),
      qbo(payQ(weekStart, today), userId),
      qbo(payQ(monthStart, today), userId),
      qbo(payQ(lastMonthStart, lastMonthEnd), userId),
      qbo(payQ(lastMonthStart, lastMonthCompareEnd), userId),
      qbo(billQ(monthStart, today), userId),
      qbo(billQ(today, today), userId),
      qbo(`SELECT * FROM Invoice WHERE Balance > '0' ORDERBY TxnDate DESC MAXRESULTS 1000`, userId),
      qbo(`SELECT * FROM Invoice WHERE Balance = '0' AND TxnDate >= '${today}' AND TxnDate <= '${today}' ORDERBY TxnDate DESC MAXRESULTS 500`, userId),
      qbo(`SELECT * FROM Invoice WHERE Balance = '0' AND TxnDate >= '${yesterday}' AND TxnDate <= '${yesterday}' ORDERBY TxnDate DESC MAXRESULTS 500`, userId),
    ]);

    // Log failures for visibility
    const labels = ["payToday","payYesterday","payWeek","payMonth","payLastMonth","payLastMonthTrend","billMonth","billToday","unpaid","paidInvToday","paidInvYesterday"];
    [rPayToday,rPayYesterday,rPayWeek,rPayMonth,rPayLastMonth,rPayLastMonthTrend,rBillMonth,rBillToday,rUnpaid,rPaidInvToday,rPaidInvYesterday].forEach((r, i) => {
      if (r.status === "rejected") console.error(`[dashboard/summary] ${labels[i]} failed:`, r.reason?.message || r.reason);
    });

    const val = <T>(r: PromiseSettledResult<T>) => r.status === "fulfilled" ? r.value : ({ QueryResponse: {} } as any);

    const paymentsToday: any[] = val(rPayToday)?.QueryResponse?.Payment || [];
  const paymentsYesterday: any[] = val(rPayYesterday)?.QueryResponse?.Payment || [];
    const paymentsWeek: any[] = val(rPayWeek)?.QueryResponse?.Payment || [];
    const paymentsMonth: any[] = val(rPayMonth)?.QueryResponse?.Payment || [];
    const paymentsLastMonth: any[] = val(rPayLastMonth)?.QueryResponse?.Payment || [];
    const paymentsLastMonthTrend: any[] = val(rPayLastMonthTrend)?.QueryResponse?.Payment || [];
    const billPaymentsMonth: any[] = val(rBillMonth)?.QueryResponse?.BillPayment || [];
    const billPaymentsToday: any[] = val(rBillToday)?.QueryResponse?.BillPayment || [];
    const unpaidInvoices: any[] = val(rUnpaid)?.QueryResponse?.Invoice || [];
    const paidInvoicesToday: any[] = val(rPaidInvToday)?.QueryResponse?.Invoice || [];
  const paidInvoicesYesterday: any[] = val(rPaidInvYesterday)?.QueryResponse?.Invoice || [];

    const sumApplied = (pmts: any[]) =>
      pmts.reduce((s: number, p: any) => s + Math.max((Number(p.TotalAmt)||0) - (Number(p.UnappliedAmt)||0), 0), 0);

    const buildCumulative = (pmts: any[], days: number) => {
      const daily = Array<number>(days).fill(0);
      pmts.forEach((p: any) => {
        const txn = parseYmd(p.TxnDate);
        if (!txn) return;
        const idx = Math.max(0, Math.min(days - 1, txn.day - 1));
        daily[idx] += Math.max((Number(p.TotalAmt)||0) - (Number(p.UnappliedAmt)||0), 0);
      });
      let r = 0; return daily.map(v => (r += v));
    };

    const buildExpenseCumulative = (pmts: any[], days: number, yr: number, mo: number) => {
      const daily = Array<number>(days).fill(0);
      pmts.forEach((p: any) => {
        const txn = parseYmd(p.TxnDate);
        if (!txn) return;
        if (txn.year !== yr || txn.month !== mo) return;
        const idx = Math.max(0, Math.min(days - 1, txn.day - 1));
        daily[idx] += Number(p.TotalAmt) || 0;
      });
      let r = 0; return daily.map(v => (r += v));
    };

    // Top vendors
    const vendorTotals = new Map<string, number>();
    billPaymentsMonth.forEach((p: any) => {
      const name = p.VendorRef?.name || p.PayeeRef?.name || "Unknown Vendor";
      vendorTotals.set(name, (vendorTotals.get(name) || 0) + (Number(p.TotalAmt) || 0));
    });
    const topExpenses = Array.from(vendorTotals.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total).slice(0, 5);

    // Vendor payments today
    const vendorSummaryMap = new Map<string, { totalPaid: number; paymentCount: number; lastTxnDate: string }>();
    let vendorPaymentsTotal = 0;
    billPaymentsToday.forEach((p: any) => {
      const paid = Number(p.TotalAmt) || 0;
      if (paid <= 0) return;
      const name = p.VendorRef?.name || p.PayeeRef?.name || "Unknown Vendor";
      vendorPaymentsTotal += paid;
      const ex = vendorSummaryMap.get(name);
      if (ex) { ex.totalPaid += paid; ex.paymentCount++; if (p.TxnDate > ex.lastTxnDate) ex.lastTxnDate = p.TxnDate; }
      else vendorSummaryMap.set(name, { totalPaid: paid, paymentCount: 1, lastTxnDate: p.TxnDate || today });
    });
    const vendorPaymentsToday = Array.from(vendorSummaryMap.entries())
      .map(([vendorName, v]) => ({ vendorName, ...v }))
      .sort((a, b) => b.totalPaid - a.totalPaid);

    // Outstanding invoices
    const outstandingCount = unpaidInvoices.length;
    const outstandingTotal = unpaidInvoices.reduce((s: number, inv: any) => s + (Number(inv.Balance) || 0), 0);

    // Partial paid invoices
    const partialPaid = unpaidInvoices.map((inv: any) => {
      const total = Number(inv.TotalAmt) || 0;
      const balance = Number(inv.Balance) || 0;
      const paid = Math.max(total - balance, 0);
      if (!(paid > 0 && balance > 0)) return null;
      return { id: String(inv.Id||""), docNumber: String(inv.DocNumber||"N/A"), customerName: String(inv.CustomerRef?.name||inv.CustomerRef?.value||"Unknown"), txnDate: String(inv.TxnDate||""), totalAmt: total, paidAmt: paid, balance };
    }).filter(Boolean).sort((a: any, b: any) => b.balance - a.balance);

    // Recent open invoices
    const recentInvoices = unpaidInvoices.slice(0, 50).map((inv: any) => {
      const total = Number(inv.TotalAmt) || 0;
      const balance = Number(inv.Balance) || 0;
      return { id: inv.Id, docNumber: inv.DocNumber, customerName: inv.CustomerRef?.name || "Unknown", totalAmt: total, balance, txnDate: inv.TxnDate, status: balance <= 0 ? "Paid" : "Open" };
    });

    const itemizedCustomerPayments = buildCustomerPayments(paymentsToday, paidInvoicesToday, today);
    const itemizedCustomerPaymentsYesterday = buildCustomerPayments(paymentsYesterday, paidInvoicesYesterday, yesterday);

    // Purchase orders
    let recentPurchases: any[] = [];
    try {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data } = await supabase.from("purchase_orders").select("id, po_number, vendor_name, total_amount, status, order_date").order("order_date", { ascending: false }).limit(5);
      recentPurchases = (data || []).map((po: any) => ({ id: po.id, poNumber: po.po_number, vendorName: po.vendor_name || "Unknown", totalAmount: Number(po.total_amount) || 0, status: po.status || "UNKNOWN", orderDate: po.order_date }));
    } catch (err) { console.error("[dashboard/summary] PO fetch failed:", err); }

    return NextResponse.json({
      ok: true,
      salesToday: sumApplied(paymentsToday),
      salesWeek: sumApplied(paymentsWeek),
      salesMonth: sumApplied(paymentsMonth),
      salesLastMonth: sumApplied(paymentsLastMonth),
      currentMonthTrend: buildCumulative(paymentsMonth, daysSoFar),
      lastMonthTrend: buildCumulative(paymentsLastMonthTrend, lastMonthCompareDays),
      expenseTrend: buildExpenseCumulative(billPaymentsMonth, daysSoFar, currentYear, currentMonth),
      paidExpensesTotal: billPaymentsMonth.reduce((s: number, p: any) => s + (Number(p.TotalAmt)||0), 0),
      topExpenses,
      vendorPaymentsTotal,
      vendorPaymentsToday,
      outstandingCount,
      outstandingTotal,
      partialPaid,
      recentInvoices,
      paymentsTotal: itemizedCustomerPayments.reduce((s: number, r: any) => s + (Number(r.appliedAmount)||0), 0),
      customerPaymentsToday: itemizedCustomerPayments,
      paymentsYesterdayTotal: itemizedCustomerPaymentsYesterday.reduce((s: number, r: any) => s + (Number(r.appliedAmount)||0), 0),
      customerPaymentsYesterday: itemizedCustomerPaymentsYesterday,
      recentPurchases,
      businessTimeZone: BUSINESS_TIME_ZONE,
      businessDate: today,
      previousBusinessDate: yesterday,
    });
  } catch (error: any) {
    console.error("[dashboard/summary] fatal:", error);
    return NextResponse.json({ error: error.message || "Failed to load dashboard summary" }, { status: 500 });
  }
}
