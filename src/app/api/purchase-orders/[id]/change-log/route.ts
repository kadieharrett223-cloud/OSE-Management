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
    console.log(`[PO Change Log] Fetching logs for PO ID: ${params.id}`);
    
    const { data, error } = await supabase
      .from("purchase_order_change_logs")
      .select("id, created_at, changed_by, event_type, changes, notes")
      .eq("purchase_order_id", params.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(`[PO Change Log] Database error: ${error.message}`, error);
      // Return empty array if table doesn't exist yet (expected before migration is applied)
      if (error.message.includes("relation") || error.message.includes("does not exist")) {
        console.log("[PO Change Log] Table not found - migration may not be applied yet");
        return NextResponse.json({ ok: true, data: [] });
      }
      throw error;
    }

    console.log(`[PO Change Log] Found ${data?.length || 0} entries`);
    return NextResponse.json({ ok: true, data: data || [] });
  } catch (error: any) {
    console.error("Fetch PO change log error:", error);
    return NextResponse.json({ ok: true, data: [] }, { status: 200 });
  }
}
