import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

function isMissingTableError(error: any) {
  const code = error?.code?.toString();
  const message = error?.message?.toString().toLowerCase?.();
  // PGRST205: table missing in PostgREST schema cache. 42P01: Postgres undefined table.
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    (message && message.includes("monthly_goals") && message.includes("not"))
  );
}

function parseYearMonth(params: URLSearchParams) {
  const now = new Date();
  const year = parseInt(params.get("year") || `${now.getFullYear()}`, 10);
  const month = parseInt(params.get("month") || `${now.getMonth() + 1}`, 10);
  return { year, month };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { year, month } = parseYearMonth(req.nextUrl.searchParams);
  const supabase = getServerSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("monthly_goals")
      .select("id, year, month, goal_amount, notes, updated_at")
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ ok: true, goal: data || null });
  } catch (error: any) {
    // If the table is missing, don't fail the dashboard; return a soft empty payload.
    if (isMissingTableError(error)) {
      return NextResponse.json({ ok: true, goal: null, warning: "monthly_goals table not found" });
    }
    console.error("Monthly goal fetch error", error);
    return NextResponse.json({ error: error.message || "Failed to fetch goal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { year, month } = parseYearMonth(req.nextUrl.searchParams);
  const goalAmount = Number(body.goalAmount ?? body.goal_amount);
  const notes = typeof body.notes === "string" ? body.notes : null;

  console.log("[monthly-goals POST] Received:", { goalAmount, year, month, notes, body });

  if (!goalAmount || Number.isNaN(goalAmount) || goalAmount <= 0) {
    console.log("[monthly-goals POST] Invalid goal amount");
    return NextResponse.json({ error: "goalAmount must be a positive number" }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();

  try {
    console.log("[monthly-goals POST] Attempting upsert...");
    const { data, error } = await supabase
      .from("monthly_goals")
      .upsert({ year, month, goal_amount: goalAmount, notes })
      .select("id, year, month, goal_amount, notes, updated_at")
      .single();

    console.log("[monthly-goals POST] Upsert result:", { data, error });

    if (error) {
      console.error("[monthly-goals POST] Error from upsert:", error);
      throw error;
    }
    
    console.log("[monthly-goals POST] Returning success:", { ok: true, goal: data });
    return NextResponse.json({ ok: true, goal: data });
  } catch (error: any) {
    console.error("[monthly-goals POST] Error caught:", error);
    if (isMissingTableError(error)) {
      return NextResponse.json({
        ok: false,
        error: "monthly_goals table not found",
        hint: "Create the table or run the Supabase migrations",
      });
    }
    console.error("Monthly goal upsert error", error);
    return NextResponse.json({ error: error.message || "Failed to save goal" }, { status: 500 });
  }
}
