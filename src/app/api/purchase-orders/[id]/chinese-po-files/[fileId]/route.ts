import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  try {
    const session: any = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServerSupabaseClient();
    const fileId = params.fileId;
    const poId = params.id;

    // Get file to find file path
    const { data: fileRecord, error: fetchError } = await supabase
      .from("chinese_po_files")
      .select("file_path")
      .eq("id", fileId)
      .single();

    if (fetchError || !fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete from storage
    if (fileRecord.file_path) {
      await supabase.storage
        .from("chinese-po-files")
        .remove([fileRecord.file_path]);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("chinese_po_files")
      .delete()
      .eq("id", fileId);

    if (deleteError) {
      return NextResponse.json(
        { error: `Delete failed: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: "File deleted" });
  } catch (error: any) {
    console.error("Delete PO file error:", error);
    return NextResponse.json(
      { error: error.message || "Delete failed" },
      { status: 500 }
    );
  }
}
