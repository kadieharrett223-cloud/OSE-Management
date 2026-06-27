import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type InventoryImportRow = {
  name: string;
  onFloor: number;
  sold: number;
  available: number;
};

const toInt = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
};

export async function POST(req: Request) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "rows array required" }, { status: 400 });
  }

  const mode = body.mode === "append" ? "append" : "replace";

  const rows = (body.rows as any[])
    .map((row): InventoryImportRow => ({
      name: String(row?.name || "").trim(),
      onFloor: toInt(row?.onFloor),
      sold: toInt(row?.sold),
      available: toInt(row?.available),
    }))
    .filter((row) => row.name.length > 0);

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows found to import" }, { status: 400 });
  }

  try {
    if (mode === "replace") {
      await prisma.$transaction(async (tx) => {
        await tx.inventoryOrderEntry.deleteMany({});
        await tx.inventoryProduct.deleteMany({});
        await tx.inventoryProduct.createMany({
          data: rows,
        });
      });
    } else {
      await prisma.$transaction(
        rows.map((row) =>
          prisma.inventoryProduct.upsert({
            where: { name: row.name },
            create: row,
            update: {
              onFloor: row.onFloor,
              sold: row.sold,
              available: row.available,
            },
          })
        )
      );
    }

    const total = await prisma.inventoryProduct.count();
    return NextResponse.json({ imported: rows.length, totalProducts: total, mode });
  } catch (error) {
    console.error("inventory import error", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
