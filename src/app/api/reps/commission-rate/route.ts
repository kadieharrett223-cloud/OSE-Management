import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  try {
    const repName = req.nextUrl.searchParams.get("repName");
    if (!repName) {
      return NextResponse.json({ error: "repName is required" }, { status: 400 });
    }
    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from("rep_commission_rates")
      .select("commission_rate")
      .eq("rep_name", repName)
      .maybeSingle();

    if (error && !String(error.message || "").includes("relation")) throw error;
    const commissionRate = data?.commission_rate ?? 0.05;
    return NextResponse.json({ ok: true, repName, commissionRate });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch commission rate" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is not set on the server. Saving commission rates requires the service role key. Add it to your environment (e.g., .env.local) and restart the server." },
        { status: 503 }
      );
    }
    const body = await req.json();
    const repName = String(body.repName || "");
    const commissionRate = Number(body.commissionRate);
    if (!repName || !Number.isFinite(commissionRate)) {
      return NextResponse.json({ error: "repName and commissionRate are required" }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();
    const { error } = await supabase
      .from("rep_commission_rates")
      .upsert({ rep_name: repName, commission_rate: commissionRate, updated_at: new Date().toISOString() });

    if (error) throw error;
    return NextResponse.json({ ok: true, repName, commissionRate });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to save commission rate" }, { status: 500 });
  }
}
