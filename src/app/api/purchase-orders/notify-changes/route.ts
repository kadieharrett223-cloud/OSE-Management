import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";

interface ChangeReport {
  timestamp: string;
  changedBy: string;
  poNumber: string;
  poId: string;
  changes: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  notes: string;
}

function formatFieldName(field: string): string {
  return field
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function generateChangesSummary(changes: ChangeReport["changes"]): string {
  return changes
    .map(
      (change) =>
        `• ${change.field}: "${change.oldValue}" → "${change.newValue}"`
    )
    .join("\n");
}

function parseRecipientList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function generatePOPDF(po: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Title
    doc.fontSize(16).text("PURCHASE ORDER", { align: "center" });
    doc.moveDown(0.5);

    // PO Header Info
    const headerX = 50;
    const valueX = 150;
    doc.fontSize(10);
    doc.text(`PO Number:`, headerX, doc.y);
    doc.text(po.po_number, valueX, doc.y - 12);

    doc.fontSize(10).text(`Order Date:`, headerX, doc.y + 5);
    const orderDate = po.order_date ? new Date(po.order_date).toLocaleDateString() : "—";
    doc.text(orderDate, valueX, doc.y - 12);

    doc.fontSize(10).text(`Expected Delivery:`, headerX, doc.y + 5);
    const deliveryDate = po.expected_delivery ? new Date(po.expected_delivery).toLocaleDateString() : "—";
    doc.text(deliveryDate, valueX, doc.y - 12);

    doc.fontSize(10).text(`Total Amount:`, headerX, doc.y + 5);
    doc.text(`$${(po.total_amount || 0).toFixed(2)}`, valueX, doc.y - 12);

    doc.moveDown(1);

    // Vendor Info
    doc.fontSize(11).text("VENDOR INFORMATION");
    doc.fontSize(9);
    doc.text(`Name: ${po.vendor_name || "—"}`, { align: "left" });
    doc.text(`Contact: ${po.vendor_contact_name || "—"}`, { align: "left" });
    doc.text(`Email: ${po.vendor_email || "—"}`, { align: "left" });
    doc.text(`Phone: ${po.vendor_phone || "—"}`, { align: "left" });
    doc.text(`Terms: ${po.terms || "—"}`, { align: "left" });

    doc.moveDown(0.5);

    // Line Items
    if (po.lines && po.lines.length > 0) {
      doc.fontSize(11).text("LINE ITEMS");
      doc.moveDown(0.3);

      // Table header
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 150;
      const col3 = 350;
      const col4 = 450;

      doc.fontSize(8);
      doc.text("SKU", col1, tableTop);
      doc.text("Description", col2, tableTop);
      doc.text("QTY", col3, tableTop);
      doc.text("FOB Cost", col4, tableTop);

      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
      let yPosition = tableTop + 20;

      doc.fontSize(8);
      po.lines.forEach((line: any) => {
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }
        doc.text(line.sku || "—", col1, yPosition);
        doc.text(line.description || "—", col2, yPosition, { width: 180 });
        doc.text(String(line.quantity || 0), col3, yPosition);
        doc.text(`$${(line.unit_price || 0).toFixed(2)}`, col4, yPosition);
        yPosition += 30;
      });

      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      doc.fontSize(10);
      doc.text(`TOTAL: $${(po.total_amount || 0).toFixed(2)}`, col4 - 100, yPosition + 5);
    }

    doc.moveDown(1);
    doc.fontSize(8).fillColor("#666666");
    doc.text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });

    doc.end();
  });
}

export async function POST(req: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { po_id, old_po, new_po, notes } = body;

    if (!po_id || !old_po || !new_po) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Calculate what changed
    const changes: ChangeReport["changes"] = [];
    const fieldsToCheck = [
      "po_number",
      "vendor_name",
      "vendor_contact_name",
      "vendor_email",
      "vendor_phone",
      "terms",
      "expected_delivery",
      "total_amount",
    ];

    fieldsToCheck.forEach((field) => {
      const oldVal = old_po[field];
      const newVal = new_po[field];
      if (oldVal !== newVal) {
        changes.push({
          field: formatFieldName(field),
          oldValue: oldVal || "—",
          newValue: newVal || "—",
        });
      }
    });

    // Check if line items changed
    const oldLines = old_po.lines || [];
    const newLines = new_po.lines || [];
    if (JSON.stringify(oldLines) !== JSON.stringify(newLines)) {
      changes.push({
        field: "Line Items",
        oldValue: `${oldLines.length} items`,
        newValue: `${newLines.length} items`,
      });
    }

    // Get a change number (timestamp-based)
    const changeNumber = Math.floor(Date.now() / 1000);

    // Create change report
    const changeReport: ChangeReport = {
      timestamp: new Date().toISOString(),
      changedBy: session.user.email || session.user.name || "Unknown",
      poNumber: new_po.po_number,
      poId: po_id,
      changes,
      notes: notes || "",
    };

    // Store the notification in database
    try {
      // Skip database storage - focus on email first
      console.log("[NOTIFY] Skipping database storage");
    } catch (error) {
      console.error("Failed to store notification in database:", error);
    }

    // PDF generation skipped due to Vercel serverless font issues
    // TODO: Implement PDF generation using a cloud service
    console.log("[NOTIFY] PDF generation disabled (use cloud service for PDF attachments)");

    // Try to send email notification to inventory team
    let emailAttempted = false;
    let emailSent = false;
    let emailError: string | null = null;
    let smsAttempted = false;
    let smsSent = false;
    let smsError: string | null = null;
    const inventoryTeamEmail = process.env.INVENTORY_TEAM_EMAIL;
    const smsRecipients = parseRecipientList(process.env.MOBILE_NOTIFICATION_SMS_TO);
    if (inventoryTeamEmail) {
      try {
        const emailBody = `
PURCHASE ORDER CHANGE NOTIFICATION

PO #: ${new_po.po_number}
Change #: ${changeNumber}
Changed By: ${changeReport.changedBy}
Date: ${new Date(changeReport.timestamp).toLocaleString()}

CHANGES MADE:
${generateChangesSummary(changes)}

${notes ? `NOTES FROM TEAM:\n${notes}` : ""}

Please review the attached current PO and address any necessary changes with the supplier.
        `.trim();

        const emailHtml = `
<div style="font-family: Arial, sans-serif; line-height: 1.6;">
  <h2>Purchase Order Change Notification</h2>
  
  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>PO #:</strong> ${new_po.po_number}</p>
    <p><strong>Change #:</strong> ${changeNumber}</p>
    <p><strong>Changed By:</strong> ${changeReport.changedBy}</p>
    <p><strong>Date:</strong> ${new Date(changeReport.timestamp).toLocaleString()}</p>
  </div>

  <h3>Changes Made:</h3>
  <ul>
${changes.map((change) => `    <li><strong>${change.field}:</strong> "${change.oldValue}" → "${change.newValue}"</li>`).join("\n")}
  </ul>

  ${notes ? `<h3>Notes from Team:</h3><p style="background-color: #fffacd; padding: 10px; border-radius: 5px;">${notes.replace(/\n/g, "<br>")}</p>` : ""}

  <p style="margin-top: 20px; color: #666; font-size: 12px;">
    Please review the attached current PO and address any necessary changes with the supplier.
  </p>
</div>
        `.trim();

        // Send email with nodemailer
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
          emailAttempted = true;
          console.log("[NOTIFY] SMTP config check passed");
          console.log(`[NOTIFY] Attempting to send to: ${inventoryTeamEmail}`);
          
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_SECURE === "true",
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            },
          });

          console.log(`[NOTIFY] Transporter created for ${process.env.SMTP_USER}`);

          const mailOptions: any = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: inventoryTeamEmail,
            subject: `PO #${new_po.po_number} - Change #${changeNumber}`,
            text: emailBody,
            html: emailHtml,
          };

          try {
            console.log("[NOTIFY] Sending mail...");
            const result = await transporter.sendMail(mailOptions);
            console.log("[NOTIFY] Mail sent successfully:", result.messageId);
            emailSent = true;
          } catch (sendError: any) {
            emailError = sendError?.message || "Failed to send email notification";
            console.error("[NOTIFY] Failed to send email:", sendError);
          }
        } else {
          console.log("[NOTIFY] Missing SMTP config:");
          console.log(`  SMTP_HOST: ${process.env.SMTP_HOST ? "✓" : "✗"}`);
          console.log(`  SMTP_USER: ${process.env.SMTP_USER ? "✓" : "✗"}`);
          console.log(`  SMTP_PASSWORD: ${process.env.SMTP_PASSWORD ? "✓" : "✗"}`);
          emailError = "Missing SMTP configuration";
        }
      } catch (error) {
        emailError = "Failed to prepare email";
        console.error("Failed to prepare/send email:", error);
      }
    }

    // Free mobile notifications via carrier email-to-SMS gateways
    // Example recipients: 5551234567@vtext.com,5551234567@txt.att.net
    if (smsRecipients.length > 0) {
      try {
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
          smsAttempted = true;
          console.log(`[NOTIFY] Attempting SMS gateway delivery to ${smsRecipients.length} recipient(s)`);

          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_SECURE === "true",
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            },
          });

          const smsBody = [
            `PO ${new_po.po_number} updated`,
            `By: ${changeReport.changedBy}`,
            `Changes: ${changes.length}`,
            `At: ${new Date(changeReport.timestamp).toLocaleString()}`,
          ].join(" | ");

          await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: smsRecipients.join(","),
            subject: `PO ${new_po.po_number} updated`,
            text: smsBody,
          });

          smsSent = true;
          console.log("[NOTIFY] SMS gateway message sent successfully");
        } else {
          smsError = "Missing SMTP configuration for SMS gateway";
        }
      } catch (sendSmsError: any) {
        smsError = sendSmsError?.message || "Failed to send SMS gateway notification";
        console.error("[NOTIFY] Failed to send SMS gateway notification:", sendSmsError);
      }
    }

    return NextResponse.json({
      ok: true,
      report: changeReport,
      changeNumber,
      message: "Change notification created successfully",
      emailStatus: {
        to: inventoryTeamEmail || null,
        attempted: emailAttempted,
        sent: emailSent,
        error: emailError,
      },
      smsStatus: {
        to: smsRecipients,
        attempted: smsAttempted,
        sent: smsSent,
        error: smsError,
      },
    });
  } catch (error: any) {
    console.error("Notification error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create notification" },
      { status: 500 }
    );
  }
}
