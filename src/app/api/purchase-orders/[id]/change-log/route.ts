import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session: any = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServerSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("purchase_order_change_logs")
      .select("id, created_at, changed_by, event_type, changes, notes")
      .eq("purchase_order_id", params.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (error: any) {
    console.error("Fetch PO change log error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch change log" }, { status: 500 });
  }
}
