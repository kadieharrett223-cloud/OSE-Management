import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

// Generate PDF using jsPDF with proper formatting to match print layout
async function generatePDFFromPO(po: any): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 0.5;
  const fontScale = 1.12;
  const fs = (value: number) => value * fontScale;

  // Helper functions
  const addLine = () => {
    doc.setDrawColor(200);
    doc.line(0.5, yPos, pageWidth - 0.5, yPos);
    yPos += 0.08;
  };

  // Title
  doc.setFontSize(fs(20));
  doc.setFont("helvetica", "bold");
  doc.text("OLYMPIC®", 0.7, yPos);
  yPos += 0.25;

  // Company info
  doc.setFontSize(fs(9));
  doc.setFont("helvetica", "normal");
  doc.text("Olympic Shop Equipment", 0.7, yPos);
  yPos += 0.12;
  doc.text("18935 59th Ave NE, Arlington WA. 98223", 0.7, yPos);
  yPos += 0.12;
  doc.text("Phone: 360-651-2540", 0.7, yPos);
  yPos += 0.2;

  // PO Header (left) and PO Title (right)
  doc.setFontSize(fs(18));
  doc.setFont("helvetica", "bold");
  doc.text("PURCHASE ORDER", pageWidth - 1.2, 0.7, { align: "right" });

  // PO Number and Date table (top right)
  const poHeaderY = 0.9;
  const poHeaderX = pageWidth - 2.5;
  doc.setDrawColor(100);
  doc.rect(poHeaderX, poHeaderY, 2, 0.35);
  doc.setFontSize(fs(8));
  doc.setFont("helvetica", "bold");
  doc.text("PO Number", poHeaderX + 0.05, poHeaderY + 0.12);
  doc.text("PO DATE", poHeaderX + 1.05, poHeaderY + 0.12);
  doc.line(poHeaderX + 1, poHeaderY, poHeaderX + 1, poHeaderY + 0.35);
  doc.line(poHeaderX, poHeaderY + 0.17, poHeaderX + 2, poHeaderY + 0.17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(fs(9));
  doc.text(po.po_number || "", poHeaderX + 0.05, poHeaderY + 0.28);
  doc.text(new Date(po.order_date).toLocaleDateString(), poHeaderX + 1.05, poHeaderY + 0.28);

  // Reset yPos for body
  yPos = 1.35;

  addLine();

  // Vendor and Ship To section
  const vendorX = 0.5;
  const shipX = pageWidth / 2 + 0.1;
  const infoBoxWidth = pageWidth / 2 - 0.4;

  // Vendor box
  doc.setDrawColor(100);
  doc.rect(vendorX, yPos, infoBoxWidth, 1);
  doc.setFillColor(240, 240, 240);
  doc.rect(vendorX, yPos, infoBoxWidth, 0.15, "F");
  doc.setFontSize(fs(8));
  doc.setFont("helvetica", "bold");
  doc.text("VENDOR", vendorX + 0.05, yPos + 0.11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(fs(7));
  let vendorY = yPos + 0.22;
  doc.text("Name:", vendorX + 0.05, vendorY);
  doc.setFont("helvetica", "bold");
  doc.text(po.vendor_name, vendorX + 0.4, vendorY);

  vendorY += 0.12;
  doc.setFont("helvetica", "normal");
  doc.text("Address:", vendorX + 0.05, vendorY);
  doc.text(po.vendor_address || "—", vendorX + 0.4, vendorY);

  vendorY += 0.12;
  doc.text("City/State/ZIP:", vendorX + 0.05, vendorY);
  doc.text(po.vendor_city_state_zip || "—", vendorX + 0.4, vendorY);

  vendorY += 0.12;
  doc.text("Phone:", vendorX + 0.05, vendorY);
  doc.text(po.vendor_phone || "—", vendorX + 0.4, vendorY);

  vendorY += 0.12;
  doc.text("Email:", vendorX + 0.05, vendorY);
  doc.text(po.vendor_email || "—", vendorX + 0.4, vendorY);

  // Ship To box
  doc.rect(shipX, yPos, infoBoxWidth, 1);
  doc.setFillColor(240, 240, 240);
  doc.rect(shipX, yPos, infoBoxWidth, 0.15, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fs(8));
  doc.text("SHIP TO", shipX + 0.05, yPos + 0.11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(fs(7));
  let shipY = yPos + 0.22;
  doc.text("Name:", shipX + 0.05, shipY);
  doc.setFont("helvetica", "bold");
  doc.text(po.ship_to_name || "Top Secret Customs", shipX + 0.4, shipY);

  shipY += 0.12;
  doc.setFont("helvetica", "normal");
  doc.text("Company:", shipX + 0.05, shipY);
  doc.text("Olympic Shop Equipment", shipX + 0.4, shipY);

  shipY += 0.12;
  doc.text("Address:", shipX + 0.05, shipY);
  doc.text(po.ship_to_address || "DBA Olympic Shop Equipment", shipX + 0.4, shipY);

  shipY += 0.12;
  doc.text("City/State/ZIP:", shipX + 0.05, shipY);
  doc.text(po.ship_to_city_state_zip || "18935 59th Ave NE, Arlington WA. 98223", shipX + 0.4, shipY);

  yPos += 1.05;

  // Deliver To section
  doc.setFillColor(220, 240, 255);
  doc.rect(0.5, yPos, pageWidth - 1, 0.25, "F");
  doc.setDrawColor(100);
  doc.rect(0.5, yPos, pageWidth - 1, 0.25);
  doc.setFontSize(fs(8));
  doc.setFont("helvetica", "bold");
  doc.text("DELIVER TO", 0.55, yPos + 0.08);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(po.destination || "Same as Ship To", 0.55, yPos + 0.18);
  yPos += 0.3;

  // Order details table
  const detailsData = [
    ["PO Number", "Buyer", "Date", "Vendor No", "Terms"],
    [
      po.po_number,
      po.authorized_by || "—",
      new Date(po.order_date).toLocaleDateString(),
      po.vendor_contact_name || "—",
      po.terms || "—",
    ],
  ];

  // Draw details table
  doc.setFontSize(8);
  const detailColWidths = [1.1, 1.1, 1.1, 1.1, 1.1];
  let detailX = 0.5;

  doc.setFillColor(240, 240, 240);
  doc.setFont("helvetica", "bold");
  detailsData[0].forEach((header, i) => {
    doc.rect(detailX, yPos, detailColWidths[i], 0.15, "F");
    doc.rect(detailX, yPos, detailColWidths[i], 0.15);
    doc.text(header, detailX + 0.05, yPos + 0.11, { maxWidth: detailColWidths[i] - 0.1 });
    detailX += detailColWidths[i];
  });

  yPos += 0.15;
  detailX = 0.5;
  doc.setFont("helvetica", "normal");
  detailsData[1].forEach((value, i) => {
    doc.rect(detailX, yPos, detailColWidths[i], 0.12);
    doc.text(String(value), detailX + 0.05, yPos + 0.09, { maxWidth: detailColWidths[i] - 0.1 });
    detailX += detailColWidths[i];
  });

  yPos += 0.15;

  // Line Items Table Header
  const lineColWidths = [0.35, 0.85, 2.2, 0.65, 0.85, 0.9, 0.95];
  const lineHeaders = ["N#", "Part Number", "Description", "QTY", "Weight (lbs)", "FOB Cost", "Amount"];

  doc.setFillColor(240, 240, 240);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fs(7));
  let lineX = 0.5;

  lineHeaders.forEach((header, i) => {
    doc.rect(lineX, yPos, lineColWidths[i], 0.15, "F");
    doc.rect(lineX, yPos, lineColWidths[i], 0.15);
    const align = i === 0 || i === 3 || i === 4 ? "center" : i >= 5 ? "right" : "left";
    doc.text(header, lineX + 0.05, yPos + 0.11, { maxWidth: lineColWidths[i] - 0.1, align });
    lineX += lineColWidths[i];
  });

  yPos += 0.15;

  // Line items
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fs(8));
  let lineCount = 0;
  const totalWeight = (po.lines || []).reduce((sum: number, line: any) => {
    const weightEach = Number(line.weight_lbs) || 0;
    const qty = Number(line.quantity) || 0;
    return sum + weightEach * qty;
  }, 0);
  const containerMaxLbs = 44000;
  const remainingWeight = Math.max(containerMaxLbs - totalWeight, 0);

  (po.lines || []).forEach((line: any, idx: number) => {
    if (yPos > 9) {
      doc.addPage();
      yPos = 0.5;
    }

    lineX = 0.5;
    const lineHeight = 0.15;

    const lineValues = [
      String(idx + 1),
      line.sku || "—",
      line.description,
      String(line.quantity),
      line.weight_lbs ? line.weight_lbs.toFixed(0) : "—",
      "$" + line.unit_price.toFixed(2),
      "$" + line.line_total.toFixed(2),
    ];

    lineValues.forEach((value, i) => {
      doc.rect(lineX, yPos, lineColWidths[i], lineHeight);
      const align = i === 0 || i === 3 || i === 4 ? "center" : i >= 5 ? "right" : "left";
      doc.text(value, lineX + 0.05, yPos + 0.11, { maxWidth: lineColWidths[i] - 0.1, align });
      lineX += lineColWidths[i];
    });

    yPos += lineHeight;
    lineCount++;
  });

  // Totals
  doc.setDrawColor(50);
  doc.setLineWidth(0.02);
  doc.line(0.5, yPos, pageWidth - 0.5, yPos);
  yPos += 0.08;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Total Net (USD)", 3.5, yPos, { align: "right" });
  doc.text("$" + po.total_amount.toFixed(2), pageWidth - 0.6, yPos, { align: "right" });
  yPos += 0.12;

  doc.setDrawColor(150);
  doc.line(0.5, yPos, pageWidth - 0.5, yPos);
  yPos += 0.08;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(fs(7));
  doc.text("Container Weight Remaining", 3.5, yPos, { align: "right" });
  doc.text(
    remainingWeight.toLocaleString() + " lbs (of " + containerMaxLbs.toLocaleString() + " lbs)",
    pageWidth - 0.6,
    yPos,
    { align: "right" }
  );

  // Footer
  yPos += 0.3;
  doc.setLineWidth(0.01);
  doc.line(0.5, yPos, pageWidth - 0.5, yPos);
  yPos += 0.1;

  doc.setFontSize(fs(8));
  doc.setFont("helvetica", "normal");
  doc.text("If you have any questions about this purchase order, please contact", 0.5, yPos, {
    align: "center",
    maxWidth: pageWidth - 1,
  });
  yPos += 0.1;

  doc.setFont("helvetica", "bold");
  doc.text("Peter Harrett • 360-651-2540 • peter@olympicequipment.com", 0.5, yPos, {
    align: "center",
    maxWidth: pageWidth - 1,
  });
  yPos += 0.1;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(fs(7));
  doc.text("Thank you for your business", 0.5, yPos, { align: "center", maxWidth: pageWidth - 1 });
  yPos += 0.08;

  doc.text("PO #" + po.po_number, 0.5, yPos, { align: "center", maxWidth: pageWidth - 1 });

  return Buffer.from(doc.output("arraybuffer"));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    // Generate PDF
    const pdfBuffer = await generatePDFFromPO(po);

    const fileName = "po-" + po.po_number + "-" + Date.now() + ".pdf";
    const filePath = poId + "/" + fileName;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("generated-po-pdfs")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: "Failed to upload PDF: " + uploadError.message }, { status: 500 });
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
    const { data: urlData } = supabase.storage.from("generated-po-pdfs").getPublicUrl(filePath);

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
    return NextResponse.json({ error: error.message || "Failed to generate PDF" }, { status: 500 });
  }
}
