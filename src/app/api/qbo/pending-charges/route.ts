import { NextRequest, NextResponse } from "next/server";
import { authorizedQboFetch, ensureAccessToken, QboApiError } from "@/lib/qbo";
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

async function fetchQboIntuitPaymentSalesReceipts(userId?: string, todayYmd?: string): Promise<PendingCharge[]> {
  if (!todayYmd) return [];

  const query = `SELECT * FROM SalesReceipt WHERE TxnDate = '${todayYmd}' MAXRESULTS 1000`;
  const data = await authorizedQboFetch<any>(
    `/query?query=${encodeURIComponent(query)}&minorversion=65`,
    {},
    userId || undefined
  );

  const rawReceipts: any[] = data?.QueryResponse?.SalesReceipt || [];

  return rawReceipts
    .filter((sr: any) => {
      const txnSource = String(sr?.TxnSource || "").toUpperCase();
      return txnSource === "INTUITPAYMENT" || !!sr?.CreditCardPayment;
    })
    .map((sr: any) => ({
      id: String(sr.Id || ""),
      created: sr.MetaData?.CreateTime || `${todayYmd}T00:00:00`,
      status: "PROCESSED",
      amount: Number(sr.TotalAmt || 0),
      currency: sr.CurrencyRef?.value || "USD",
      card: {
        name: sr.CustomerRef?.name || sr.BillEmail?.Address || "",
        last4: "",
        cardType: "CARD",
      },
      disburseDate: undefined,
    }));
}

function normalizeAmount(raw: any): number {
  const value = Number(raw || 0);
  if (!Number.isFinite(value)) return 0;
  if (!Number.isInteger(value)) return value;
  if (Math.abs(value) >= 100000) return value / 100;
  return value;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === "number") {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function isSameLocalDay(date: Date, target: Date): boolean {
  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { accessToken, realmId } = await ensureAccessToken(userId || undefined);
    const searchParams = req.nextUrl.searchParams;
    const todayOnly = searchParams.get("today") === "true";

    // The QBO Payments API requires Company-Id header in addition to Bearer token.
    // Pull latest charges and do robust filtering server-side; upstream filters vary by account/API version.
    const url = `${QBO_PAYMENTS_BASE}/charges`;

    let res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Company-Id": realmId,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Request-Id": `pending-charges-${Date.now()}`,
      },
    });

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
          totalAmount: 0,
          count: 0,
        },
        { status: 200 } // 200 so the client receives the structured error
      );
    }

    const data = await res.json();

    // Intuit returns arrays under different keys depending on endpoint version/account
    const raw: any[] = Array.isArray(data)
      ? data
      : data?.charges ?? data?.Charges ?? data?.data ?? data?.items ?? data?.results ?? [];

    const localToday = new Date();

    const charges: PendingCharge[] = raw
      .map((c: any) => ({
        id: c.id || c.Id || "",
        created:
          c.created ||
          c.Created ||
          c.createdAt ||
          c.createTime ||
          c.context?.created ||
          c.TxnDate ||
          "",
        status: (c.status || c.Status || "").toUpperCase(),
        amount: normalizeAmount(c.amount ?? c.Amount ?? c.total ?? c.Total ?? c.context?.amount ?? 0),
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
      .filter((c) => {
        if (todayOnly) {
          const createdDate = toDate(c.created);
          if (!createdDate || !isSameLocalDay(createdDate, localToday)) return false;
          const status = (c.status || "").toUpperCase();
          return !["DECLINED", "FAILED", "VOIDED", "CANCELLED", "CANCELED"].includes(status);
        }

        return !c.status || c.status === "PENDING" || c.status === "AUTHORIZED";
      });

    let finalCharges = charges;

    if (todayOnly && finalCharges.length === 0) {
      try {
        finalCharges = await fetchQboIntuitPaymentSalesReceipts(userId || undefined, localToday.toISOString().slice(0, 10));
      } catch (fallbackError) {
        console.error("QBO IntuitPayment fallback failed", fallbackError);
      }
    }

    const totalPending = finalCharges.reduce((sum, c) => sum + c.amount, 0);

    return NextResponse.json({
      ok: true,
      charges: finalCharges,
      totalPending,
      totalAmount: totalPending,
      count: finalCharges.length,
    });
  } catch (error: any) {
    if (error instanceof QboApiError) {
      return NextResponse.json({ ok: false, error: error.message, charges: [], totalPending: 0, totalAmount: 0, count: 0 }, { status: 200 });
    }
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to fetch pending charges", charges: [], totalPending: 0, totalAmount: 0, count: 0 },
      { status: 200 }
    );
  }
}
