import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch } from "@/lib/qbo";
import { getPriceList, matchItemAndCalculateShipping } from "@/lib/shippingDeduction";
import { getServerSupabaseClient } from "@/lib/supabase";
import { canonicalizeRep, aliasesForCanonical } from "@/lib/repAliases";

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  txnDate: string;
  totalAmount: number;
  totalCommissionable: number;
  totalShippingDeducted: number;
  commission: number;
  lines: {
    sku?: string;
    description: string;
    qty: number;
    unitPrice: number;
    lineAmount: number;
    shippingDeducted: number;
    commissionable: number;
    matched: boolean;
  }[];
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

    // Fetch price list for shipping deductions
    const priceList = await getPriceList();
    // Commission rate for this rep (canonical + aliases)
    const supabase = getServerSupabaseClient();
    const canonical = canonicalizeRep(repName);
    const aliasList = aliasesForCanonical(canonical);
    const { data: rateRows } = await supabase
      .from("rep_commission_rates")
      .select("rep_name, commission_rate")
      .in("rep_name", aliasList);
    const exact = (rateRows || []).find((r: any) => r.rep_name === canonical);
    const commissionRate = Number((exact?.commission_rate ?? (rateRows?.[0]?.commission_rate)) ?? 0.05);

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

        // Match against any alias for the canonical rep (case-insensitive contains or exact)
        const invoiceLower = invoiceRepName.toLowerCase();
        return aliasList.some((alias) => {
          const a = alias.toLowerCase();
          return invoiceLower.includes(a) || invoiceLower === a;
        });
      })
      .map((inv: any) => {
        const totalAmount = Number(inv.TotalAmt) || 0;
        const balance = Number(inv.Balance) || 0;
        const paidAmount = totalAmount - balance;

        // Parse line items with shipping deduction
        let totalCommissionable = 0;
        let totalShippingDeducted = 0;
        
        const lines = (inv.Line || []).map((line: any) => {
          let lineAmount = Number(line.Amount) || 0;
          let itemName = "";
          let itemRef = "";
          let qty = 1;
          let unitPrice = lineAmount;

          if (line.SalesItemLineDetail) {
            const detail = line.SalesItemLineDetail;
            itemName = detail.ItemRef?.name || detail.ItemRef?.value || "";
            itemRef = detail.ItemRef?.value || "";
            qty = Number(detail.Qty) || 1;
            unitPrice = Number(detail.UnitPrice) || lineAmount / qty;

            // Match to price list and calculate shipping deduction
            const matched = matchItemAndCalculateShipping(
              itemName,
              itemRef,
              qty,
              unitPrice,
              priceList
            );

            totalCommissionable += matched.commissionable;
            totalShippingDeducted += matched.shippingDeducted;

            return {
              sku: matched.matchedSku || itemName,
              description: line.Description || itemName || "Item",
              qty,
              unitPrice,
              lineAmount,
              shippingDeducted: matched.shippingDeducted,
              commissionable: matched.commissionable,
              matched: matched.matched,
            };
          } else {
            // Not a sales item (discount, tax, etc)
            totalCommissionable += lineAmount;
            return {
              sku: "",
              description: line.Description || "Other",
              qty: 1,
              unitPrice: lineAmount,
              lineAmount,
              shippingDeducted: 0,
              commissionable: lineAmount,
              matched: false,
            };
          }
        });

        return {
          id: inv.Id,
          invoiceNumber: inv.DocNumber || "Unknown",
          txnDate: inv.TxnDate || new Date().toISOString().split("T")[0],
          totalAmount: paidAmount,
          totalCommissionable,
          totalShippingDeducted,
          commission: totalCommissionable * commissionRate,
          lines,
        };
      });

    const totalCommission = repInvoices.reduce(
      (sum, inv) => sum + inv.commission,
      0
    );

    return NextResponse.json({
      ok: true,
      repName,
      invoices: repInvoices,
      count: repInvoices.length,
      totalCommissionable: repInvoices.reduce((sum, inv) => sum + inv.totalCommissionable, 0),
      totalShippingDeducted: repInvoices.reduce((sum, inv) => sum + inv.totalShippingDeducted, 0),
      totalCommission,
      commissionRate,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch rep invoices" },
      { status: 500 }
    );
  }
}

