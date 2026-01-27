export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, saveTokenRow } from "@/lib/qbo";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const realmId = req.nextUrl.searchParams.get("realmId");
  const state = req.nextUrl.searchParams.get("state");

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForToken(code, realmId);

    // Enforce allowed QuickBooks company via realmId, if configured
    const allowedRealm = process.env.QBO_ALLOWED_REALM_ID;
    const resolvedRealm = tokenResponse.realmId || realmId || "";
    if (allowedRealm && resolvedRealm !== allowedRealm) {
      return NextResponse.json(
        { error: "Unauthorized QuickBooks company (realmId mismatch)" },
        { status: 403 }
      );
    }

    // Persist tokens (Supabase if available, else local file fallback)
    // Ensure realmId is included in the saved payload
    if (!tokenResponse.realmId && realmId) {
      tokenResponse.realmId = realmId;
    }
    const { expiresAt, refreshExpiresAt } = await saveTokenRow(tokenResponse, state || undefined);

    return NextResponse.json({
      ok: true,
      realmId: tokenResponse.realmId || realmId,
      expires_at: expiresAt,
      refresh_expires_at: refreshExpiresAt,
    });
  } catch (error: any) {
    console.error("QBO callback error", error);
    return NextResponse.json({ error: error.message || "Token exchange failed" }, { status: 500 });
  }
}
