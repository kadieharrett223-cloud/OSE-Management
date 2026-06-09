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
      return NextResponse.redirect(new URL("/settings?qbo=realm_mismatch", req.url));
    }

    // Ensure realmId is included in the saved payload
    if (!tokenResponse.realmId && realmId) {
      tokenResponse.realmId = realmId;
    }

    // Always save as "primary" — this app connects to a single QBO company.
    // Saving under a user-specific ID causes RLS failures when the Supabase
    // service role key is unavailable, which silently falls back to an
    // ephemeral file that is lost across serverless invocations.
    await saveTokenRow(tokenResponse, state || undefined, undefined);

    // Redirect back to the app so the user doesn't land on a raw JSON page
    return NextResponse.redirect(new URL("/settings?qbo=connected", req.url));
  } catch (error: any) {
    console.error("QBO callback error", error);
    const msg = encodeURIComponent(error.message || "Token exchange failed");
    return NextResponse.redirect(new URL(`/settings?qbo=error&msg=${msg}`, req.url));
  }
}
