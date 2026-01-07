import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch } from "@/lib/qbo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  try {
    // Fetch all items from QuickBooks with pagination
    const allItems: any[] = [];
    let start = 1;
    const pageSize = 1000; // QBO maxresults limit
    while (true) {
      const query = `SELECT * FROM Item STARTPOSITION ${start} MAXRESULTS ${pageSize}`;
      const data = await authorizedQboFetch<any>(
        `/query?query=${encodeURIComponent(query)}&minorversion=65`
      );
      const page = data?.QueryResponse?.Item || [];
      allItems.push(...page);
      if (page.length < pageSize) break;
      start += pageSize;
    }
    
    // Filter out sales tax codes and similar non-inventory entries
    const isSalesTaxLike = (item: any) => {
      const name: string = String(item?.Name || "");
      const type: string = String(item?.Type || "");
      const nameLower = name.toLowerCase();
      // Examples to exclude: "Sales Tax", names like "0302 Kennewick Service"
      const looksLikeTaxCode = /sales\s*tax|tax\b/.test(nameLower) || /^(\d{3,4})\s+.*\bservice\b/i.test(name);
      return type.toLowerCase() === "salestax" || looksLikeTaxCode;
    };

    const filteredItems = allItems.filter((item) => !isSalesTaxLike(item));

    return NextResponse.json({
      ok: true,
      items: filteredItems.map((item: any) => ({
        id: item.Id,
        name: item.Name,
        sku: item.Sku || item.Name,
        description: item.Description || item.Name,
        type: item.Type,
        incomeAccount: item.IncomeAccountRef?.name,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch items" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name: string = body.name || `Sample Item ${Date.now()}`;
    const incomeAccountRef = body.incomeAccountRef;

    if (!incomeAccountRef || !incomeAccountRef.value) {
      return NextResponse.json({ error: "incomeAccountRef.value is required (existing QBO account Id)" }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      Name: name,
      IncomeAccountRef: incomeAccountRef,
      Type: "Service",
    };

    const data = await authorizedQboFetch<any>(`/item?minorversion=65`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create item" }, { status: 500 });
  }
}
