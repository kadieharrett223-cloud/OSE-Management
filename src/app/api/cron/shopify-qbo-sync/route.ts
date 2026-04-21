import { NextRequest, NextResponse } from "next/server";
import { syncShopifyOrdersToQbo } from "@/lib/shopify-qbo-sync";

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const providedSecret = bearer || req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  return !!cronSecret && providedSecret === cronSecret;
}

async function runSync(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const since = req.nextUrl.searchParams.get("since") || undefined;
    const result = await syncShopifyOrdersToQbo({
      since,
      triggerSource: "cron",
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to run Shopify -> QBO sync" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return runSync(req);
}

export async function POST(req: NextRequest) {
  return runSync(req);
}