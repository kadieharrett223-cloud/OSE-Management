import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const poId = params.id;
    const supabase = getServerSupabaseClient();

    // Get all Chinese PO files for this PO
    const { data: files, error } = await supabase
      .from("chinese_po_files")
      .select("*")
      .eq("purchase_order_id", poId)
      .order("file_uploaded_at", { ascending: false });

    if (error) throw error;

    // Generate signed URLs for each file (24 hour expiry)
    const filesWithSignedUrls = await Promise.all(
      files.map(async (file) => {
        const { data: signedUrl, error: signError } = await supabase.storage
          .from("chinese-po-files")
          .createSignedUrl(file.file_path, 24 * 60 * 60); // 24 hours

        return {
          ...file,
          signedUrl: signError ? null : signedUrl?.signedUrl,
          signError: signError?.message || null,
        };
      })
    );

    return NextResponse.json(
      {
        ok: true,
        data: filesWithSignedUrls,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error getting signed URLs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get signed URLs" },
      { status: 500 }
    );
  }
}
