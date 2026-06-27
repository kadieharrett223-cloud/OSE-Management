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
      include: {
        _count: {
          select: { orderEntries: true },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: product.id,
        name: product.name,
        onFloor: product.onFloor,
        sold: product.sold,
        available: product.available,
        orderCount: product._count.orderEntries,
      },
    });
  } catch (error) {
    console.error("inventory product details error", error);
    return NextResponse.json({ error: "Failed to load product" }, { status: 500 });
  }
}
