import { NextResponse } from "next/server";
import { ensureAccessToken } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";

export async function POST() {
  try {
    const userId = await getUserId();
    const { accessToken, realmId } = await ensureAccessToken(userId || undefined);
    return NextResponse.json({ ok: true, realmId, accessToken: "(redacted)", refreshed: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to refresh" }, { status: 500 });
  }
}
