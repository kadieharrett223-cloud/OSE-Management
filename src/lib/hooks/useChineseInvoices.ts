import { useState, useCallback, useEffect } from 'react';
import { ChineseInvoice, UpdateChineseInvoiceInput } from '@/types/chinese-invoices';

interface UseChineseInvoicesOptions {
  poId?: string;
  autoFetch?: boolean;
}

interface UseChineseInvoicesReturn {
  invoices: ChineseInvoice[];
  loading: boolean;
  error: string | null;
  fetchInvoices: () => Promise<void>;
  uploadInvoice: (
    file: File,
    invoiceNumber: string,
    invoiceDate?: string,
    factoryName?: string,
    totalAmount?: number
  ) => Promise<ChineseInvoice | null>;
  updateInvoice: (invoiceId: string, updates: UpdateChineseInvoiceInput) => Promise<void>;
  deleteInvoice: (invoiceId: string) => Promise<void>;
  downloadFile: (filePath: string, fileName: string) => Promise<void>;
}

export function useChineseInvoices(
  options: UseChineseInvoicesOptions = {}
): UseChineseInvoicesReturn {
  const { poId, autoFetch = true } = options;
  const [invoices, setInvoices] = useState<ChineseInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!poId) {
      setError('PO ID is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/purchase-orders/${poId}/chinese-invoices`);
      if (!res.ok) throw new Error('Failed to fetch invoices');
      const data = await res.json();
      setInvoices(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => {
    if (autoFetch && poId) {
      fetchInvoices();
    }
  }, [poId, autoFetch, fetchInvoices]);

  const uploadInvoice = useCallback(
    async (
      file: File,
      invoiceNumber: string,
      invoiceDate?: string,
      factoryName?: string,
      totalAmount?: number
    ): Promise<ChineseInvoice | null> => {
      if (!poId) {
        setError('PO ID is required');
        return null;
      }

      try {
        setError(null);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('poId', poId);
        formData.append('invoiceNumber', invoiceNumber);
        if (invoiceDate) formData.append('invoiceDate', invoiceDate);
        if (factoryName) formData.append('factoryName', factoryName);
        if (totalAmount) formData.append('totalAmount', totalAmount.toString());

        const res = await fetch(`/api/purchase-orders/${poId}/chinese-invoices`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Upload failed');
        }

        const result = await res.json();
        setInvoices((prev) => [result.data, ...prev]);
        return result.data;
      } catch (err: any) {
        setError(err.message);
        return null;
      }
    },
    [poId]
  );

  const updateInvoice = useCallback(
    async (invoiceId: string, updates: UpdateChineseInvoiceInput) => {
      if (!poId) {
        setError('PO ID is required');
        return;
      }

      try {
        setError(null);
        const res = await fetch(
          `/api/purchase-orders/${poId}/chinese-invoices/${invoiceId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          }
        );

        if (!res.ok) throw new Error('Failed to update invoice');

        // Refetch invoices to get latest
        await fetchInvoices();
      } catch (err: any) {
        setError(err.message);
      }
    },
    [poId, fetchInvoices]
  );

  const deleteInvoice = useCallback(
    async (invoiceId: string) => {
      if (!poId) {
        setError('PO ID is required');
        return;
      }

      try {
        setError(null);
        const res = await fetch(
          `/api/purchase-orders/${poId}/chinese-invoices/${invoiceId}`,
          { method: 'DELETE' }
        );

        if (!res.ok) throw new Error('Failed to delete invoice');

        setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
      } catch (err: any) {
        setError(err.message);
      }
    },
    [poId]
  );

  const downloadFile = useCallback(async (filePath: string, fileName: string) => {
    try {
      setError(null);
      // Note: This requires client-side Supabase initialization
      // If using server-side only, you'll need a download API endpoint
      const response = await fetch(
        `/api/purchase-orders/download?path=${encodeURIComponent(filePath)}`
      );
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  return {
    invoices,
    loading,
    error,
    fetchInvoices,
    uploadInvoice,
    updateInvoice,
    deleteInvoice,
    downloadFile,
  };
}
