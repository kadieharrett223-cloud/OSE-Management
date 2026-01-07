export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/qbo";
import { getServerSupabaseClient } from "@/lib/supabase";

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

    // Persist tokens (soft requirement: SUPABASE_SERVICE_ROLE_KEY must be set)
    const supabase = getServerSupabaseClient();
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
    const refreshExpiresAt = new Date(Date.now() + tokenResponse.x_refresh_token_expires_in * 1000).toISOString();

    const { error: upsertError } = await supabase
      .from("qbo_tokens")
      .upsert({
        id: "primary",
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        realm_id: tokenResponse.realmId || realmId,
        token_type: tokenResponse.token_type,
        expires_at: expiresAt,
        refresh_expires_at: refreshExpiresAt,
        state,
      });

    if (upsertError) throw upsertError;

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
