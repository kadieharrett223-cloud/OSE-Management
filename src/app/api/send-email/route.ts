import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  return transporter;
}

export async function POST(req: NextRequest) {
  try {
    // Check required environment variables
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.error("SMTP configuration missing");
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    const formData = await req.formData();

    const to = formData.get("to") as string;
    const subject = formData.get("subject") as string;
    const text = formData.get("text") as string;
    const html = formData.get("html") as string;
    const attachment = formData.get("attachment") as File | null;

    if (!to || !subject) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject" },
        { status: 400 }
      );
    }

    const mailOptions: any = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text: text || "",
      html: html || text || "",
    };

    // Handle attachment if provided
    if (attachment) {
      const buffer = await attachment.arrayBuffer();
      mailOptions.attachments = [
        {
          filename: attachment.name,
          content: Buffer.from(buffer),
          contentType: attachment.type,
        },
      ];
    }

    const mailer = getTransporter();
    await mailer.sendMail(mailOptions);

    return NextResponse.json({
      ok: true,
      message: "Email sent successfully",
    });
  } catch (error: any) {
    console.error("Email send error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
