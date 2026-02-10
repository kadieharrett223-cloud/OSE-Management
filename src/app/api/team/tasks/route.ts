import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const poId = searchParams.get("poId");
    const vendorId = searchParams.get("vendorId");

    let query = supabase
      .from("team_tasks")
      .select("*")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (poId) {
      query = query.eq("po_id", poId);
    }

    if (vendorId) {
      query = query.eq("vendor_id", vendorId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[team-tasks] Query error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, tasks: data || [] });
  } catch (error) {
    console.error("[team-tasks] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, priority, assigned_to, po_id, vendor_id, created_by } = body;

    if (!title || !created_by) {
      return NextResponse.json(
        { ok: false, error: "Title and created_by are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("team_tasks")
      .insert([
        {
          title,
          description,
          priority: priority || "medium",
          assigned_to,
          po_id,
          vendor_id,
          created_by,
          status: "open",
        },
      ])
      .select();

    if (error) {
      console.error("[team-tasks] Insert error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, task: data?.[0] }, { status: 201 });
  } catch (error) {
    console.error("[team-tasks] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
