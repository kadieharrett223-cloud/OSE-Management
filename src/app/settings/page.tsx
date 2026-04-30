'use client';

export const dynamic = "force-dynamic";

import { signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [qboConnected, setQboConnected] = useState(false);
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [shopifyShop, setShopifyShop] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnectingShopify, setDisconnectingShopify] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [shopInput, setShopInput] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState(1);
  const [activeTab, setActiveTab] = useState<'integrations' | 'defaults' | 'billing'>('integrations');
  const [globalTariffPercent, setGlobalTariffPercent] = useState<string>('100');
  const [keepSellPricesOnTariffChange, setKeepSellPricesOnTariffChange] = useState(false);
  const [savingTariff, setSavingTariff] = useState(false);
  const [savingOrderSyncSettings, setSavingOrderSyncSettings] = useState(false);
  const [runningOrderSync, setRunningOrderSync] = useState(false);
  const [orderSyncEnabled, setOrderSyncEnabled] = useState(false);
  const [orderSyncStatuses, setOrderSyncStatuses] = useState('paid');
  const [defaultCustomerId, setDefaultCustomerId] = useState('');
  const [defaultItemId, setDefaultItemId] = useState('');
  const [shippingItemId, setShippingItemId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentMethodName, setPaymentMethodName] = useState('Shopify');
  const [depositAccountId, setDepositAccountId] = useState('');
  const [customerMappingJson, setCustomerMappingJson] = useState('{\n\n}');
  const [lineItemMappingJson, setLineItemMappingJson] = useState('{\n\n}');
  const [autoSendToEmail, setAutoSendToEmail] = useState('');
  const [sendSummaryEmail, setSendSummaryEmail] = useState(false);
  const [createMissingCustomers, setCreateMissingCustomers] = useState(false);
  const [lastOrderSyncAt, setLastOrderSyncAt] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Check QBO status
        const qboRes = await fetch('/api/qbo/refresh', { method: 'POST' });
        setQboConnected(qboRes.ok);

        // Check Shopify status
        const shopifyRes = await fetch('/api/shopify/status');
        if (shopifyRes.ok) {
          const data = await shopifyRes.json();
          setShopifyConnected(data.connected);
          setShopifyShop(data.shop);
        }

        const shopifySettingsRes = await fetch('/api/shopify/settings');
        if (shopifySettingsRes.ok) {
          const shopifySettingsData = await shopifySettingsRes.json();
          const settings = shopifySettingsData?.settings || {};

          setOrderSyncEnabled(Boolean(settings.order_sync_enabled));
          setOrderSyncStatuses(Array.isArray(settings.order_sync_financial_statuses) ? settings.order_sync_financial_statuses.join(', ') : 'paid');
          setDefaultCustomerId(settings.qbo_default_customer_id || '');
          setDefaultItemId(settings.qbo_default_item_id || '');
          setShippingItemId(settings.qbo_shipping_item_id || '');
          setPaymentMethodId(settings.qbo_payment_method_id || '');
          setPaymentMethodName(settings.qbo_payment_method_name || 'Shopify');
          setDepositAccountId(settings.qbo_deposit_account_id || '');
          setCustomerMappingJson(JSON.stringify(settings.customer_mapping_json || {}, null, 2));
          setLineItemMappingJson(JSON.stringify(settings.line_item_mapping_json || {}, null, 2));
          setAutoSendToEmail(settings.auto_send_to_email || '');
          setSendSummaryEmail(Boolean(settings.send_summary_email));
          setCreateMissingCustomers(Boolean(settings.create_missing_customers));
          setLastOrderSyncAt(settings.last_order_sync_at || null);
        }

        // Load global pricing settings (admin-only)
        const pricingRes = await fetch('/api/pricing/settings');
        if (pricingRes.ok) {
          const pricingData = await pricingRes.json();
          const tariff = Number(pricingData?.settings?.global_tariff_percent ?? 100);
          setGlobalTariffPercent(String(tariff));
        }
      } catch (err) {
        console.error('Failed to check connection status:', err);
      } finally {
        setLoading(false);
      }
    };

    // AUTH_DISABLED is set on production, so always check status
    checkStatus();

    // Check for Shopify redirect messages
    const params = new URLSearchParams(window.location.search);
    if (params.get('shopify') === 'connected') {
      setSuccess('Shopify connected successfully!');
      window.history.replaceState({}, '', '/settings');
    } else if (params.get('shopify') === 'error') {
      setError(params.get('message') || 'Failed to connect Shopify');
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  const handleDisconnectQbo = async () => {
    if (!confirm('Disconnect QuickBooks? You\'ll need to reconnect to access QB data.')) return;
    try {
      setError(null);
      const res = await fetch('/api/qbo/disconnect', { method: 'POST' });
      if (res.ok) {
        setQboConnected(false);
        setSuccess('QuickBooks disconnected successfully');
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect QuickBooks');
    }
  };

  const handleConnectQbo = async () => {
    try {
      setError(null);
      const res = await fetch('/api/qbo/connect');
      if (!res.ok) throw new Error('Failed to connect QB');
      // Redirect will happen from the API
    } catch (err: any) {
      setError(err.message || 'Failed to connect QuickBooks');
    }
  };

  const handleConnectShopify = async () => {
    try {
      setError(null);
      if (!shopInput.trim()) {
        setError('Please enter your Shopify store domain');
        return;
      }

      const res = await fetch('/api/shopify/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop: shopInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect Shopify');
      }

      // Redirect to Shopify OAuth
      window.location.href = data.authUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to connect Shopify');
    }
  };

  const handleDisconnectShopify = async () => {
    if (!confirm("Disconnect Shopify? You'll need to reconnect to sync Shopify data.")) return;
    try {
      setError(null);
      setSuccess(null);
      setDisconnectingShopify(true);
      const res = await fetch('/api/shopify/disconnect', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to disconnect Shopify');
      }

      setShopifyConnected(false);
      setShopifyShop(null);
      setSuccess('Shopify disconnected successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect Shopify');
    } finally {
      setDisconnectingShopify(false);
    }
  };

  const handleSyncPrices = () => {
    setError(null);
    setSuccess(null);
    setShowConfirmModal(true);
    setConfirmationStep(1);
  };

  const handleConfirmSync = async () => {
    if (confirmationStep === 1) {
      setConfirmationStep(2);
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setSyncing(true);
      setShowConfirmModal(false);

      const res = await fetch('/api/shopify/sync', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync prices');
      }

      setSuccess(
        `Sync completed: ${data.success} updated, ${data.skipped} skipped, ${data.failed} failed`
      );
    } catch (err: any) {
      setError(err.message || 'Failed to sync prices');
    } finally {
      setSyncing(false);
      setConfirmationStep(1);
    }
  };

  const handleCancelSync = () => {
    setShowConfirmModal(false);
    setConfirmationStep(1);
  };

  const handleLogout = async () => {
    await fetch('/api/access/logout', { method: 'POST' }).catch(() => undefined);
    await signOut({ redirect: true, callbackUrl: '/auth/signin' });
  };

  const handleSaveTariff = async () => {
    try {
      const parsed = Number(globalTariffPercent);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 500) {
        setError('Tariff must be a number between 0 and 500');
        return;
      }

      // Support both input styles:
      // - Percent: 25 => 25%
      // - Multiplier: 1.25 => 25%
      const normalizedTariffPercent = parsed >= 1 && parsed <= 3
        ? (parsed - 1) * 100
        : parsed;

      setSavingTariff(true);
      setError(null);
      setSuccess(null);

      const res = await fetch('/api/pricing/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          global_tariff_percent: normalizedTariffPercent,
          keep_sell_prices: keepSellPricesOnTariffChange,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save tariff setting');
      }

      setGlobalTariffPercent(String(Number(normalizedTariffPercent.toFixed(4))));
      if (keepSellPricesOnTariffChange) {
        setSuccess('Global tariff updated. Non-manual products were recalculated while keeping existing sell prices.');
      } else {
        setSuccess('Global tariff updated. Non-manual products were recalculated.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save tariff setting');
    } finally {
      setSavingTariff(false);
    }
  };

  const parseMapJson = (raw: string, label: string) => {
    try {
      const parsed = JSON.parse(raw || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${label} must be a JSON object`);
      }
      return parsed;
    } catch {
      throw new Error(`${label} must be valid JSON`);
    }
  };

  const handleSaveOrderSyncSettings = async () => {
    try {
      setSavingOrderSyncSettings(true);
      setError(null);
      setSuccess(null);

      const customerMap = parseMapJson(customerMappingJson, 'Customer mapping');
      const lineMap = parseMapJson(lineItemMappingJson, 'Line item mapping');
      const statuses = orderSyncStatuses
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const res = await fetch('/api/shopify/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_sync_enabled: orderSyncEnabled,
          order_sync_financial_statuses: statuses.length > 0 ? statuses : ['paid'],
          qbo_default_customer_id: defaultCustomerId || null,
          qbo_default_item_id: defaultItemId || null,
          qbo_shipping_item_id: shippingItemId || null,
          qbo_payment_method_id: paymentMethodId || null,
          qbo_payment_method_name: paymentMethodName || 'Shopify',
          qbo_deposit_account_id: depositAccountId || null,
          customer_mapping_json: customerMap,
          line_item_mapping_json: lineMap,
          auto_send_to_email: autoSendToEmail || null,
          send_summary_email: sendSummaryEmail,
          create_missing_customers: createMissingCustomers,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save Shopify order sync settings');
      }

      setSuccess('Shopify to QuickBooks order sync settings saved.');
    } catch (err: any) {
      setError(err.message || 'Failed to save order sync settings');
    } finally {
      setSavingOrderSyncSettings(false);
    }
  };

  const handleRunOrderSync = async () => {
    try {
      setRunningOrderSync(true);
      setError(null);
      setSuccess(null);

      const res = await fetch('/api/shopify/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualImport: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync Shopify orders to QuickBooks');
      }

      setLastOrderSyncAt(new Date().toISOString());
      setSuccess(`Manual import completed: ${data.synced} synced, ${data.skipped} skipped, ${data.failed} failed.`);
    } catch (err: any) {
      setError(err.message || 'Failed to run manual Shopify import');
    } finally {
      setRunningOrderSync(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <div className="flex items-center gap-3 md:gap-4">
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900 p-1"
              title="Go back"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Settings</h1>
              <p className="text-gray-500 mt-1">Manage your account and app preferences</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-3 md:py-4">
        <div className="mb-4 md:mb-6 border-b border-gray-200">
          <nav className="flex gap-3 md:gap-4 overflow-x-auto">
            <Link
              href="/settings"
              className={`pb-3 px-1 border-b-2 text-sm font-medium transition whitespace-nowrap ${
                pathname === "/settings"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Settings
            </Link>
            <Link
              href="/admin/mapping"
              className={`pb-3 px-1 border-b-2 text-sm font-medium transition ${
                pathname === "/admin/mapping"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Product Mapping
            </Link>
          </nav>
        </div>

        <div className="mb-4 md:mb-6 rounded-lg bg-white shadow">
          <div className="flex flex-wrap gap-2 md:gap-3 border-b border-gray-100 px-3 md:px-4 py-2 md:py-3">
            {[
              { id: 'integrations', label: 'Integrations' },
              { id: 'defaults', label: 'Defaults' },
              { id: 'billing', label: 'Billing' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`rounded-full px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {activeTab === 'integrations' && (
          <>
            {/* QuickBooks Section */}
            <div className="bg-white rounded-lg shadow mb-6 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">QuickBooks Integration</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-700 font-medium">QuickBooks Online Connection</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {qboConnected ? 'Connected' : 'Not connected'}
                    </p>
                  </div>
                  <div>
                    {qboConnected ? (
                      <button
                        onClick={handleDisconnectQbo}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <Link
                        href="/api/qbo/connect"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        Connect
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Shopify Section */}
            <div className="bg-white rounded-lg shadow mb-6 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Shopify Integration</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-gray-700 font-medium">Shopify Store Connection</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {shopifyConnected ? `Connected to ${shopifyShop}` : 'Not connected'}
                    </p>
                  </div>
                  <div>
                    {shopifyConnected ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSyncPrices}
                          disabled={syncing}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {syncing ? 'Syncing...' : 'Push Mapped to Shopify'}
                        </button>
                        <button
                          onClick={handleDisconnectShopify}
                          disabled={disconnectingShopify}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {disconnectingShopify ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={shopInput}
                          onChange={(e) => setShopInput(e.target.value)}
                          placeholder="your-store.myshopify.com"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={handleConnectShopify}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                          Connect
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {shopifyConnected && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> Use “Push Mapped to Shopify” here to send mapped price list updates to Shopify based on matching SKUs.
                      Make sure your Shopify product variants have SKUs that match your price list item numbers.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow mb-6 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Shopify to QuickBooks Order Sync</h2>
              <p className="text-sm text-gray-500 mb-4">
                Automatically create QuickBooks invoices from Shopify orders (without auto-recording payments) and send summary emails.
              </p>

              <div className="space-y-4">
                <label className="flex items-center gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={orderSyncEnabled}
                    onChange={(e) => setOrderSyncEnabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Enable automatic Shopify → QuickBooks order sync
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Shopify Financial Statuses</label>
                    <input
                      type="text"
                      value={orderSyncStatuses}
                      onChange={(e) => setOrderSyncStatuses(e.target.value)}
                      placeholder="paid, partially_paid"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Comma-separated values to sync from Shopify.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">QBO Payment Method Name</label>
                    <input
                      type="text"
                      value={paymentMethodName}
                      onChange={(e) => setPaymentMethodName(e.target.value)}
                      placeholder="Shopify"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">QBO Default Customer ID</label>
                    <input
                      type="text"
                      value={defaultCustomerId}
                      onChange={(e) => setDefaultCustomerId(e.target.value)}
                      placeholder="123"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">QBO Default Item ID</label>
                    <input
                      type="text"
                      value={defaultItemId}
                      onChange={(e) => setDefaultItemId(e.target.value)}
                      placeholder="123"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">QBO Shipping Item ID</label>
                    <input
                      type="text"
                      value={shippingItemId}
                      onChange={(e) => setShippingItemId(e.target.value)}
                      placeholder="123"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">QBO Payment Method ID (optional override)</label>
                    <input
                      type="text"
                      value={paymentMethodId}
                      onChange={(e) => setPaymentMethodId(e.target.value)}
                      placeholder="45"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">QBO Deposit Account ID (optional)</label>
                    <input
                      type="text"
                      value={depositAccountId}
                      onChange={(e) => setDepositAccountId(e.target.value)}
                      placeholder="35"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Mapping JSON</label>
                    <textarea
                      value={customerMappingJson}
                      onChange={(e) => setCustomerMappingJson(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Map Shopify email/name to QBO Customer ID.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Line Item Mapping JSON</label>
                    <textarea
                      value={lineItemMappingJson}
                      onChange={(e) => setLineItemMappingJson(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Map Shopify SKU to QBO Item ID.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Auto-send Summary To</label>
                    <input
                      type="email"
                      value={autoSendToEmail}
                      onChange={(e) => setAutoSendToEmail(e.target.value)}
                      placeholder="ops@yourcompany.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 mt-7">
                      <input
                        type="checkbox"
                        checked={sendSummaryEmail}
                        onChange={(e) => setSendSummaryEmail(e.target.checked)}
                        className="h-4 w-4"
                      />
                      Send summary email after each sync
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={createMissingCustomers}
                        onChange={(e) => setCreateMissingCustomers(e.target.checked)}
                        className="h-4 w-4"
                      />
                      Auto-create missing QBO customers
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveOrderSyncSettings}
                    disabled={savingOrderSyncSettings}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingOrderSyncSettings ? 'Saving...' : 'Save Order Sync Settings'}
                  </button>

                  <button
                    type="button"
                    onClick={handleRunOrderSync}
                    disabled={runningOrderSync}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {runningOrderSync ? 'Importing...' : 'Manual Import Orders'}
                  </button>

                  <p className="text-xs text-gray-500">
                    Last sync: {lastOrderSyncAt ? new Date(lastOrderSyncAt).toLocaleString() : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'defaults' && (
          <>
            <div className="bg-white rounded-lg shadow mb-6 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Pricing Defaults</h2>
              <p className="text-sm text-gray-500 mb-4">
                Set the global tariff percent used to auto-calculate pricing for all products unless manual override is enabled.
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <label className="text-sm font-medium text-gray-700">Global Tariff %</label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  step="0.01"
                  value={globalTariffPercent}
                  onChange={(e) => setGlobalTariffPercent(e.target.value)}
                  className="w-20 rounded-md border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleSaveTariff}
                  disabled={savingTariff}
                  className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingTariff ? 'Saving...' : 'Save Tariff'}
                </button>
              </div>
              <label className="mt-3 inline-flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={keepSellPricesOnTariffChange}
                  onChange={(e) => setKeepSellPricesOnTariffChange(e.target.checked)}
                  className="h-4 w-4"
                />
                Keep all existing sell prices the same (recalculate margin instead)
              </label>
              <p className="mt-2 text-xs text-gray-500">
                Enter <strong>25</strong> for 25%, or <strong>1.25</strong> for a 1.25x tariff multiplier.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow mb-6 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Defaults</h2>
              <p className="text-sm text-gray-500">
                Configure default goals, commission settings, and automation rules.
              </p>
              <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                Defaults configuration is coming soon.
              </div>
            </div>

            <div className="bg-white rounded-lg shadow mb-6 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">App</h2>
              <div className="space-y-3">
                <Link
                  href="/eula"
                  className="block text-blue-600 hover:text-blue-700 text-sm"
                >
                  End User License Agreement
                </Link>
                <Link
                  href="/privacy"
                  className="block text-blue-600 hover:text-blue-700 text-sm"
                >
                  Privacy Policy
                </Link>
              </div>
            </div>
          </>
        )}

        {activeTab === 'billing' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Billing</h2>
            <p className="text-sm text-gray-500">
              Manage invoices, subscriptions, and payment methods.
            </p>
            <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              Billing settings are coming soon.
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {confirmationStep === 1 ? 'Confirm Price Change' : 'Are You Sure?'}
              </h3>
              <p className="text-gray-600 mb-6">
                {confirmationStep === 1 
                  ? 'This will sync prices from your price list to Shopify.'
                  : 'This will update prices on your live Shopify store. This action cannot be undone.'}
              </p>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCancelSync}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSync}
                  disabled={syncing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {syncing ? 'Syncing...' : confirmationStep === 1 ? 'Continue' : 'Yes, Sync Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
