import { NextResponse } from "next/server";
import { ensureAccessToken } from "@/lib/qbo";

export async function POST() {
  try {
    const { accessToken, realmId } = await ensureAccessToken();
    return NextResponse.json({ ok: true, realmId, accessToken: "(redacted)", refreshed: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to refresh" }, { status: 500 });
  }
}
