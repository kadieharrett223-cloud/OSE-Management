import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch } from "@/lib/qbo";
import { parseRepCode, calculateCommission, getBonusProgress } from "@/lib/repCommissionLogic";
import { canonicalizeRep, aliasesForCanonical } from "@/lib/repAliases";
import { getPriceList, matchItemAndCalculateShipping } from "@/lib/shippingDeduction";
import { getServerSupabaseClient } from "@/lib/supabase";

interface RepSales {
  repName: string;
  isPrimary: boolean;      // true if KLH, false if SC/CR
  totalSales: number;
  totalCommissionable: number;
  totalShippingDeducted: number;
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

    // Fetch price list for shipping deductions
    const priceList = await getPriceList();

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
    const repMapFull = new Map<string, { total: number; commissionable: number; shipping: number; count: number }>();

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

      // Calculate commissionable amount (with shipping deduction)
      let totalCommissionable = 0;
      let totalShippingDeducted = 0;

      if (invoice.Line && Array.isArray(invoice.Line)) {
        for (const line of invoice.Line) {
          if (line.SalesItemLineDetail) {
            const detail = line.SalesItemLineDetail;
            const itemName = detail.ItemRef?.name || "";
            const qty = Number(detail.Qty) || 1;
            const unitPrice = Number(detail.UnitPrice) || 0;
            const lineAmount = Number(line.Amount) || 0;

            const matched = matchItemAndCalculateShipping(
              itemName,
              detail.ItemRef?.value,
              qty,
              unitPrice,
              priceList
            );

            totalCommissionable += matched.commissionable;
            totalShippingDeducted += matched.shippingDeducted;
          } else {
            // Not a sales item (discount, tax, etc) — do not count toward commissionable
            // Keep shippingDeducted unchanged; exclude from commissionable
          }
        }
      } else {
        // No line detail available, use full amount
        totalCommissionable = paidAmount;
      }

      if (!repMapFull.has(repCode)) {
        repMapFull.set(repCode, { total: 0, commissionable: 0, shipping: 0, count: 0 });
      }

      const entry = repMapFull.get(repCode)!;
      entry.total += paidAmount;
      entry.commissionable += totalCommissionable;
      entry.shipping += totalShippingDeducted;
      entry.count += 1;
    }

    // Load custom commission rates, defaulting to 5%
    const allRepCodes = Array.from(repMapFull.keys()).flatMap((code) => {
      const p = parseRepCode(code);
      const primary = canonicalizeRep(p.primaryRep);
      const assistant = p.assistantRep ? canonicalizeRep(p.assistantRep) : undefined;
      return [primary, assistant].filter(Boolean) as string[];
    });
    const canonicalReps = Array.from(new Set(allRepCodes));
    const supabase = getServerSupabaseClient();
    const rateMap = new Map<string, number>();
    if (canonicalReps.length > 0) {
      // Query by aliases too so existing rows under aliases are respected
      const repNamesToQuery = Array.from(new Set(canonicalReps.flatMap((c) => aliasesForCanonical(c))));
      const { data } = await supabase
        .from("rep_commission_rates")
        .select("rep_name, commission_rate")
        .in("rep_name", repNamesToQuery);
      // Populate map by canonical key, preferring an exact canonical match if present
      for (const c of canonicalReps) {
        const aliases = aliasesForCanonical(c);
        const exact = (data || []).find((r: any) => r.rep_name === c);
        if (exact) {
          rateMap.set(c, Number(exact.commission_rate));
          continue;
        }
        const aliasRow = (data || []).find((r: any) => aliases.includes(r.rep_name));
        if (aliasRow) rateMap.set(c, Number(aliasRow.commission_rate));
      }
    }

    // Second pass: split by primary and assistant rep
    const repMapSplit = new Map<string, RepSales>();

    for (const [repCode, { total, commissionable, shipping, count }] of repMapFull.entries()) {
      const parsed = parseRepCode(repCode);
      
      // Add primary rep entry
      const primaryKey = canonicalizeRep(parsed.primaryRep);
      const primaryRate = rateMap.get(primaryKey) ?? 0.05;
      if (!repMapSplit.has(primaryKey)) {
        repMapSplit.set(primaryKey, {
          repName: primaryKey,
          isPrimary: true,
          totalSales: 0,
          totalCommissionable: 0,
          totalShippingDeducted: 0,
          commission: 0,
          invoiceCount: 0,
          commissionRate: primaryRate,
        });
      }
      
      const primaryEntry = repMapSplit.get(primaryKey)!;
      primaryEntry.totalSales += total;
      primaryEntry.totalCommissionable += commissionable;
      primaryEntry.totalShippingDeducted += shipping;
      primaryEntry.invoiceCount += count;
      // Primary rep gets commission on commissionable amount
      primaryEntry.commission = primaryEntry.totalCommissionable * primaryEntry.commissionRate;

      // Add assistant rep entry (if exists)
      if (parsed.assistantRep) {
        const assistantKey = canonicalizeRep(parsed.assistantRep);
        const assistantRate = rateMap.get(assistantKey) ?? 0.05;
        if (!repMapSplit.has(assistantKey)) {
          repMapSplit.set(assistantKey, {
            repName: assistantKey,
            isPrimary: false,
            totalSales: 0,
            totalCommissionable: 0,
            totalShippingDeducted: 0,
            commission: 0,
            invoiceCount: 0,
            commissionRate: assistantRate,
          });
        }

        const assistantEntry = repMapSplit.get(assistantKey)!;
        assistantEntry.totalSales += total;
        assistantEntry.totalCommissionable += commissionable;
        assistantEntry.totalShippingDeducted += shipping;
        assistantEntry.invoiceCount += count;
        
        // Calculate commission based on bonus threshold (using commissionable amount)
        assistantEntry.commission += calculateCommission(
          assistantKey,
          commissionable,
          assistantEntry.totalCommissionable,
          assistantEntry.commissionRate
        );

        // Add bonus progress info
        const bonusProgress = getBonusProgress(assistantKey, assistantEntry.totalCommissionable);
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

    // Convert to array and sort by sales, then consolidate any residual duplicates by repName
    const preliminary = Array.from(repMapSplit.values());
    const consolidated = new Map<string, typeof preliminary[number]>();
    for (const entry of preliminary) {
      const key = entry.repName;
      if (!consolidated.has(key)) {
        consolidated.set(key, { ...entry });
      } else {
        const acc = consolidated.get(key)!;
        acc.totalSales += entry.totalSales;
        acc.totalCommissionable += entry.totalCommissionable;
        acc.totalShippingDeducted += entry.totalShippingDeducted;
        acc.commission += entry.commission;
        acc.invoiceCount += entry.invoiceCount;
        // keep highest commissionRate if they differ
        acc.commissionRate = Math.max(acc.commissionRate, entry.commissionRate);
        // prefer marking as primary if any entry is primary
        acc.isPrimary = acc.isPrimary || entry.isPrimary;
        if (entry.bonusProgress) {
          acc.bonusProgress = entry.bonusProgress;
        }
      }
    }
    const repSales = Array.from(consolidated.values()).sort((a, b) => b.totalSales - a.totalSales);

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
