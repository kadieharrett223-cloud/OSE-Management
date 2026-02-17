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
      
      // Get existing line IDs
      const { data: existingLines } = await supabase
        .from("purchase_order_lines")
        .select("id")
        .eq("purchase_order_id", params.id);

      const existingIds = new Set(existingLines?.map(l => l.id) || []);
      const newIds = new Set(lines.filter(l => !l.id.startsWith("new_")).map(l => l.id));

      // Delete line items that are no longer present
      const toDelete = Array.from(existingIds).filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        console.log("Deleting lines:", toDelete);
        const { error: deleteError } = await supabase
          .from("purchase_order_lines")
          .delete()
          .in("id", toDelete);
        if (deleteError) {
          console.error("Error deleting lines:", deleteError);
          throw deleteError;
        }
      }

      // Upsert line items
      for (const [index, line] of lines.entries()) {
        if (line.id.startsWith("new_")) {
          // Insert new line
          const insertData = {
            purchase_order_id: params.id,
            line_number: index + 1,
            sku: line.sku || null,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            line_total: line.line_total,
            weight_lbs: line.weight_lbs || null,
          };
          console.log("Inserting new line:", insertData);
          const { error: insertError } = await supabase
            .from("purchase_order_lines")
            .insert(insertData);
          if (insertError) {
            console.error("Error inserting new line:", insertError);
            throw insertError;
          }
        } else {
          // Update existing line
          const updateData = {
            line_number: index + 1,
            sku: line.sku || null,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            line_total: line.line_total,
            weight_lbs: line.weight_lbs || null,
          };
          console.log("Updating line:", line.id, updateData);
          const { error: updateError } = await supabase
            .from("purchase_order_lines")
            .update(updateData)
            .eq("id", line.id);
          if (updateError) {
            console.error("Error updating line:", updateError, "Line ID:", line.id);
            throw updateError;
          }
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
