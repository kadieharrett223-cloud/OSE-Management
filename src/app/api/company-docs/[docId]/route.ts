import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { docId: string } }
) {
  try {
    const session: any = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();
    const docId = params.docId;

    const { data: fileRecord, error: fetchError } = await supabase
      .from("company_documents")
      .select("file_path")
      .eq("id", docId)
      .single();

    if (fetchError || !fileRecord) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (fileRecord.file_path) {
      await supabase.storage
        .from("company-documents")
        .remove([fileRecord.file_path]);
    }

    const { error: deleteError } = await supabase
      .from("company_documents")
      .delete()
      .eq("id", docId);

    if (deleteError) {
      return NextResponse.json(
        { error: `Delete failed: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: "Document deleted" });
  } catch (error: any) {
    console.error("Delete company document error:", error);
    return NextResponse.json(
      { error: error.message || "Delete failed" },
      { status: 500 }
    );
  }
}
