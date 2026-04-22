import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { authorizedQboFetch } from "@/lib/qbo";

const FORCED_INVOICE_SEND_TO_EMAIL = "kadie@olympc-equipment.com";

async function requireAdmin() {
  const session: any = await getSession();
  const role = (session?.user?.role ?? "").toString().toLowerCase();
  return role === "admin";
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
    const sendQuery = `?sendTo=${encodeURIComponent(sendTo)}&minorversion=65`;

    try {
      await authorizedQboFetch<any>(`/invoice/${invoiceId}/send${sendQuery}`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      return NextResponse.json({
        ok: true,
        qboInvoiceId: invoiceId,
        sentToEmail: sendTo,
      });
    } catch {
      const invoiceQuery = `SELECT Id, SyncToken FROM Invoice WHERE Id = '${invoiceId.replace(/'/g, "''")}' MAXRESULTS 1`;
      const invoiceRes = await authorizedQboFetch<any>(`/query?query=${encodeURIComponent(invoiceQuery)}&minorversion=65`);
      const invoice = invoiceRes?.QueryResponse?.Invoice?.[0];

      if (!invoice?.Id || invoice?.SyncToken === undefined || invoice?.SyncToken === null) {
        throw new Error("Unable to load invoice SyncToken for resend fallback");
      }

      await authorizedQboFetch<any>("/invoice?minorversion=65", {
        method: "POST",
        body: JSON.stringify({
          Id: invoice.Id,
          SyncToken: invoice.SyncToken,
          sparse: true,
          BillEmail: { Address: sendTo },
        }),
      });

      await authorizedQboFetch<any>(`/invoice/${invoiceId}/send${sendQuery}`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      return NextResponse.json({
        ok: true,
        qboInvoiceId: invoiceId,
        sentToEmail: sendTo,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to resend QBO invoice" }, { status: 500 });
  }
}
