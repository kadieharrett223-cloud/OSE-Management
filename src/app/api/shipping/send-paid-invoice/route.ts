import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch, authorizedQboFetchRaw, QboApiError } from "@/lib/qbo";

export async function POST(req: NextRequest) {
  try {
    const { paymentId, customerName } = await req.json();
    const shippingEmail = process.env.SHIPPING_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASSWORD;
    const smtpPort = parseInt(process.env.SMTP_PORT || "587");
    const smtpSecure = process.env.SMTP_SECURE === "true";
    const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;

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

    if (!smtpFrom) {
      return NextResponse.json(
        { error: "SMTP_FROM is not configured (or SMTP_USER is missing)." },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    try {
      await transporter.verify();
    } catch (verifyError: any) {
      const message = verifyError?.message || "SMTP verification failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const paymentData = await authorizedQboFetch<any>(`/payment/${paymentId}`);
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
      const pdfRes = await authorizedQboFetchRaw(`/invoice/${invoiceId}/pdf`, {
        headers: {
          Accept: "application/pdf",
        },
      });

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

    try {
      await transporter.sendMail({
        from: smtpFrom,
        to: shippingEmail,
        subject: `Lift Order ${invoiceLabel}`,
        text: `Attached are paid invoice PDF(s) for ${customerName || "the customer"}. Invoice(s): ${invoiceLabel}. Payment ID: ${paymentId}.`,
        attachments,
      });
    } catch (sendError: any) {
      const message = sendError?.message || "Failed to send email";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json({ ok: true, invoiceIds: uniqueInvoiceIds });
  } catch (error: any) {
    if (error instanceof QboApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[shipping] Send invoice error:", error);
    return NextResponse.json({ error: error.message || "Failed to send invoice" }, { status: 500 });
  }
}
