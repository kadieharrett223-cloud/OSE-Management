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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
      .update({
        title,
        event_date: date,
        recurring,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("is_active", true)
      .select("id, title, event_date, recurring, notes")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, notification: mapNotification(data) });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update calendar notification" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();
    const { error } = await supabase
      .from("calendar_mobile_notifications")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete calendar notification" },
      { status: 500 }
    );
  }
}