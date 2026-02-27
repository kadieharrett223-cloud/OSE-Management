import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();

    const { data: doc, error: fetchError } = await supabase
      .from("special_order_documents")
      .select("id, file_path")
      .eq("id", params.docId)
      .eq("special_order_id", params.id)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    await supabase.storage.from("special-order-documents").remove([doc.file_path]);

    const { error } = await supabase
      .from("special_order_documents")
      .delete()
      .eq("id", params.docId)
      .eq("special_order_id", params.id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete document" }, { status: 500 });
  }
}