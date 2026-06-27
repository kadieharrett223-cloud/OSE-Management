import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function DELETE(_req: NextRequest, { params }: { params: { itemId: string } }) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServerSupabaseClient();

    const { error } = await supabase
      .from("inventory_container_items")
      .delete()
      .eq("id", params.itemId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("inventory container item delete error", error);
    return NextResponse.json({ error: "Failed to delete container item" }, { status: 500 });
  }
}
