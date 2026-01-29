export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export async function GET() {
  try {
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();

    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from("shopify_settings")
      .select("id, allowed_collection_ids")
      .eq("id", SETTINGS_ID)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      settings: data || { id: SETTINGS_ID, allowed_collection_ids: [] },
    });
  } catch (error: any) {
    console.error("Get Shopify settings error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();

    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const body = await req.json();
    const allowedCollectionIds: string[] = Array.isArray(body?.allowed_collection_ids)
      ? body.allowed_collection_ids
      : [];

    const supabase = getServerSupabaseClient();
    const { error } = await supabase
      .from("shopify_settings")
      .upsert({
        id: SETTINGS_ID,
        allowed_collection_ids: allowedCollectionIds,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Update Shopify settings error:", error);
    return NextResponse.json({ error: error.message || "Failed to update settings" }, { status: 500 });
  }
}
