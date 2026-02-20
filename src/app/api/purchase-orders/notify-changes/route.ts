import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    // Create change report
    const changeReport: ChangeReport = {
      timestamp: new Date().toISOString(),
      changedBy: session.user.email || session.user.name || "Unknown",
      poNumber: new_po.po_number,
      poId: po_id,
      changes,
      notes: notes || "",
    };

    // Build email content
    const emailBody = `
PO CHANGE NOTIFICATION
${new Date(changeReport.timestamp).toLocaleString()}

PO Number: ${changeReport.poNumber}
Changed By: ${changeReport.changedBy}

CHANGES MADE:
${generateChangesSummary(changes)}

${notes ? `NOTES:\n${notes}` : ""}

Please review these changes and take any necessary action with the supplier.
    `.trim();

    // Store the notification in database
    try {
      await (prisma as any).po_change_notifications.create({
        data: {
          po_id,
          po_number: new_po.po_number,
          changed_by: session.user.email,
          changes: JSON.stringify(changes),
          notes: notes || "",
          created_at: new Date(),
        },
      });
    } catch (error) {
      // Table might not exist yet, log error but don't fail
      console.error("Failed to store notification in database:", error);
    }

    // Try to send email notification to inventory team
    // This assumes there's an environment variable for the inventory team email
    const inventoryTeamEmail = process.env.INVENTORY_TEAM_EMAIL;
    if (inventoryTeamEmail) {
      try {
        await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: inventoryTeamEmail,
            subject: `PO Change Notification - ${new_po.po_number}`,
            text: emailBody,
            html: `<pre>${emailBody}</pre>`,
          }),
        }).catch((err) => {
          console.error("Failed to send email notification:", err);
          // Don't fail the API request if email fails
        });
      } catch (error) {
        console.error("Failed to send email:", error);
      }
    }

    return NextResponse.json({
      ok: true,
      report: changeReport,
      message: "Change notification created successfully",
    });
  } catch (error: any) {
    console.error("Notification error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create notification" },
      { status: 500 }
    );
  }
}
