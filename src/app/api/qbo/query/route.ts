import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authorizedQboFetch } from "@/lib/qbo";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const sql = params.get("q");
  const resource = params.get("resource");
  const limit = params.get("limit") || "50";

  if (!sql && !resource) {
    return NextResponse.json(
      { error: "Provide either q (SQL) or resource (e.g. Customer, Item)" },
      { status: 400 }
    );
  }

  try {
    let path: string;

    if (sql) {
      path = `/query?query=${encodeURIComponent(sql)}`;
    } else {
      const safeResource = resource!.replace(/[^a-zA-Z]/g, "");
      const maxResults = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 1000);
      path = `/query?query=${encodeURIComponent(`select * from ${safeResource} maxresults ${maxResults}`)}`;
    }

    const data = await authorizedQboFetch<any>(path);
    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error("QBO query error", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch from QBO" },
      { status: 500 }
    );
  }
}
