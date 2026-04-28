import { NextRequest, NextResponse } from "next/server";
import { ensureAccessToken, QboApiError } from "@/lib/qbo";
import { getUserId } from "@/lib/auth";

// QuickBooks Payments API base – separate from the accounting API
const QBO_PAYMENTS_BASE = "https://api.intuit.com/quickbooks/v4/payments";

export interface PendingCharge {
  id: string;
  created: string;
  status: string;
  amount: number;
  currency: string;
  card: {
    name: string;
    last4: string;
    cardType: string;
  } | null;
  token?: string;
  disburseDate?: string;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { accessToken, realmId } = await ensureAccessToken(userId || undefined);

    // The QBO Payments API requires Company-Id header in addition to Bearer token.
    // GET /charges with status filter returns pending/funded charges.
    // We pull the last 30 days and filter client-side for PENDING to be safe.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const startIso = cutoff.toISOString().slice(0, 10);

    const url = `${QBO_PAYMENTS_BASE}/charges?status=PENDING&created_after=${startIso}`;

    let res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Company-Id": realmId,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Request-Id": `pending-charges-${Date.now()}`,
      },
    });

    // If the status-filtered endpoint isn't supported, fall back to plain /charges listing
    if (res.status === 400 || res.status === 404) {
      const fallbackUrl = `${QBO_PAYMENTS_BASE}/charges`;
      res = await fetch(fallbackUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Company-Id": realmId,
          Accept: "application/json",
          "Request-Id": `pending-charges-fallback-${Date.now()}`,
        },
      });
    }

    if (!res.ok) {
      const body = await res.text();
      console.error("QBO Payments API error", res.status, body);
      // Return a friendly error so the UI can show "not available" instead of crashing
      return NextResponse.json(
        {
          ok: false,
          error: `QBO Payments API returned ${res.status}`,
          detail: body,
          charges: [],
          totalPending: 0,
          count: 0,
        },
        { status: 200 } // 200 so the client receives the structured error
      );
    }

    const data = await res.json();

    // Intuit returns the charges array either directly or under a key
    const raw: any[] = Array.isArray(data)
      ? data
      : data?.charges ?? data?.Charges ?? data?.data ?? [];

    const charges: PendingCharge[] = raw
      .map((c: any) => ({
        id: c.id || c.Id || "",
        created: c.created || c.Created || c.TxnDate || "",
        status: (c.status || c.Status || "").toUpperCase(),
        amount: Number(c.amount || c.Amount || 0) / 100, // Payments API returns cents
        currency: c.currency || c.Currency || "USD",
        card: c.card
          ? {
              name: c.card.name || c.card.Name || "",
              last4: c.card.number?.slice(-4) || c.card.last4 || "",
              cardType: c.card.commercialCardCode || c.card.CardType || "",
            }
          : null,
        disburseDate: c.disburseDate || c.DisburseDate || undefined,
      }))
      // Keep only PENDING (not yet funded/settled)
      .filter((c) => !c.status || c.status === "PENDING" || c.status === "AUTHORIZED");

    const totalPending = charges.reduce((sum, c) => sum + c.amount, 0);

    return NextResponse.json({
      ok: true,
      charges,
      totalPending,
      count: charges.length,
    });
  } catch (error: any) {
    if (error instanceof QboApiError) {
      return NextResponse.json({ ok: false, error: error.message, charges: [], totalPending: 0, count: 0 }, { status: 200 });
    }
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to fetch pending charges", charges: [], totalPending: 0, count: 0 },
      { status: 200 }
    );
  }
}
