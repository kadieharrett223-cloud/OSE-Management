import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

type ChangeEntry = {
  field: string;
  oldValue: string;
  newValue: string;
};

const stringifyValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "—";
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const valuesDifferent = (oldValue: unknown, newValue: unknown): boolean => {
  return stringifyValue(oldValue) !== stringifyValue(newValue);
};

const normalizeLine = (line: any) => ({
  lineNumber: Number(line?.line_number ?? 0),
  sku: stringifyValue(line?.sku),
  description: stringifyValue(line?.description),
  quantity: Number(line?.quantity ?? 0),
  unitPrice: Number(line?.unit_price ?? 0),
  lineTotal: Number(line?.line_total ?? 0),
  weightLbs: line?.weight_lbs === null || line?.weight_lbs === undefined ? null : Number(line.weight_lbs),
});

const buildLineItemChanges = (oldLinesRaw: any[], newLinesRaw: any[]): ChangeEntry[] => {
  const oldLines = [...(oldLinesRaw || [])]
    .map(normalizeLine)
    .sort((a, b) => a.lineNumber - b.lineNumber);
  const newLines = [...(newLinesRaw || [])]
    .map(normalizeLine)
    .sort((a, b) => a.lineNumber - b.lineNumber);

  const changes: ChangeEntry[] = [];

  if (oldLines.length !== newLines.length) {
    changes.push({
      field: "Line Items Count",
      oldValue: `${oldLines.length} item(s)`,
      newValue: `${newLines.length} item(s)`,
    });
  }

  const maxLength = Math.max(oldLines.length, newLines.length);
  for (let index = 0; index < maxLength; index++) {
    const oldLine = oldLines[index];
    const newLine = newLines[index];
    const lineLabel = `Line ${index + 1}`;

    if (!oldLine && newLine) {
      changes.push({
        field: `${lineLabel} Added`,
        oldValue: "—",
        newValue: `${newLine.sku} | ${newLine.description} | Qty ${newLine.quantity} | $${newLine.unitPrice}`,
      });
      continue;
    }

    if (oldLine && !newLine) {
      changes.push({
        field: `${lineLabel} Removed`,
        oldValue: `${oldLine.sku} | ${oldLine.description} | Qty ${oldLine.quantity} | $${oldLine.unitPrice}`,
        newValue: "—",
      });
      continue;
    }

    if (!oldLine || !newLine) continue;

    if (oldLine.sku !== newLine.sku) {
      changes.push({
        field: `${lineLabel} SKU`,
        oldValue: oldLine.sku,
        newValue: newLine.sku,
      });
    }

    if (oldLine.description !== newLine.description) {
      changes.push({
        field: `${lineLabel} Description`,
        oldValue: oldLine.description,
        newValue: newLine.description,
      });
    }

    if (oldLine.quantity !== newLine.quantity) {
      changes.push({
        field: `${lineLabel} Quantity`,
        oldValue: String(oldLine.quantity),
        newValue: String(newLine.quantity),
      });
    }

    if (oldLine.unitPrice !== newLine.unitPrice) {
      changes.push({
        field: `${lineLabel} Unit Price`,
        oldValue: String(oldLine.unitPrice),
        newValue: String(newLine.unitPrice),
      });
    }

    if (oldLine.lineTotal !== newLine.lineTotal) {
      changes.push({
        field: `${lineLabel} Line Total`,
        oldValue: String(oldLine.lineTotal),
        newValue: String(newLine.lineTotal),
      });
    }

    if (oldLine.weightLbs !== newLine.weightLbs) {
      changes.push({
        field: `${lineLabel} Weight (lbs)`,
        oldValue: oldLine.weightLbs === null ? "—" : String(oldLine.weightLbs),
        newValue: newLine.weightLbs === null ? "—" : String(newLine.weightLbs),
      });
    }
  }

  return changes;
};

const buildChangeEntries = (oldPO: any, newPO: any): ChangeEntry[] => {
  const trackedFields: Array<{ key: string; label: string }> = [
    { key: "po_number", label: "PO Number" },
    { key: "vendor_name", label: "Vendor Name" },
    { key: "vendor_contact_name", label: "Vendor Contact" },
    { key: "vendor_email", label: "Vendor Email" },
    { key: "vendor_phone", label: "Vendor Phone" },
    { key: "terms", label: "Terms" },
    { key: "status", label: "Status" },
    { key: "expected_delivery", label: "Expected Delivery" },
    { key: "total_amount", label: "Total Amount" },
    { key: "notes", label: "Notes" },
  ];

  const changes: ChangeEntry[] = [];

  for (const field of trackedFields) {
    const before = oldPO?.[field.key];
    const after = newPO?.[field.key];
    if (valuesDifferent(before, after)) {
      changes.push({
        field: field.label,
        oldValue: stringifyValue(before),
        newValue: stringifyValue(after),
      });
    }
  }

  const oldLines = oldPO?.lines || [];
  const newLines = newPO?.lines || [];
  changes.push(...buildLineItemChanges(oldLines, newLines));

  return changes;
};

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

    const { data: existingPO, error: existingError } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        lines:purchase_order_lines(*)
      `)
      .eq("id", params.id)
      .single();

    if (existingError) throw existingError;

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

    const changes = buildChangeEntries(existingPO, updatedPO);
    if (changes.length > 0) {
      const changedBy = session?.user?.email || session?.user?.name || "Unknown";
      const { error: logError } = await supabase
        .from("purchase_order_change_logs")
        .insert({
          purchase_order_id: params.id,
          po_number: updatedPO.po_number || existingPO?.po_number || "",
          changed_by: changedBy,
          event_type: "UPDATED",
          changes,
        });

      if (logError) {
        console.error("Failed to write PO change log:", logError);
      }
    }

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
