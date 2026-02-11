import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function POST() {
  const session: any = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServerSupabaseClient();

  try {
    const { error } = await supabase
      .from("purchase_orders")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Delete all POs error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete POs" }, { status: 500 });
  }
}