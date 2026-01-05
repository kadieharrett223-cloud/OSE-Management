import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch } from "@/lib/qbo";

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
