export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { syncPricesToShopify } from "@/lib/shopify";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    // Require admin to sync prices
    const session: any = await getSession();
    const role = (session?.user?.role ?? "").toString().toLowerCase();
    
    if (role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    // Create sync log entry
    const { data: syncLog, error: logError } = await supabase
      .from("shopify_sync_logs")
      .insert({
        started_at: new Date().toISOString(),
        status: "running",
      })
      .select()
      .single();

    if (logError || !syncLog) {
      console.error("Failed to create sync log:", logError);
    }

    // Perform sync
    const result = await syncPricesToShopify();

    // Update sync log
    if (syncLog) {
      await supabase
        .from("shopify_sync_logs")
        .update({
          completed_at: new Date().toISOString(),
          success_count: result.success,
          failed_count: result.failed,
          skipped_count: result.skipped,
          errors: result.errors,
          status: result.failed > 0 ? "failed" : "completed",
        })
        .eq("id", syncLog.id);
    }

    console.log("Shopify sync completed:", result);

    return NextResponse.json({
      ok: true,
      message: "Price sync completed",
      ...result,
    });
  } catch (error: any) {
    console.error("Shopify sync error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync prices" },
      { status: 500 }
    );
  }
}
