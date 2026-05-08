import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { authorizedQboFetch, authorizedQboFetchRaw } from "@/lib/qbo";
import nodemailer from "nodemailer";

const FORCED_INVOICE_SEND_TO_EMAILS = ["mindy@olympic-equipment.com", "kadie@olympic-equipment.com"];
const FORCED_INVOICE_SEND_TO_EMAIL = FORCED_INVOICE_SEND_TO_EMAILS.join(", ");

async function requireAdmin() {
  const session: any = await getSession();
  const role = (session?.user?.role ?? "").toString().toLowerCase();
  return role === "admin";
}

function getTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpSecure = process.env.SMTP_SECURE === "true";

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error("SMTP configuration missing (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)");
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass },
  });
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const invoiceId = String(body?.qbo_invoice_id || "").trim();
    if (!invoiceId) {
      return NextResponse.json({ error: "qbo_invoice_id is required" }, { status: 400 });
    }

    const sendTo = FORCED_INVOICE_SEND_TO_EMAIL;

    const invoiceQuery = `SELECT Id, DocNumber FROM Invoice WHERE Id = '${invoiceId.replace(/'/g, "''")}' MAXRESULTS 1`;
    const invoiceRes = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(invoiceQuery)}&minorversion=65`);
    const docNumber = String(invoiceRes?.QueryResponse?.Invoice?.[0]?.DocNumber || invoiceId).trim() || invoiceId;

    // Fetch invoice PDF from QBO
    const pdfRes = await authorizedQboFetchRaw(`/invoice/${invoiceId}/pdf`, {
      headers: { Accept: "application/pdf" },
    });

    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

    // Send via SMTP
    const transporter = getTransporter();
    const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;

    await transporter.sendMail({
      from: smtpFrom,
      to: sendTo,
      subject: `Invoice ${docNumber}`,
      text: `website order invoice`,
      attachments: [
        {
          filename: `Invoice-${docNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      qboInvoiceId: invoiceId,
      sentToEmail: sendTo,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to resend QBO invoice" }, { status: 500 });
  }
}
