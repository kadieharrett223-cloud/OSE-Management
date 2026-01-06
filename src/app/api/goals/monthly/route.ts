import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

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

  if (!goalAmount || Number.isNaN(goalAmount) || goalAmount <= 0) {
    return NextResponse.json({ error: "goalAmount must be a positive number" }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("monthly_goals")
      .upsert({ year, month, goal_amount: goalAmount, notes })
      .select("id, year, month, goal_amount, notes, updated_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, goal: data });
  } catch (error: any) {
    console.error("Monthly goal upsert error", error);
    return NextResponse.json({ error: error.message || "Failed to save goal" }, { status: 500 });
  }
}
