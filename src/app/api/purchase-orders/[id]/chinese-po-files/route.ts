import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session: any = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const poId = params.id;
    const uploadNotes = formData.get("uploadNotes") as string;

    if (!file || !poId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseClient();
    // Sanitize filename: handle filename and extension separately
    const lastDotIndex = file.name.lastIndexOf('.');
    const baseName = lastDotIndex > 0 ? file.name.substring(0, lastDotIndex) : file.name;
    const extension = lastDotIndex > 0 ? file.name.substring(lastDotIndex) : '';
    
    const sanitizedBaseName = baseName
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .trim()                 // Remove leading/trailing spaces
      .replace(/\s/g, '-');   // Replace remaining spaces with dashes
    
    const sanitizedFileName = sanitizedBaseName + extension;
    const fileName = `${poId}/${Date.now()}-${sanitizedFileName}`;
    const buffer = await file.arrayBuffer();

    // Upload file to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("chinese-po-files")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Create file record in database
    const { data: fileData, error: dbError } = await supabase
      .from("chinese_po_files")
      .insert({
        purchase_order_id: poId,
        file_name: file.name,
        file_size: file.size,
        file_mime_type: file.type,
        file_path: fileName,
        file_uploaded_at: new Date().toISOString(),
        upload_notes: uploadNotes || null,
        created_by_user_id: session.user.id,
      })
      .select("*")
      .single();

    if (dbError) {
      // Clean up the uploaded file on DB error
      await supabase.storage.from("chinese-po-files").remove([fileName]);
      return NextResponse.json(
        { error: `Failed to create file record: ${dbError.message}` },
        { status: 500 }
      );
    }

    // Auto-flag the PO as a China supplier
    await supabase
      .from("purchase_orders")
      .update({ is_china_supplier: true, country: "China" })
      .eq("id", poId);

    // Auto-generate PDF for the PO if not already generated
    try {
      const { data: existingPO } = await supabase
        .from("purchase_orders")
        .select("generated_pdf_path")
        .eq("id", poId)
        .single();

      if (!existingPO?.generated_pdf_path) {
        const generatePdfRes = await fetch(
          `${req.nextUrl.origin}/api/purchase-orders/${poId}/generate-pdf`,
          { method: "POST" }
        );
        if (!generatePdfRes.ok) {
          console.error("Failed to auto-generate PDF");
        }
      }
    } catch (pdfError) {
      console.error("PDF generation error:", pdfError);
    }

    return NextResponse.json(
      {
        ok: true,
        data: fileData,
        message: "PO file uploaded successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Upload PO file error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const poId = params.id;
    const supabase = getServerSupabaseClient();

    const { data, error } = await supabase
      .from("chinese_po_files")
      .select("*")
      .eq("purchase_order_id", poId)
      .order("file_uploaded_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error("Fetch PO files error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch" },
      { status: 500 }
    );
  }
}
