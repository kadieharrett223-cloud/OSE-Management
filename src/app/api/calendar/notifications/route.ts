import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

const ALLOWED_RECURRING = ["none", "daily", "weekly", "biweekly", "monthly", "yearly"] as const;

type RecurringType = (typeof ALLOWED_RECURRING)[number];

function isValidRecurring(value: string): value is RecurringType {
  return (ALLOWED_RECURRING as readonly string[]).includes(value);
}

function mapNotification(row: any) {
  return {
    id: row.id,
    title: row.title,
    date: row.event_date,
    recurring: row.recurring,
    notes: row.notes || "",
    source: "user" as const,
  };
}

export async function GET() {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from("calendar_mobile_notifications")
      .select("id, title, event_date, recurring, notes")
      .eq("is_active", true)
      .order("event_date", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, notifications: (data || []).map(mapNotification) });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load calendar notifications" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const title = (body?.title || "").toString().trim();
    const date = (body?.date || "").toString().trim();
    const recurring = (body?.recurring || "none").toString().trim();
    const notes = body?.notes ? body.notes.toString() : "";

    if (!title || !date) {
      return NextResponse.json({ error: "Title and date are required" }, { status: 400 });
    }

    if (!isValidRecurring(recurring)) {
      return NextResponse.json({ error: "Invalid recurring value" }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from("calendar_mobile_notifications")
      .insert({
        title,
        event_date: date,
        recurring,
        notes,
        created_by: session.user.email || session.user.id || "Unknown",
      })
      .select("id, title, event_date, recurring, notes")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, notification: mapNotification(data) });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create calendar notification" },
      { status: 500 }
    );
  }
}