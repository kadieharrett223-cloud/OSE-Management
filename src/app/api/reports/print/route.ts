import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetchDirect } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";
import { BUSINESS_TIME_ZONE, getBusinessDateContext } from "@/lib/business-date";

type PrintableRow = Record<string, string | number>;

type ReportDefinition = {
  title: string;
  subtitle: string;
  columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
  rows: PrintableRow[];
  totalLabel?: string;
  totalValue?: number;
};

const nf = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function money(value: number) {
  return `$${nf.format(Number(value) || 0)}`;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function qbo<T = any>(query: string, userId?: string): Promise<T> {
  return authorizedQboFetchDirect<T>(
    `/query?query=${encodeURIComponent(query)}&minorversion=65`,
    {},
    userId || undefined
  );
}

function buildHtml(def: ReportDefinition) {
  const headers = def.columns
    .map((c) => `<th class="${c.align === "right" ? "right" : "left"}">${esc(c.label)}</th>`)
    .join("");

  const bodyRows =
    def.rows.length === 0
      ? `<tr><td colspan="${def.columns.length}" class="empty">No records found.</td></tr>`
      : def.rows
          .map((row) => {
            const rowClass = String(row.__rowClass || "").trim();
            const tds = def.columns
              .map((c) => {
                const value = row[c.key] ?? "";
                return `<td class="${c.align === "right" ? "right" : "left"}">${esc(value)}</td>`;
              })
              .join("");
            return `<tr class="${esc(rowClass)}">${tds}</tr>`;
          })
          .join("");

  const totalSection =
    typeof def.totalValue === "number"
      ? `<div class="total">${esc(def.totalLabel || "Total")}: <strong>${esc(money(def.totalValue))}</strong></div>`
      : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(def.title)}</title>
  <style>
    body { font-family: "Segoe UI", Tahoma, sans-serif; color: #0f172a; margin: 28px; }
    h1 { margin: 0; font-size: 24px; }
    .subtitle { margin-top: 6px; color: #475569; font-size: 13px; }
    .meta { margin-top: 4px; color: #64748b; font-size: 12px; }
    .total { margin-top: 14px; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 12px; }
    th { background: #f8fafc; text-transform: uppercase; letter-spacing: 0.03em; color: #475569; }
    tr.row-partial td { background: #fef9c3; }
    .right { text-align: right; }
    .left { text-align: left; }
    .empty { text-align: center; color: #64748b; padding: 20px 10px; }
    @media print {
      body { margin: 12mm; }
      .noprint { display: none; }
    }
  </style>
</head>
<body>
  <h1>${esc(def.title)}</h1>
  <div class="subtitle">${esc(def.subtitle)}</div>
  <div class="meta">Business timezone: ${esc(BUSINESS_TIME_ZONE)}</div>
  ${totalSection}
  <table>
    <thead><tr>${headers}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <script>
    window.addEventListener("load", function () { window.print(); });
  </script>
</body>
</html>`;
}

async function buildOpenInvoicesReport(userId?: string): Promise<ReportDefinition> {
  const data = await qbo<any>(
    "SELECT * FROM Invoice WHERE Balance > '0' ORDERBY TxnDate DESC MAXRESULTS 1000",
    userId
  );

  const invoices: any[] = data?.QueryResponse?.Invoice || [];
  const total = invoices.reduce((sum, inv) => sum + (Number(inv.Balance) || 0), 0);

  return {
    title: "Open Invoices Report",
    subtitle: "All unpaid invoices",
    columns: [
      { key: "docNumber", label: "Invoice" },
      { key: "txnDate", label: "Date" },
      { key: "customer", label: "Customer" },
      { key: "total", label: "Total", align: "right" },
      { key: "balance", label: "Balance", align: "right" },
    ],
    rows: invoices.map((inv) => ({
      __rowClass:
        (Number(inv.TotalAmt) || 0) > (Number(inv.Balance) || 0) && (Number(inv.Balance) || 0) > 0
          ? "row-partial"
          : "",
      docNumber: inv.DocNumber || inv.Id || "N/A",
      txnDate: inv.TxnDate || "",
      customer: inv.CustomerRef?.name || inv.CustomerRef?.value || "Unknown",
      total: money(Number(inv.TotalAmt) || 0),
      balance: money(Number(inv.Balance) || 0),
    })),
    totalLabel: "Outstanding balance",
    totalValue: total,
  };
}

async function buildEstimatesReport(userId?: string): Promise<ReportDefinition> {
  const data = await qbo<any>("SELECT * FROM Estimate ORDERBY TxnDate DESC MAXRESULTS 1000", userId);
  const estimates: any[] = data?.QueryResponse?.Estimate || [];
  const total = estimates.reduce((sum, est) => sum + (Number(est.TotalAmt) || 0), 0);

  return {
    title: "Estimates Report",
    subtitle: "All estimates",
    columns: [
      { key: "docNumber", label: "Estimate #" },
      { key: "txnDate", label: "Date" },
      { key: "customer", label: "Customer" },
      { key: "status", label: "Status" },
      { key: "amount", label: "Amount", align: "right" },
    ],
    rows: estimates.map((est) => ({
      docNumber: est.DocNumber || est.Id || "N/A",
      txnDate: est.TxnDate || "",
      customer: est.CustomerRef?.name || est.CustomerRef?.value || "Unknown",
      status: est.TxnStatus || "Pending",
      amount: money(Number(est.TotalAmt) || 0),
    })),
    totalLabel: "Total estimate amount",
    totalValue: total,
  };
}

async function buildAcceptedEstimatesReport(userId?: string): Promise<ReportDefinition> {
  const data = await qbo<any>(
    "SELECT * FROM Estimate WHERE TxnStatus = 'Accepted' ORDERBY TxnDate DESC MAXRESULTS 1000",
    userId
  );
  const estimates: any[] = data?.QueryResponse?.Estimate || [];
  const total = estimates.reduce((sum, est) => sum + (Number(est.TotalAmt) || 0), 0);

  return {
    title: "Accepted Estimates (Not Yet Invoiced/Paid)",
    subtitle: "Estimates marked Accepted in QuickBooks",
    columns: [
      { key: "docNumber", label: "Estimate #" },
      { key: "txnDate", label: "Date" },
      { key: "customer", label: "Customer" },
      { key: "acceptedDate", label: "Accepted Date" },
      { key: "amount", label: "Amount", align: "right" },
    ],
    rows: estimates.map((est) => ({
      docNumber: est.DocNumber || est.Id || "N/A",
      txnDate: est.TxnDate || "",
      customer: est.CustomerRef?.name || est.CustomerRef?.value || "Unknown",
      acceptedDate: est.AcceptedDate || "",
      amount: money(Number(est.TotalAmt) || 0),
    })),
    totalLabel: "Accepted estimate total",
    totalValue: total,
  };
}

async function buildSalesRangeReport(
  range: "today" | "this-week" | "last-week" | "this-month" | "last-month" | "ytd",
  userId?: string
): Promise<ReportDefinition> {
  const ctx = getBusinessDateContext(new Date(), BUSINESS_TIME_ZONE);

  const shiftYmd = (ymd: string, deltaDays: number) => {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + deltaDays);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };

  const lastWeekStart = shiftYmd(ctx.weekStart, -7);
  const lastWeekEnd = shiftYmd(ctx.weekStart, -1);

  let startDate = ctx.today;
  let endDate = ctx.today;
  let label = "Today";

  if (range === "this-week") {
    startDate = ctx.weekStart;
    endDate = ctx.today;
    label = "This Week";
  } else if (range === "last-week") {
    startDate = lastWeekStart;
    endDate = lastWeekEnd;
    label = "Last Week";
  } else if (range === "this-month") {
    startDate = ctx.monthStart;
    endDate = ctx.today;
    label = "This Month";
  } else if (range === "last-month") {
    startDate = ctx.lastMonthStart;
    endDate = ctx.lastMonthEnd;
    label = "Last Month";
  } else if (range === "ytd") {
    startDate = ctx.yearStart;
    endDate = ctx.today;
    label = "Year To Date";
  } else if (range === "today") {
    startDate = ctx.today;
    endDate = ctx.today;
    label = "Today";
  }

  const [payResult, salesReceiptResult] = await Promise.allSettled([
    qbo<any>(
      `SELECT * FROM Payment WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' ORDERBY TxnDate DESC MAXRESULTS 1000`,
      userId
    ),
    qbo<any>(
      `SELECT * FROM SalesReceipt WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' ORDERBY TxnDate DESC MAXRESULTS 1000`,
      userId
    ),
  ]);

  const payments: any[] = payResult.status === "fulfilled" ? payResult.value?.QueryResponse?.Payment || [] : [];
  const salesReceiptsRaw: any[] =
    salesReceiptResult.status === "fulfilled" ? salesReceiptResult.value?.QueryResponse?.SalesReceipt || [] : [];
  const salesReceipts = salesReceiptsRaw.filter((receipt: any) => {
    const txnSource = String(receipt?.TxnSource || "").toUpperCase();
    return txnSource === "INTUITPAYMENT" || !!receipt?.CreditCardPayment;
  });

  const paymentRows = payments.map((p) => {
    const total = Number(p.TotalAmt) || 0;
    const unapplied = Number(p.UnappliedAmt) || 0;
    const applied = Math.max(total - unapplied, 0);
    return {
      txnDate: p.TxnDate || "",
      source: "Payment",
      customer: p.CustomerRef?.name || p.CustomerRef?.value || "Unknown",
      amount: applied,
    };
  });

  const salesReceiptRows = salesReceipts.map((r) => ({
    txnDate: r.TxnDate || "",
    source: "SalesReceipt",
    customer: r.CustomerRef?.name || r.CustomerRef?.value || "Unknown",
    amount: Number(r.TotalAmt) || 0,
  }));

  const rows = [...paymentRows, ...salesReceiptRows]
    .sort((a, b) => String(b.txnDate).localeCompare(String(a.txnDate)))
    .map((r, idx) => ({
      id: idx + 1,
      txnDate: r.txnDate,
      source: r.source,
      customer: r.customer,
      amount: money(r.amount),
      numericAmount: r.amount,
    }));

  const total = rows.reduce((sum, r: any) => sum + (Number(r.numericAmount) || 0), 0);

  return {
    title: `Sales Report (${label})`,
    subtitle: `${startDate} to ${endDate}`,
    columns: [
      { key: "txnDate", label: "Date" },
      { key: "source", label: "Source" },
      { key: "customer", label: "Customer" },
      { key: "amount", label: "Amount", align: "right" },
    ],
    rows,
    totalLabel: "Total received",
    totalValue: total,
  };
}

export async function GET(req: NextRequest) {
  try {
    const type = (req.nextUrl.searchParams.get("type") || "").toLowerCase();
    const range = (req.nextUrl.searchParams.get("range") || "").toLowerCase();
    const userId = (await getUserId()) || undefined;

    let report: ReportDefinition;
    switch (type) {
      case "open-invoices":
        report = await buildOpenInvoicesReport(userId);
        break;
      case "estimates":
        report = await buildEstimatesReport(userId);
        break;
      case "accepted-estimates-unpaid":
        report = await buildAcceptedEstimatesReport(userId);
        break;
      case "sales":
        report = await buildSalesRangeReport(
          (range as "today" | "this-week" | "last-week" | "this-month" | "last-month" | "ytd") || "ytd",
          userId
        );
        break;
      case "sales-week":
        report = await buildSalesRangeReport("this-week", userId);
        break;
      case "sales-month":
        report = await buildSalesRangeReport("this-month", userId);
        break;
      case "sales-ytd":
        report = await buildSalesRangeReport("ytd", userId);
        break;
      default:
        return NextResponse.json(
          {
            error:
              "Unknown report type. Use one of: open-invoices, estimates, accepted-estimates-unpaid, sales (with range), sales-week, sales-month, sales-ytd",
          },
          { status: 400 }
        );
    }

    return new NextResponse(buildHtml(report), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to build printable report" }, { status: 500 });
  }
}
