'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [qboConnected, setQboConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkQboStatus = async () => {
      try {
        const res = await fetch('/api/qbo/refresh', { method: 'POST' });
        setQboConnected(res.ok);
      } catch {
        setQboConnected(false);
      } finally {
        setLoading(false);
      }
    };

    if (status === 'authenticated') {
      checkQboStatus();
    }
  }, [status]);

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

  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: '/' });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (status !== 'authenticated' || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">Please log in to access settings.</p>
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

        {/* Account Section */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Account</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-gray-900">{session.user?.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <p className="mt-1 text-gray-900 capitalize">{session.user?.role || 'N/A'}</p>
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
    </div>
  );
}
