import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const products = await prisma.inventoryProduct.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { orderEntries: true },
        },
      },
    });

    return NextResponse.json({
      data: products.map((product) => ({
        id: product.id,
        name: product.name,
        onFloor: product.onFloor,
        sold: product.sold,
        available: product.available,
        orderCount: product._count.orderEntries,
      })),
    });
  } catch (error) {
    console.error("inventory products list error", error);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}
