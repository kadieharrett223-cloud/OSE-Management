import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; invoiceId: string } }
) {
  try {
    const session: any = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();
    const invoiceId = params.invoiceId;
    const poId = params.id;

    // Get invoice to find file path
    const { data: invoice, error: fetchError } = await supabase
      .from("chinese_invoices")
      .select("invoice_file_path")
      .eq("id", invoiceId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Delete from storage
    if (invoice.invoice_file_path) {
      await supabase.storage
        .from("chinese-invoices")
        .remove([invoice.invoice_file_path]);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("chinese_invoices")
      .delete()
      .eq("id", invoiceId);

    if (deleteError) {
      return NextResponse.json(
        { error: `Delete failed: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: "Invoice deleted" });
  } catch (error: any) {
    console.error("Delete invoice error:", error);
    return NextResponse.json(
      { error: error.message || "Delete failed" },
      { status: 500 }
    );
  }
}
