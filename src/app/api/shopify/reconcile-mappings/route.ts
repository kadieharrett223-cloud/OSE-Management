import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** GET /api/shopify/reconcile-mappings — fetch all saved manual mappings */
export async function GET() {
  const { data, error } = await supabase
    .from("shopify_qbo_mappings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[reconcile-mappings] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mappings: data || [] });
}

/** POST /api/shopify/reconcile-mappings — upsert a manual mapping */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      shopify_order_id,
      shopify_order_number,
      qbo_invoice_id,
      qbo_doc_number,
      qbo_customer_name,
      note,
      is_cancelled,
    } = body;

    if (!shopify_order_id) {
      return NextResponse.json(
        { error: "shopify_order_id is required" },
        { status: 400 }
      );
    }

    if (!is_cancelled && !qbo_invoice_id) {
      return NextResponse.json(
        { error: "qbo_invoice_id is required unless marking as cancelled" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("shopify_qbo_mappings")
      .upsert(
        {
          shopify_order_id: String(shopify_order_id),
          shopify_order_number: String(shopify_order_number || ""),
          qbo_invoice_id: qbo_invoice_id ? String(qbo_invoice_id) : null,
          qbo_doc_number: qbo_doc_number || null,
          qbo_customer_name: qbo_customer_name || null,
          note: note || null,
          is_cancelled: Boolean(is_cancelled),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "shopify_order_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("[reconcile-mappings] POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, mapping: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save mapping" }, { status: 500 });
  }
}

/** DELETE /api/shopify/reconcile-mappings?shopify_order_id=xxx — remove a mapping */
export async function DELETE(req: NextRequest) {
  const shopify_order_id = req.nextUrl.searchParams.get("shopify_order_id");
  if (!shopify_order_id) {
    return NextResponse.json({ error: "shopify_order_id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("shopify_qbo_mappings")
    .delete()
    .eq("shopify_order_id", shopify_order_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
