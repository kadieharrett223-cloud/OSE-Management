import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";

// Configure your email service (Gmail, SendGrid, etc.)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to_email, recipient_name, po_number, subject, message, html_content } = body;

    if (!to_email || !po_number) {
      return NextResponse.json(
        { ok: false, error: "Email and PO number are required" },
        { status: 400 }
      );
    }

    // Send email with the PO
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: to_email,
      subject: subject || `Purchase Order #${po_number}`,
      text: message || `Please see attached purchase order #${po_number}`,
      html: html_content || `<p>Please see attached purchase order #${po_number}</p>`,
    });

    return NextResponse.json({
      ok: true,
      message: `Email sent successfully to ${recipient_name || to_email}`,
    });
  } catch (error) {
    console.error("[po-email] Send error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to send email. Check SMTP configuration." },
      { status: 500 }
    );
  }
}
