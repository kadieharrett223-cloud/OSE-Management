import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

const VALID_STATUSES = new Set(["in_transit", "arrived", "unloading", "complete", "delayed"]);

function normalizeStatus(value: unknown) {
  const status = String(value || "").trim().toLowerCase();
  return VALID_STATUSES.has(status) ? status : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const containerCode = String(body?.containerCode || "").trim();
  const status = normalizeStatus(body?.status);

  if (!containerCode && !status) {
    return NextResponse.json({ error: "Provide containerCode and/or valid status" }, { status: 400 });
  }

  try {
    const supabase = getServerSupabaseClient();

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (containerCode) updatePayload.container_code = containerCode;
    if (status) updatePayload.status = status;

    const { data: updated, error: updateError } = await supabase
      .from("inventory_containers")
      .update(updatePayload)
      .eq("id", params.id)
      .select("id, container_code, status, created_at, updated_at")
      .maybeSingle();

    if (updateError) {
      if ((updateError as any).code === "23505") {
        return NextResponse.json({ error: "Container code already exists" }, { status: 409 });
      }
      throw updateError;
    }

    if (!updated) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: (updated as any).id,
        containerCode: (updated as any).container_code,
        status: (updated as any).status,
        createdAt: (updated as any).created_at,
        updatedAt: (updated as any).updated_at,
      },
    });
  } catch (error) {
    console.error("inventory container update error", error);
    return NextResponse.json({ error: "Failed to update container" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServerSupabaseClient();

    const { error } = await supabase.from("inventory_containers").delete().eq("id", params.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("inventory container delete error", error);
    return NextResponse.json({ error: "Failed to delete container" }, { status: 500 });
  }
}
