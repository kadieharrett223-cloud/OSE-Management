import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: { orderId: string } }) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const existing = await prisma.inventoryOrderEntry.findUnique({
      where: { id: params.orderId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Order entry not found" }, { status: 404 });
    }

    await prisma.inventoryOrderEntry.delete({
      where: { id: params.orderId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("inventory order delete error", error);
    return NextResponse.json({ error: "Failed to delete order entry" }, { status: 500 });
  }
}
