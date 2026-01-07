export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/qbo";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    // Require authenticated admin to start QBO connect
    const session: any = await getServerSession(authOptions as any);
    const role = (session?.user?.role ?? "").toString().toLowerCase();
    if (!session) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }
    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }
    const state = "ose-qbo"; // TODO: replace with CSRF-safe state if needed
    const url = buildAuthorizeUrl(state);
    const debug = req.nextUrl.searchParams.get("debug");
    if (debug) {
      return NextResponse.json({
        ok: true,
        authorizeUrl: url,
        redirectUri: process.env.QBO_REDIRECT_URI,
        clientId: process.env.QBO_CLIENT_ID ? "set" : "missing",
        environment: process.env.QBO_ENVIRONMENT,
        user: session?.user?.email || null,
        role,
        isAdmin: role === "admin",
      });
    }
    return NextResponse.redirect(url);
  } catch (error: any) {
    console.error("QBO connect error", error);
    return NextResponse.json({ error: error.message || "Failed to start QBO auth" }, { status: 500 });
  }
}
