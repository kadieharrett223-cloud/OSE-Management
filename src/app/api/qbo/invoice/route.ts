import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch } from "@/lib/qbo";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const customerRef = body.customerRef;
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const txnDate: string | undefined = body.txnDate;

    if (!customerRef || !customerRef.value) {
      return NextResponse.json({ error: "customerRef.value is required (existing QBO customer Id)" }, { status: 400 });
    }
    if (lines.length === 0) {
      return NextResponse.json({ error: "lines are required" }, { status: 400 });
    }

    const qboLines = lines.map((line: any) => {
      if (!line.amount) {
        throw new Error("Each line requires amount");
      }
      if (!line.itemRef || !line.itemRef.value) {
        throw new Error("Each line requires itemRef.value (existing QBO item Id)");
      }
      return {
        DetailType: "SalesItemLineDetail",
        Amount: line.amount,
        Description: line.description || undefined,
        SalesItemLineDetail: {
          ItemRef: line.itemRef,
          Qty: line.qty || 1,
          UnitPrice: line.unitPrice || undefined,
        },
      };
    });

    const payload: Record<string, unknown> = {
      CustomerRef: customerRef,
      Line: qboLines,
    };
    if (txnDate) payload.TxnDate = txnDate;

    const data = await authorizedQboFetch<any>(`/invoice?minorversion=65`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create invoice" }, { status: 500 });
  }
}
