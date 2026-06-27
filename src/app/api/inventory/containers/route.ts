import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

const VALID_STATUSES = new Set(["in_transit", "arrived", "unloading", "complete", "delayed"]);

function normalizeStatus(value: unknown) {
  const status = String(value || "").trim().toLowerCase();
  return VALID_STATUSES.has(status) ? status : null;
}

export async function GET() {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServerSupabaseClient();

    const { data: containers, error: containersError } = await supabase
      .from("inventory_containers")
      .select("id, container_code, status, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (containersError) throw containersError;

    const { data: items, error: itemsError } = await supabase
      .from("inventory_container_items")
      .select("id, container_id, product_id, quantity");

    if (itemsError) throw itemsError;

    const { data: products, error: productsError } = await supabase
      .from("inventory_products")
      .select("id, name");

    if (productsError) throw productsError;

    const productNameById = new Map<string, string>((products || []).map((p: any) => [String(p.id), String(p.name)]));

    const itemsByContainer = new Map<string, any[]>();
    for (const item of items || []) {
      const containerId = String((item as any).container_id || "");
      if (!containerId) continue;
      const existing = itemsByContainer.get(containerId) || [];
      existing.push({
        id: (item as any).id,
        productId: (item as any).product_id,
        productName: productNameById.get(String((item as any).product_id || "")) || "Unknown Product",
        quantity: Number((item as any).quantity) || 0,
      });
      itemsByContainer.set(containerId, existing);
    }

    return NextResponse.json({
      data: (containers || []).map((container: any) => ({
        id: container.id,
        containerCode: container.container_code,
        status: container.status,
        createdAt: container.created_at,
        updatedAt: container.updated_at,
        items: itemsByContainer.get(String(container.id)) || [],
      })),
    });
  } catch (error) {
    console.error("inventory containers list error", error);
    return NextResponse.json({ error: "Failed to load containers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const containerCode = String(body?.containerCode || "").trim();
  const status = normalizeStatus(body?.status) || "in_transit";

  if (!containerCode) {
    return NextResponse.json({ error: "Container code is required" }, { status: 400 });
  }

  try {
    const supabase = getServerSupabaseClient();

    const { data: created, error: createError } = await supabase
      .from("inventory_containers")
      .insert({
        container_code: containerCode,
        status,
      })
      .select("id, container_code, status, created_at, updated_at")
      .single();

    if (createError) {
      if ((createError as any).code === "23505") {
        return NextResponse.json({ error: "Container code already exists" }, { status: 409 });
      }
      throw createError;
    }

    return NextResponse.json(
      {
        data: {
          id: (created as any).id,
          containerCode: (created as any).container_code,
          status: (created as any).status,
          createdAt: (created as any).created_at,
          updatedAt: (created as any).updated_at,
          items: [],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("inventory container create error", error);
    return NextResponse.json({ error: "Failed to create container" }, { status: 500 });
  }
}
