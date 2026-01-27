import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch } from "@/lib/qbo";

interface InvoiceLine {
  description: string;
  qty: number;
  unitPrice: number;
  lineAmount: number;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  txnDate: string;
  totalAmount: number;
  lines: InvoiceLine[];
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const repName = searchParams.get("repName");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status") || "paid";

    if (!repName) {
      return NextResponse.json(
        { error: "repName query parameter is required" },
        { status: 400 }
      );
    }

    // Build query for invoices
    let query = "SELECT * FROM Invoice";
    const conditions: string[] = [];

    if (startDate) {
      conditions.push(`TxnDate >= '${startDate}'`);
    }
    if (endDate) {
      conditions.push(`TxnDate <= '${endDate}'`);
    }

    if (status.toLowerCase() === "paid") {
      conditions.push("Balance = '0'");
    } else if (status.toLowerCase() === "unpaid") {
      conditions.push("Balance > '0'");
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDERBY TxnDate DESC MAXRESULTS 1000";

    const data = await authorizedQboFetch<any>(
      `/query?query=${encodeURIComponent(query)}&minorversion=65`
    );

    const allInvoices = data?.QueryResponse?.Invoice || [];

    // Filter and map invoices
    const repInvoices: InvoiceDetail[] = allInvoices
      .filter((inv: any) => {
        // Try to match rep name from custom fields or memo
        let invoiceRepName = "";
        
        if (inv.CustomField && Array.isArray(inv.CustomField)) {
          const repField = inv.CustomField.find((f: any) =>
            f.Name === "Sales Rep" || f.Name === "SalesRep" || f.Name === "Rep"
          );
          if (repField && repField.StringValue) {
            invoiceRepName = repField.StringValue;
          }
        }

        if (!invoiceRepName && inv.CustomerMemo?.value) {
          const memo = inv.CustomerMemo.value;
          const repMatch = memo.match(/Rep:\s*([A-Za-z\s/]+)/i);
          if (repMatch) {
            invoiceRepName = repMatch[1].trim();
          }
        }

        // Direct match on rep name
        return invoiceRepName === repName;
      })
      .map((inv: any) => {
        const totalAmount = Number(inv.TotalAmt) || 0;
        const balance = Number(inv.Balance) || 0;
        const paidAmount = totalAmount - balance;

        // Parse line items - just show what was sold
        const lines: InvoiceLine[] = (inv.Line || [])
          .filter((line: any) => line.SalesItemLineDetail)
          .map((line: any) => {
            const detail = line.SalesItemLineDetail;
            const itemName = detail.ItemRef?.name || detail.ItemRef?.value || "Unknown Item";
            const qty = Number(detail.Qty) || 1;
            const unitPrice = Number(detail.UnitPrice) || 0;
            const lineAmount = Number(line.Amount) || 0;

            return {
              description: itemName,
              qty,
              unitPrice,
              lineAmount,
            };
          });

        return {
          id: inv.Id,
          invoiceNumber: inv.DocNumber || "Unknown",
          txnDate: inv.TxnDate || new Date().toISOString().split("T")[0],
          totalAmount: paidAmount,
          lines,
        };
      });

    return NextResponse.json({
      ok: true,
      repName,
      invoices: repInvoices,
      count: repInvoices.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch rep invoices" },
      { status: 500 }
    );
  }
}

