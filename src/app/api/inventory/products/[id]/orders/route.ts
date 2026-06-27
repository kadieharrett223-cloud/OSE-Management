import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const product = await prisma.inventoryProduct.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const orders = await prisma.inventoryOrderEntry.findMany({
      where: { productId: params.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: orders });
  } catch (error) {
    console.error("inventory order list error", error);
    return NextResponse.json({ error: "Failed to load order entries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const customerName = String(body?.customerName || "").trim();
  const invoiceNumber = String(body?.invoiceNumber || "").trim();

  if (!customerName || !invoiceNumber) {
    return NextResponse.json({ error: "Customer name and invoice number are required" }, { status: 400 });
  }

  try {
    const product = await prisma.inventoryProduct.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const created = await prisma.inventoryOrderEntry.create({
      data: {
        productId: params.id,
        customerName,
        invoiceNumber,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("inventory order create error", error);
    return NextResponse.json({ error: "Failed to create order entry" }, { status: 500 });
  }
}
