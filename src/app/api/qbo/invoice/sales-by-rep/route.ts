import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch } from "@/lib/qbo";
import { parseRepCode, calculateCommission, getBonusProgress } from "@/lib/repCommissionLogic";

interface RepSales {
  repName: string;
  isPrimary: boolean;      // true if KLH, false if SC/CR
  totalSales: number;
  commission: number;
  invoiceCount: number;
  commissionRate: number;
  bonusProgress?: {        // Only for SC/CR
    salesAmount: number;
    bonusThreshold: number;
    percentToThreshold: number;
    hasEarnedBonus: boolean;
  };
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status") || "paid";

    // Build the QuickBooks query
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

    const invoices = data?.QueryResponse?.Invoice || [];
    
    // First pass: group by full rep code (including slash)
    const repMapFull = new Map<string, { total: number; count: number }>();

    for (const invoice of invoices) {
      let repCode = "Unassigned";
      
      if (invoice.CustomField && Array.isArray(invoice.CustomField)) {
        const repField = invoice.CustomField.find((f: any) => 
          f.Name === "Sales Rep" || f.Name === "SalesRep" || f.Name === "Rep"
        );
        if (repField && repField.StringValue) {
          repCode = repField.StringValue.trim();
        }
      }
      
      if (repCode === "Unassigned" && invoice.CustomerMemo?.value) {
        const memo = invoice.CustomerMemo.value;
        const repMatch = memo.match(/Rep:\s*([A-Za-z\s/]+)/i);
        if (repMatch) {
          repCode = repMatch[1].trim();
        }
      }

      const totalAmount = Number(invoice.TotalAmt) || 0;
      const balance = Number(invoice.Balance) || 0;
      const paidAmount = totalAmount - balance;

      if (!repMapFull.has(repCode)) {
        repMapFull.set(repCode, { total: 0, count: 0 });
      }

      const entry = repMapFull.get(repCode)!;
      entry.total += paidAmount;
      entry.count += 1;
    }

    // Second pass: split by primary and assistant rep
    const repMapSplit = new Map<string, RepSales>();

    for (const [repCode, { total, count }] of repMapFull.entries()) {
      const parsed = parseRepCode(repCode);
      
      // Add primary rep entry
      const primaryKey = parsed.primaryRep;
      if (!repMapSplit.has(primaryKey)) {
        repMapSplit.set(primaryKey, {
          repName: primaryKey,
          isPrimary: true,
          totalSales: 0,
          commission: 0,
          invoiceCount: 0,
          commissionRate: 0.05,
        });
      }
      
      const primaryEntry = repMapSplit.get(primaryKey)!;
      primaryEntry.totalSales += total;
      primaryEntry.invoiceCount += count;
      // Primary rep gets 100% of commission on all sales
      primaryEntry.commission = primaryEntry.totalSales * primaryEntry.commissionRate;

      // Add assistant rep entry (if exists)
      if (parsed.assistantRep) {
        if (!repMapSplit.has(parsed.assistantRep)) {
          repMapSplit.set(parsed.assistantRep, {
            repName: parsed.assistantRep,
            isPrimary: false,
            totalSales: 0,
            commission: 0,
            invoiceCount: 0,
            commissionRate: 0.05,
          });
        }

        const assistantEntry = repMapSplit.get(parsed.assistantRep)!;
        assistantEntry.totalSales += total;
        assistantEntry.invoiceCount += count;
        
        // Calculate commission based on bonus threshold
        assistantEntry.commission += calculateCommission(
          parsed.assistantRep,
          total,
          assistantEntry.totalSales,
          assistantEntry.commissionRate
        );

        // Add bonus progress info
        const bonusProgress = getBonusProgress(parsed.assistantRep, assistantEntry.totalSales);
        if (bonusProgress.isBonusRep) {
          assistantEntry.bonusProgress = {
            salesAmount: bonusProgress.salesAmount,
            bonusThreshold: bonusProgress.bonusThreshold,
            percentToThreshold: bonusProgress.percentToThreshold,
            hasEarnedBonus: bonusProgress.hasEarnedBonus,
          };
        }
      }
    }

    // Convert to array and sort by sales
    const repSales = Array.from(repMapSplit.values()).sort(
      (a, b) => b.totalSales - a.totalSales
    );

    return NextResponse.json({
      ok: true,
      reps: repSales,
      totalInvoices: invoices.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch sales by rep" },
      { status: 500 }
    );
  }
}
