import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function DELETE(_req: NextRequest, { params }: { params: { orderId: string } }) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServerSupabaseClient();

    const { data: existing, error: existingError } = await supabase
      .from("inventory_order_entries")
      .select("id")
      .eq("id", params.orderId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
      return NextResponse.json({ error: "Order entry not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("inventory_order_entries")
      .delete()
      .eq("id", params.orderId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("inventory order delete error", error);
    return NextResponse.json({ error: "Failed to delete order entry" }, { status: 500 });
  }
}
