import { NextResponse } from "next/server";
import { getSession, getUserId } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";
import { QboApiError } from "@/lib/qbo";
import { findQboInvoiceByNumber } from "@/lib/inventory-qbo";

export async function POST() {
  const session: any = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (await getUserId()) || undefined;

  try {
    const supabase = getServerSupabaseClient();

    const { data: rows, error: rowsError } = await supabase
      .from("inventory_order_entries")
      .select("id, product_id, customer_name, invoice_number")
      .order("created_at", { ascending: false });

    if (rowsError) throw rowsError;

    let processed = 0;
    let synced = 0;
    let unchanged = 0;
    let missingInQbo = 0;
    let conflicts = 0;

    const missingInvoices: string[] = [];
    const conflictInvoices: string[] = [];

    for (const row of rows || []) {
      processed += 1;

      const currentInvoice = String((row as any).invoice_number || "").trim();
      const currentCustomer = String((row as any).customer_name || "").trim();
      if (!currentInvoice) {
        missingInQbo += 1;
        continue;
      }

      const qboInvoice = await findQboInvoiceByNumber(currentInvoice, userId);
      if (!qboInvoice) {
        missingInQbo += 1;
        missingInvoices.push(currentInvoice);
        continue;
      }

      const canonicalInvoice = String(qboInvoice.DocNumber || currentInvoice).trim();
      const canonicalCustomer = String(qboInvoice.CustomerRef?.name || currentCustomer || "").trim() || "Unknown Customer";

      if (canonicalInvoice === currentInvoice && canonicalCustomer === currentCustomer) {
        unchanged += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from("inventory_order_entries")
        .update({
          invoice_number: canonicalInvoice,
          customer_name: canonicalCustomer,
          updated_at: new Date().toISOString(),
        })
        .eq("id", (row as any).id);

      if (updateError) {
        if ((updateError as any).code === "23505") {
          conflicts += 1;
          conflictInvoices.push(`${currentInvoice} -> ${canonicalInvoice}`);
          continue;
        }
        throw updateError;
      }

      synced += 1;
    }

    return NextResponse.json({
      data: {
        processed,
        synced,
        unchanged,
        missingInQbo,
        conflicts,
        missingInvoices: missingInvoices.slice(0, 25),
        conflictInvoices: conflictInvoices.slice(0, 25),
      },
    });
  } catch (error) {
    if (error instanceof QboApiError) {
      return NextResponse.json({ error: "QuickBooks sync failed", details: error.message }, { status: error.status });
    }

    console.error("inventory qbo sync error", error);
    return NextResponse.json({ error: "Failed to sync invoice numbers with QuickBooks" }, { status: 500 });
  }
}
