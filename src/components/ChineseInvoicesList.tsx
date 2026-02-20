"use client";

import { useEffect, useState } from "react";
import { FileText, Download, Trash2 } from "lucide-react";
import { getServerSupabaseClient } from "@/lib/supabase";

interface ChineseInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  factory_name: string;
  total_amount: number;
  currency: string;
  payment_status: string;
  file_name: string;
  file_size: number;
  created_at: string;
  invoice_file_path: string;
}

interface ChineseInvoicesListProps {
  poId: string;
  refreshTrigger?: number;
}

export function ChineseInvoicesList({
  poId,
  refreshTrigger = 0,
}: ChineseInvoicesListProps) {
  const [invoices, setInvoices] = useState<ChineseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, [poId, refreshTrigger]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/purchase-orders/${poId}/chinese-invoices`);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      const data = await res.json();
      setInvoices(data.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const supabase = getServerSupabaseClient();
      const { data, error } = await supabase.storage
        .from("chinese-invoices")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;

    try {
      const res = await fetch(
        `/api/purchase-orders/${poId}/chinese-invoices/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) throw new Error("Failed to delete invoice");
      setInvoices(invoices.filter((inv) => inv.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
        <span className="ml-2 text-sm text-gray-600">Loading invoices...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
        Error: {error}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-md text-gray-600 text-sm text-center">
        No invoices uploaded yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">
        Uploaded Invoices ({invoices.length})
      </h4>
      {invoices.map((invoice) => (
        <div
          key={invoice.id}
          className="flex items-start justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <FileText className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {invoice.invoice_number}
              </p>
              <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                <p>
                  {invoice.factory_name && `Factory: ${invoice.factory_name}`}
                </p>
                <p>
                  Date: {new Date(invoice.invoice_date).toLocaleDateString()}
                </p>
                {invoice.total_amount && (
                  <p>
                    Amount: ¥{invoice.total_amount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  {invoice.file_name}{" "}
                  {invoice.file_size &&
                    `(${(invoice.file_size / 1024).toFixed(1)} KB)`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            <span
              className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                invoice.payment_status === "RECEIVED"
                  ? "bg-blue-100 text-blue-700"
                  : invoice.payment_status === "PAID"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {invoice.payment_status}
            </span>

            <button
              onClick={() =>
                downloadFile(invoice.invoice_file_path, invoice.file_name)
              }
              className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => deleteInvoice(invoice.id)}
              className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
