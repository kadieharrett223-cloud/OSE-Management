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
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        lines:purchase_order_lines(*),
        payments:purchase_order_payments(*)
      `)
      .eq("id", params.id)
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error("Fetch purchase order error:", error);
    return NextResponse.json({ error: error.message || "Not found" }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session: any = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const supabase = getServerSupabaseClient();

  try {
    const { lines, ...poData } = body;

    // Convert empty date strings to null
    if (poData.expected_delivery === "") {
      poData.expected_delivery = null;
    }

    // Update PO fields
    const { data, error } = await supabase
      .from("purchase_orders")
      .update(poData)
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    // Update line items if provided
    if (lines && Array.isArray(lines)) {
      console.log("Processing lines:", lines);
      
      // Delete all existing lines for this PO (we'll re-insert with fresh line numbers)
      const { error: deleteError } = await supabase
        .from("purchase_order_lines")
        .delete()
        .eq("purchase_order_id", params.id);
      
      if (deleteError) {
        console.error("Error deleting existing lines:", deleteError);
        throw deleteError;
      }

      // Insert all lines (both new and existing) with fresh line numbers
      for (const [index, line] of lines.entries()) {
        const insertData = {
          purchase_order_id: params.id,
          line_number: index + 1,
          sku: line.sku || null,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          line_total: line.line_total,
          weight_lbs: line.weight_lbs || null,
          note: line.note || null,
        };
        console.log("Inserting line:", insertData);
        const { error: insertError } = await supabase
          .from("purchase_order_lines")
          .insert(insertData);
        
        if (insertError) {
          console.error("Error inserting line:", insertError, insertData);
          throw insertError;
        }
      }
    }

    // Fetch updated PO with lines
    const { data: updatedPO, error: fetchError } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        lines:purchase_order_lines(*),
        payments:purchase_order_payments(*)
      `)
      .eq("id", params.id)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({ ok: true, data: updatedPO });
  } catch (error: any) {
    console.error("Update purchase order error:", error);
    return NextResponse.json({ error: error.message || "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session: any = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServerSupabaseClient();

  try {
    const { error } = await supabase.from("purchase_orders").delete().eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Delete purchase order error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete" }, { status: 500 });
  }
}
