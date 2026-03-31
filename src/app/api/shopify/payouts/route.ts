import { NextRequest, NextResponse } from "next/server";
import { shopifyApiFetch, getShopifyTokens } from "@/lib/shopify";

export interface ShopifyPayout {
  id: number;
  date: string;
  currency: string;
  amount: string;
  status: "scheduled" | "in_transit" | "paid" | "failed" | "cancelled";
  summary: {
    adjustments_fee_amount: string;
    adjustments_gross_amount: string;
    charges_fee_amount: string;
    charges_gross_amount: string;
    refunds_fee_amount: string;
    refunds_gross_amount: string;
    reserved_funds_fee_amount: string;
    reserved_funds_gross_amount: string;
    retried_payouts_fee_amount: string;
    retried_payouts_gross_amount: string;
  };
}

export interface ShopifyBalanceTransaction {
  id: number;
  type: string;
  test: boolean;
  payout_id: number;
  payout_status: string;
  currency: string;
  amount: string;
  fee: string;
  net: string;
  source_id: number;
  source_type: string;
  source_order_id: number;
  source_order_transaction_id: number;
  processed_at: string;
}

export interface ShopifyOrder {
  id: number;
  name: string;
  created_at: string;
  total_price: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

export interface ShopifyOrderWithDeposit {
  id: number;
  name: string;
  created_at: string;
  total_price: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  pendingDepositId: number | null;
  pendingDepositStatus: string | null;
  netAmount: string | null;
  fee: string | null;
  processedAt: string | null;
  payoutDate: string | null;
  payoutAmount: string | null;
  payoutCurrency: string | null;
  transactionType: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const tokens = await getShopifyTokens();
    if (!tokens) {
      return NextResponse.json({ error: "Shopify not connected" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const includePending = searchParams.get("pending") !== "false";

    // Fetch payouts (sorted by most recent first)
    let payoutsUrl = "/shopify_payments/payouts.json?limit=10&order=desc";
    if (includePending) {
      // Include all statuses to show scheduled & in-transit
      payoutsUrl = "/shopify_payments/payouts.json?limit=10&order=desc";
    }

    let payouts: ShopifyPayout[] = [];
    let balance: { amount: string; currency: string } | null = null;
    let payoutOrders: ShopifyOrderWithDeposit[] = [];
    let pendingTransactions: Array<ShopifyBalanceTransaction & { payout_date?: string; payout_amount?: string; payout_currency?: string }> = [];

    const payoutsResult = await Promise.allSettled([
      shopifyApiFetch<{ payouts: ShopifyPayout[] }>(payoutsUrl),
    ]);

    if (payoutsResult[0].status === "fulfilled") {
      payouts = payoutsResult[0].value?.payouts || [];
    }

    const pendingPayouts = payouts.filter(
      (p) => p.status === "scheduled" || p.status === "in_transit"
    );

    const relevantPayouts = pendingPayouts.length > 0 ? pendingPayouts : payouts.slice(0, 3);

    if (relevantPayouts.length > 0) {
      const txnResults = await Promise.all(
        relevantPayouts.map(async (payout) => {
          const txnResult = await shopifyApiFetch<{
            balance_transactions: ShopifyBalanceTransaction[];
          }>(
            `/shopify_payments/balance/transactions.json?payout_id=${payout.id}&limit=100`
          ).catch(() => null);

          return (txnResult?.balance_transactions || []).map((txn) => ({
            ...txn,
            payout_date: payout.date,
            payout_amount: payout.amount,
            payout_currency: payout.currency,
          }));
        })
      );

      pendingTransactions = txnResults
        .flat()
        .filter((txn) => Boolean(txn.source_order_id));

      const orderIds = Array.from(
        new Set(
          pendingTransactions
            .map((txn) => txn.source_order_id)
            .filter((value): value is number => typeof value === "number" && value > 0)
        )
      );

      const orderMap = new Map<number, ShopifyOrder>();
      if (orderIds.length > 0) {
        const chunks: number[][] = [];
        for (let i = 0; i < orderIds.length; i += 50) {
          chunks.push(orderIds.slice(i, i + 50));
        }

        const orderResults = await Promise.all(
          chunks.map((chunk) =>
            shopifyApiFetch<{ orders: ShopifyOrder[] }>(
              `/orders.json?ids=${chunk.join(",")}&status=any&fields=id,name,created_at,total_price,financial_status,fulfillment_status,customer`
            ).catch(() => null)
          )
        );

        orderResults.forEach((result) => {
          (result?.orders || []).forEach((order) => {
            orderMap.set(order.id, order);
          });
        });
      }

      payoutOrders = pendingTransactions
        .map((txn) => {
          const order = txn.source_order_id ? orderMap.get(txn.source_order_id) : undefined;
          const fallbackOrderName = txn.source_order_id ? `Order ${txn.source_order_id}` : `Txn ${txn.id}`;

          return {
            id: order?.id || txn.source_order_id || txn.id,
            name: order?.name || fallbackOrderName,
            created_at: order?.created_at || txn.processed_at || "",
            total_price: order?.total_price || txn.amount || "0",
            financial_status: order?.financial_status || "paid",
            fulfillment_status: order?.fulfillment_status ?? null,
            customer: order?.customer,
            pendingDepositId: txn.payout_id ?? null,
            pendingDepositStatus: txn.payout_status ?? null,
            netAmount: txn.net ?? null,
            fee: txn.fee ?? null,
            processedAt: txn.processed_at ?? null,
            payoutDate: txn.payout_date || null,
            payoutAmount: txn.payout_amount || null,
            payoutCurrency: txn.payout_currency || null,
            transactionType: txn.type || null,
          };
        })
        .sort((a, b) => {
          const dateA = a.payoutDate || a.processedAt || a.created_at || "";
          const dateB = b.payoutDate || b.processedAt || b.created_at || "";
          return dateB.localeCompare(dateA);
        });
    }

    // Get account balance
    const balanceResult = await shopifyApiFetch<{
      balance: { amount: string; currency: string };
    }>("/shopify_payments/balance.json").catch(() => null);

    if (balanceResult?.balance) {
      balance = balanceResult.balance;
    }

    // Categorize payouts
    const scheduledPayouts = payouts.filter((p) => p.status === "scheduled" || p.status === "in_transit");
    const completedPayouts = payouts.filter((p) => p.status === "paid");

    return NextResponse.json({
      ok: true,
      balance,
      scheduledPayouts,
      completedPayouts,
      allPayouts: payouts,
      pendingTransactions,
      recentOrders: payoutOrders,
    });
  } catch (error: any) {
    // Shopify Payments may not be enabled on this store
    const isNotEnabled =
      error?.message?.includes("422") ||
      error?.message?.includes("402") ||
      error?.message?.includes("shopify_payments");

    if (isNotEnabled) {
      return NextResponse.json({
        ok: false,
        error: "Shopify Payments not enabled",
        shopifyPaymentsNotEnabled: true,
        recentOrders: [],
        scheduledPayouts: [],
        completedPayouts: [],
        allPayouts: [],
        balance: null,
      });
    }

    console.error("[shopify/payouts] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch Shopify payouts" },
      { status: 500 }
    );
  }
}
