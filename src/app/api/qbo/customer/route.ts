import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch } from "@/lib/qbo";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const displayName: string = body.displayName || `Sample Customer ${Date.now()}`;
    const companyName: string | undefined = body.companyName;
    const email: string | undefined = body.email;

    const payload: Record<string, unknown> = {
      DisplayName: displayName,
    };
    if (companyName) payload.CompanyName = companyName;
    if (email) payload.PrimaryEmailAddr = { Address: email };

    const data = await authorizedQboFetch<any>(`/customer?minorversion=65`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create customer" }, { status: 500 });
  }
}
