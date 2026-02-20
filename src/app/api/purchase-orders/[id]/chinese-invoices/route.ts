import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
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
    const poId = formData.get("poId") as string;
    const invoiceNumber = formData.get("invoiceNumber") as string;
    const invoiceDate = formData.get("invoiceDate") as string;
    const factoryName = formData.get("factoryName") as string;
    const totalAmount = formData.get("totalAmount") as string;

    if (!file || !poId || !invoiceNumber) {
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
    const fileName = `${poId}/${invoiceNumber}/${Date.now()}-${sanitizedFileName}`;
    const buffer = await file.arrayBuffer();

    // Upload file to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("chinese-invoices")
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

    // Create invoice record in database
    const { data: invoiceData, error: dbError } = await supabase
      .from("chinese_invoices")
      .insert({
        purchase_order_id: poId,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate || new Date().toISOString().split("T")[0],
        factory_name: factoryName,
        total_amount: totalAmount ? parseFloat(totalAmount) : null,
        invoice_file_path: fileName,
        file_name: file.name,
        file_size: file.size,
        file_mime_type: file.type,
        file_uploaded_at: new Date().toISOString(),
        created_by_user_id: session.user.id,
        payment_status: "RECEIVED",
      })
      .select("*")
      .single();

    if (dbError) {
      // Try to clean up the uploaded file
      await supabase.storage.from("chinese-invoices").remove([fileName]);
      return NextResponse.json(
        { error: `Failed to create invoice record: ${dbError.message}` },
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
        data: invoiceData,
        message: "Invoice uploaded successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Upload invoice error:", error);
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
      .from("chinese_invoices")
      .select("*")
      .eq("purchase_order_id", poId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    console.error("Fetch invoices error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch" },
      { status: 500 }
    );
  }
}
