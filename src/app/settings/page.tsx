'use client';

export const dynamic = "force-dynamic";

import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const router = useRouter();
  const [qboConnected, setQboConnected] = useState(false);
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [shopifyShop, setShopifyShop] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [shopInput, setShopInput] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState(1);
  const [confirmText, setConfirmText] = useState('');
  const [pricePreview, setPricePreview] = useState<any[]>([]);

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
    try {
      setError(null);
      // Clear QBO tokens (you may need to add an endpoint for this)
      // For now, just clear and ask user to sign in again
      alert('QuickBooks connection cleared. You will need to reconnect when ready.');
      setQboConnected(false);
    } catch (err) {
      setError('Failed to disconnect QuickBooks');
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

  const handleSyncPrices = async () => {
    try {
      setError(null);
      setSuccess(null);
      setSyncing(true);

      // First, get preview of what will change
      const previewRes = await fetch('/api/shopify/sync?preview=true');
      const previewData = await previewRes.json();

      if (!previewRes.ok) {
        throw new Error(previewData.error || 'Failed to preview sync');
      }

      setPricePreview(previewData.preview || []);
      setShowConfirmModal(true);
      setConfirmationStep(1);
      setConfirmText('');
    } catch (err: any) {
      setError(err.message || 'Failed to preview sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleConfirmSync = async () => {
    if (confirmationStep === 1) {
      // Move to step 2 - require typing confirmation
      setConfirmationStep(2);
      return;
    }

    if (confirmationStep === 2 && confirmText !== 'SYNC PRICES') {
      setError('You must type "SYNC PRICES" to confirm');
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
      setConfirmText('');
    }
  };

  const handleCancelSync = () => {
    setShowConfirmModal(false);
    setConfirmationStep(1);
    setConfirmText('');
    setPricePreview([]);
  };

  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: '/' });
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
        <div className="max-w-4xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Manage your account and app preferences</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
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

        {/* Account Section */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Account</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-gray-900">{process.env.ADMIN_EMAIL || 'admin@local'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <p className="mt-1 text-gray-900 capitalize">admin</p>
            </div>
          </div>
        </div>

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
                  <button
                    onClick={handleSyncPrices}
                    disabled={syncing}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncing ? 'Syncing...' : 'Sync Prices'}
                  </button>
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
                  <strong>Note:</strong> Prices will sync from your price list to Shopify based on matching SKUs.
                  Make sure your Shopify product variants have SKUs that match your price list item numbers.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Section */}
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

        {/* Logout Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Session</h2>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900">
                {confirmationStep === 1 ? '⚠️ Confirm Price Sync' : '🔒 Final Confirmation Required'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {confirmationStep === 1 
                  ? 'Review the prices that will be changed on Shopify'
                  : 'Type the confirmation text to proceed with price sync'}
              </p>
            </div>

            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {confirmationStep === 1 ? (
                <div>
                  <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 font-semibold">
                      ⚠️ Warning: This will update prices on your live Shopify store
                    </p>
                    <p className="text-yellow-700 text-sm mt-1">
                      {pricePreview.length} product{pricePreview.length !== 1 ? 's' : ''} will be updated
                    </p>
                  </div>

                  {pricePreview.length > 0 ? (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Price</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Price</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sale Price</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {pricePreview.map((item: any, idx: number) => (
                            <tr key={idx}>
                              <td className="px-4 py-3 text-sm text-gray-900">{item.item_no}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">${item.current_price}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-green-600">${item.new_price}</td>
                              <td className="px-4 py-3 text-sm text-blue-600">
                                {item.sale_price > 0 ? `$${item.sale_price}` : 'None'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No price changes to preview</p>
                  )}
                </div>
              ) : (
                <div>
                  <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                    <p className="text-red-900 font-bold text-lg">⚠️ FINAL WARNING</p>
                    <p className="text-red-800 mt-2">
                      You are about to change prices on your live Shopify store. This action cannot be undone automatically.
                    </p>
                    <p className="text-red-700 mt-2 text-sm">
                      {pricePreview.length} product prices will be updated immediately.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type <span className="font-mono font-bold text-red-600">SYNC PRICES</span> to confirm:
                    </label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="SYNC PRICES"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono"
                      autoFocus
                    />
                    {confirmText && confirmText !== 'SYNC PRICES' && (
                      <p className="mt-2 text-sm text-red-600">Text must match exactly</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={handleCancelSync}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium"
              >
                Cancel
              </button>
              {confirmationStep === 1 ? (
                <button
                  onClick={handleConfirmSync}
                  disabled={pricePreview.length === 0}
                  className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue to Confirmation →
                </button>
              ) : (
                <button
                  onClick={handleConfirmSync}
                  disabled={confirmText !== 'SYNC PRICES' || syncing}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncing ? 'Syncing...' : 'Sync Prices Now'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
