import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "REP") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.user.repId) {
    return NextResponse.json({ error: "No rep mapping" }, { status: 400 });
  }

  const repId = session.user.repId;

  // Aggregate from stored invoices; fallback to zeros if none exist yet
  const invoices = await prisma.invoice.findMany({
    where: { repId },
    include: { lines: true },
  });

  const invoiceCount = invoices.length;
  const totalCommission = invoices.reduce((sum, inv) => sum + inv.totalCommission, 0);
  const totalCommissionable = invoices.reduce((sum, inv) => sum + inv.totalCommissionable, 0);
  const shippingDeducted = invoices.reduce((sum, inv) => sum + inv.shippingDeducted, 0);

  const recent = invoices
    .sort((a, b) => b.txnDate.getTime() - a.txnDate.getTime())
    .slice(0, 5)
    .map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      txnDate: inv.txnDate,
      commission: inv.totalCommission,
    }));

  return NextResponse.json({
    totalCommission,
    totalCommissionable,
    shippingDeducted,
    invoiceCount,
    recent,
  });
}
