import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();

    if (session.user.id === "shared-access") {
      const { error } = await supabase
        .from("qbo_tokens")
        .delete()
        .eq("id", "primary");
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("qbo_tokens")
        .delete()
        .eq("user_id", session.user.id);
      if (error) throw error;
    }

    return NextResponse.json({
      ok: true,
      message: "QuickBooks disconnected successfully",
    });
  } catch (error: any) {
    console.error("QBO disconnect error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to disconnect" },
      { status: 500 }
    );
  }
}
