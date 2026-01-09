import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const supabase = getServerSupabaseClient();
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Parse file
    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim());

    // Parse CSV (assumes headers in first row)
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const row: any = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });
      return row;
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows found" }, { status: 400 });
    }

    console.log(`[PO Import] Processing ${rows.length} rows`);

    // Map CSV columns to database fields
    const poRecords = rows.map((row) => ({
      po_number: row.po_number || row["po #"] || "",
      vendor_name: row.vendor_name || row.vendor || row.supplier || "",
      order_date: row.order_date || row.date || new Date().toISOString().split("T")[0],
      total_amount: parseFloat(row.total_amount || row.total || "0") || 0,
      status: "CLOSED", // All imports are closed
      notes: row.notes || row.description || "",
    }));

    // Filter out invalid records
    const validRecords = poRecords.filter((po) => {
      if (!po.po_number) {
        console.warn("[PO Import] Skipping row with missing PO number");
        return false;
      }
      return true;
    });

    console.log(`[PO Import] ${validRecords.length} valid records to insert`);

    if (validRecords.length === 0) {
      return NextResponse.json({ error: "No valid records found" }, { status: 400 });
    }

    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;
    let duplicates = 0;

    for (let i = 0; i < validRecords.length; i += batchSize) {
      const batch = validRecords.slice(i, i + batchSize);

      const { data, error } = await supabase.from("purchase_orders").insert(batch).select();

      if (error) {
        // Check if it's a duplicate key error
        if (error.message?.includes("duplicate") || error.code === "23505") {
          console.log(`[PO Import] Batch ${i / batchSize + 1}: ${batch.length} duplicates skipped`);
          duplicates += batch.length;
        } else {
          console.error(`[PO Import] Batch error:`, error);
          return NextResponse.json(
            { error: `Failed to insert batch: ${error.message}` },
            { status: 500 }
          );
        }
      } else {
        inserted += data?.length || 0;
        console.log(`[PO Import] Batch ${i / batchSize + 1}: ${data?.length || 0} inserted`);
      }
    }

    return NextResponse.json({
      ok: true,
      imported: inserted,
      duplicates,
      total: validRecords.length,
      message: `Successfully imported ${inserted} POs (${duplicates} duplicates skipped)`,
    });
  } catch (error: any) {
    console.error("[PO Import] Error:", error);
    return NextResponse.json(
      { error: error.message || "Import failed" },
      { status: 500 }
    );
  }
}
