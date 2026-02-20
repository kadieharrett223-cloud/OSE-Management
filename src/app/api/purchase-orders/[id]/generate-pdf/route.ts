import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";
import { jsPDF } from "jspdf";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const poId = params.id;
    const supabase = getServerSupabaseClient();

    // Fetch PO data with lines
    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .select("*, lines:purchase_order_lines(*)")
      .eq("id", poId)
      .single();

    if (poError || !po) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    // Generate PDF
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text("PURCHASE ORDER", 105, 20, { align: "center" });
    
    // Add PO details
    doc.setFontSize(12);
    doc.text(`PO Number: ${po.po_number}`, 20, 40);
    doc.text(`Vendor: ${po.vendor_name}`, 20, 50);
    doc.text(`Order Date: ${new Date(po.order_date).toLocaleDateString()}`, 20, 60);
    doc.text(`Status: ${po.status}`, 20, 70);
    
    if (po.expected_delivery) {
      doc.text(`Expected Delivery: ${new Date(po.expected_delivery).toLocaleDateString()}`, 20, 80);
    }

    // Add line items table
    if (po.lines && po.lines.length > 0) {
      let yPos = 100;
      
      // Table header
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("SKU", 20, yPos);
      doc.text("Description", 50, yPos);
      doc.text("Qty", 130, yPos);
      doc.text("Unit Price", 150, yPos);
      doc.text("Total", 180, yPos);
      
      yPos += 5;
      doc.line(20, yPos, 200, yPos); // Horizontal line
      yPos += 10;
      
      // Table rows
      doc.setFont("helvetica", "normal");
      for (const line of po.lines) {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.text(line.sku || "—", 20, yPos);
        doc.text(
          line.description.length > 30 
            ? line.description.substring(0, 27) + "..." 
            : line.description, 
          50, 
          yPos
        );
        doc.text(String(line.quantity), 130, yPos);
        doc.text(`$${line.unit_price.toFixed(2)}`, 150, yPos);
        doc.text(`$${line.line_total.toFixed(2)}`, 180, yPos);
        
        yPos += 8;
      }
      
      yPos += 10;
      doc.line(20, yPos, 200, yPos);
      yPos += 10;
      
      // Total
      doc.setFont("helvetica", "bold");
      doc.text(`Total Amount: $${po.total_amount.toFixed(2)}`, 150, yPos);
    }

    // Convert PDF to buffer
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const fileName = `po-${po.po_number}-${Date.now()}.pdf`;
    const filePath = `${poId}/${fileName}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("generated-po-pdfs")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Failed to upload PDF: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Update purchase order with PDF path
    const { error: updateError } = await supabase
      .from("purchase_orders")
      .update({ generated_pdf_path: filePath })
      .eq("id", poId);

    if (updateError) {
      console.error("Failed to update PO with PDF path:", updateError);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("generated-po-pdfs")
      .getPublicUrl(filePath);

    return NextResponse.json({
      ok: true,
      message: "PDF generated successfully",
      data: {
        path: filePath,
        url: urlData.publicUrl,
      },
    });
  } catch (error: any) {
    console.error("Generate PDF error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
