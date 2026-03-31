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
    let recentOrders: ShopifyOrder[] = [];
    let pendingTransactions: ShopifyBalanceTransaction[] = [];

    // Fetch payouts and recent orders in parallel
    const [payoutsResult, ordersResult] = await Promise.allSettled([
      shopifyApiFetch<{ payouts: ShopifyPayout[] }>(payoutsUrl),
      shopifyApiFetch<{ orders: ShopifyOrder[] }>(
        "/orders.json?limit=30&status=any&financial_status=paid&order=created_at+desc"
      ),
    ]);

    if (payoutsResult.status === "fulfilled") {
      payouts = payoutsResult.value?.payouts || [];
    }

    if (ordersResult.status === "fulfilled") {
      recentOrders = ordersResult.value?.orders || [];
    }

    // If we have payouts, try to fetch balance transactions for the most recent scheduled/in_transit payouts
    const pendingPayouts = payouts.filter(
      (p) => p.status === "scheduled" || p.status === "in_transit"
    );

    if (pendingPayouts.length > 0) {
      const txnResult = await shopifyApiFetch<{
        balance_transactions: ShopifyBalanceTransaction[];
      }>(
        `/shopify_payments/balance/transactions.json?payout_id=${pendingPayouts[0].id}&limit=100`
      ).catch(() => null);

      if (txnResult) {
        pendingTransactions = txnResult.balance_transactions || [];
      }
    }

    // Get account balance
    const balanceResult = await shopifyApiFetch<{
      balance: { amount: string; currency: string };
    }>("/shopify_payments/balance.json").catch(() => null);

    if (balanceResult?.balance) {
      balance = balanceResult.balance;
    }

    // Build a map from source_order_id to transaction for enriching order info
    const orderTxnMap = new Map<number, ShopifyBalanceTransaction>();
    pendingTransactions.forEach((txn) => {
      if (txn.source_order_id) {
        orderTxnMap.set(txn.source_order_id, txn);
      }
    });

    // Mark which recent orders are in the pending deposit
    const enrichedOrders = recentOrders.map((order) => ({
      ...order,
      pendingDepositId: orderTxnMap.get(order.id)?.payout_id ?? null,
      pendingDepositStatus: orderTxnMap.get(order.id)?.payout_status ?? null,
      netAmount: orderTxnMap.get(order.id)?.net ?? null,
      fee: orderTxnMap.get(order.id)?.fee ?? null,
      processedAt: orderTxnMap.get(order.id)?.processed_at ?? null,
    }));

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
      recentOrders: enrichedOrders,
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
