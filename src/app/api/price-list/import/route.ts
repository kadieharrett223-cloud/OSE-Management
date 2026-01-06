import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "items array required" }, { status: 400 });
  }

  const items = body.items as {
    sku: string;
    description?: string;
    currentSalePricePerUnit: number;
    shippingIncludedPerUnit: number;
  }[];

  try {
    await prisma.$transaction([
      prisma.priceListItem.deleteMany({}),
      prisma.priceListItem.createMany({ data: items.map((i) => ({
        sku: i.sku,
        description: i.description ?? null,
        currentSalePricePerUnit: Number(i.currentSalePricePerUnit) || 0,
        shippingIncludedPerUnit: Number(i.shippingIncludedPerUnit) || 0,
      })) }),
    ]);
    return NextResponse.json({ imported: items.length });
  } catch (error) {
    console.error("price list import error", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
