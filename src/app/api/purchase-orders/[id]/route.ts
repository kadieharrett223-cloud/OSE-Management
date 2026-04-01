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

const normalizeCurrency = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const deriveTotalFromLines = (po: any): number => {
  const lines = Array.isArray(po?.lines) ? po.lines : [];
  if (lines.length === 0) return normalizeCurrency(po?.total_amount);

  return lines.reduce((sum: number, line: any) => {
    const quantity = normalizeCurrency(line?.quantity);
    const unitPrice = normalizeCurrency(line?.unit_price);
    const fallbackLineTotal = quantity * unitPrice;
    const lineTotal = normalizeCurrency(line?.line_total);
    return sum + (lineTotal || fallbackLineTotal);
  }, 0);
};

const derivePaymentStatus = (po: any): string => {
  const paidAmount = (Array.isArray(po?.payments) ? po.payments : []).reduce(
    (sum: number, payment: any) => sum + normalizeCurrency(payment?.amount),
    0
  );
  return paidAmount > 0 ? "PAID" : "TO_BE_PAID";
};

const enrichPurchaseOrderWithFobCosts = async (supabase: any, po: any) => {
  const lines = Array.isArray(po?.lines) ? po.lines : [];
  const skus = Array.from(new Set(lines.map((line: any) => String(line?.sku || "").trim()).filter(Boolean)));

  if (skus.length === 0) {
    return {
      ...po,
      total_amount: deriveTotalFromLines(po),
    };
  }

  const { data: priceItems, error } = await supabase
    .from("price_list_items")
    .select("item_no, fob_cost")
    .in("item_no", skus)
    .eq("is_active", true);

  if (error) {
    console.warn("Unable to enrich purchase order with FOB costs:", error.message);
    return {
      ...po,
      total_amount: deriveTotalFromLines(po),
    };
  }

  const fobBySku = new Map<string, number>();
  for (const item of priceItems || []) {
    const sku = String(item.item_no || "").trim().toLowerCase();
    const fob = Number(item.fob_cost);
    if (sku && Number.isFinite(fob) && fob > 0) {
      fobBySku.set(sku, fob);
    }
  }

  const enrichedLines = lines.map((line: any) => {
    const skuKey = String(line?.sku || "").trim().toLowerCase();
    const fobCost = fobBySku.get(skuKey);
    if (!fobCost) return line;

    const quantity = normalizeCurrency(line?.quantity);
    return {
      ...line,
      unit_price: fobCost,
      line_total: quantity * fobCost,
    };
  });

  return {
    ...po,
    lines: enrichedLines,
    status: derivePaymentStatus({ ...po, lines: enrichedLines }),
    total_amount: deriveTotalFromLines({ ...po, lines: enrichedLines }),
  };
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
        field: `${lineLabel} FOB Cost`,
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

const buildChangeEntries = (oldPO: any, newPO: any, incomingLines?: any[]): ChangeEntry[] => {
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
  const newLines = Array.isArray(incomingLines) ? incomingLines : (newPO?.lines || []);
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
      .order("line_number", { foreignTable: "purchase_order_lines", ascending: true })
      .single();

    if (error) throw error;
    const normalizedData = await enrichPurchaseOrderWithFobCosts(supabase, data);

    return NextResponse.json({ ok: true, data: normalizedData });
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

    // Always derive PO total from line items when lines are provided.
    // This prevents stale/incorrect totals in the list view and balance calculations.
    if (Array.isArray(lines)) {
      poData.total_amount = lines.reduce((sum: number, line: any) => {
        const quantity = normalizeCurrency(line?.quantity);
        const unitPrice = normalizeCurrency(line?.unit_price);
        const fallbackLineTotal = quantity * unitPrice;
        const lineTotal = normalizeCurrency(line?.line_total);
        return sum + (lineTotal || fallbackLineTotal);
      }, 0);
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
        const quantity = normalizeCurrency(line?.quantity);
        const unitPrice = normalizeCurrency(line?.unit_price);
        const fallbackLineTotal = quantity * unitPrice;
        const lineTotal = normalizeCurrency(line?.line_total) || fallbackLineTotal;

        const insertData = {
          purchase_order_id: params.id,
          line_number: index + 1,
          sku: line.sku || null,
          description: line.description,
          quantity,
          unit_price: unitPrice,
          line_total: lineTotal,
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
      .order("line_number", { foreignTable: "purchase_order_lines", ascending: true })
      .single();

    if (fetchError) throw fetchError;

    const changes = buildChangeEntries(existingPO, updatedPO, Array.isArray(lines) ? lines : undefined);
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

    const normalizedPO = await enrichPurchaseOrderWithFobCosts(supabase, updatedPO);

    return NextResponse.json({ ok: true, data: normalizedPO });
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
