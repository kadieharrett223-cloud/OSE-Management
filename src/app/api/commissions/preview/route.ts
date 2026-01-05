import { NextResponse } from "next/server";
import { calculateCommissionForInvoice, PriceListItem } from "@/lib/commissions";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { lines, priceList, repCommissionRate, missingSkuStrategy } = body as {
    lines: { sku: string; quantity: number; unitPrice?: number; description?: string }[];
    priceList: PriceListItem[];
    repCommissionRate: number;
    missingSkuStrategy?: "exclude" | "zero-shipping";
  };

  if (!Array.isArray(lines) || !Array.isArray(priceList) || !Number.isFinite(repCommissionRate)) {
    return NextResponse.json({ error: "lines, priceList, repCommissionRate are required" }, { status: 400 });
  }

  const result = calculateCommissionForInvoice(lines, priceList, {
    repCommissionRate,
    missingSkuStrategy,
  });

  return NextResponse.json(result);
}
