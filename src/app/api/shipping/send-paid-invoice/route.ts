import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import { ensureAccessToken } from "@/lib/qbo";

const QBO_API_BASE = process.env.QBO_ENVIRONMENT === "production"
  ? "https://quickbooks.api.intuit.com"
  : "https://sandbox-quickbooks.api.intuit.com";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { paymentId, customerName } = await req.json();
    const shippingEmail = process.env.SHIPPING_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASSWORD;

    if (!paymentId) {
      return NextResponse.json({ error: "Payment ID is required" }, { status: 400 });
    }

    if (!shippingEmail) {
      return NextResponse.json({ error: "Shipping email is not configured" }, { status: 500 });
    }

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json(
        { error: "SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD (and SMTP_FROM)." },
        { status: 500 }
      );
    }

    const { accessToken, realmId } = await ensureAccessToken();

    const paymentRes = await fetch(
      `${QBO_API_BASE}/v3/company/${realmId}/payment/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!paymentRes.ok) {
      const text = await paymentRes.text();
      return NextResponse.json({ error: `Failed to fetch payment: ${text}` }, { status: 500 });
    }

    const paymentData = await paymentRes.json();
    const payment = paymentData?.Payment;

    const linkedInvoices = (payment?.Line || [])
      .flatMap((line: any) => line.LinkedTxn || [])
      .filter((txn: any) => txn?.TxnType === "Invoice")
      .map((txn: any) => txn?.TxnId)
      .filter(Boolean);

    const uniqueInvoiceIds = Array.from(new Set(linkedInvoices));

    if (uniqueInvoiceIds.length === 0) {
      return NextResponse.json({ error: "No linked invoices found for this payment" }, { status: 404 });
    }

    const attachments = [] as Array<{ filename: string; content: Buffer; contentType: string }>;

    for (const invoiceId of uniqueInvoiceIds) {
      const pdfRes = await fetch(
        `${QBO_API_BASE}/v3/company/${realmId}/invoice/${invoiceId}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/pdf",
          },
        }
      );

      if (!pdfRes.ok) {
        const text = await pdfRes.text();
        return NextResponse.json({ error: `Failed to fetch invoice PDF: ${text}` }, { status: 500 });
      }

      const buffer = Buffer.from(await pdfRes.arrayBuffer());
      attachments.push({
        filename: `Invoice-${invoiceId}.pdf`,
        content: buffer,
        contentType: "application/pdf",
      });
    }

    const invoiceLabel = uniqueInvoiceIds.length === 1
      ? uniqueInvoiceIds[0]
      : uniqueInvoiceIds.join(", ");

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: shippingEmail,
      subject: `Lift Order ${invoiceLabel}`,
      text: `Attached are paid invoice PDF(s) for ${customerName || "the customer"}. Invoice(s): ${invoiceLabel}. Payment ID: ${paymentId}.`,
      attachments,
    });

    return NextResponse.json({ ok: true, invoiceIds: uniqueInvoiceIds });
  } catch (error: any) {
    console.error("[shipping] Send invoice error:", error);
    return NextResponse.json({ error: error.message || "Failed to send invoice" }, { status: 500 });
  }
}
