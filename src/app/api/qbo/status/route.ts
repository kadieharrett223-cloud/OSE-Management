export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { getTokenRow } from "@/lib/qbo";

/**
 * Lightweight QBO connection check.
 * Returns { connected: true } if a valid non-expired token exists in storage,
 * without making any live API call to QuickBooks.
 */
export async function GET() {
  try {
    const row = await getTokenRow();
    if (!row || !row.access_token || !row.realm_id) {
      return NextResponse.json({ connected: false, reason: "no_token" });
    }

    const refreshExpiresAt = row.refresh_expires_at ? Date.parse(row.refresh_expires_at) : 0;
    if (refreshExpiresAt && refreshExpiresAt < Date.now()) {
      return NextResponse.json({ connected: false, reason: "refresh_expired" });
    }

    return NextResponse.json({ connected: true, realmId: row.realm_id });
  } catch (error: any) {
    return NextResponse.json({ connected: false, reason: "error", error: error.message }, { status: 200 });
  }
}
