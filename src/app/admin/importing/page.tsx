"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";

export default function ImportPOsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError("Please select a file");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/import/purchase-orders", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
        return;
      }

      setResult(data);
      setFile(null);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="flex min-h-screen">
        <Sidebar activePage="Purchasing" />

        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 p-8">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Import Purchase Orders</h1>
            <p className="text-slate-600 mb-8">
              Upload a CSV file with your closed purchase orders. The file should have columns:
              po_number, vendor_name, order_date, total_amount
            </p>

            <div className="bg-white rounded-lg shadow-lg p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* File Upload */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-3">
                    Select CSV File
                  </label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-500 transition">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-input"
                    />
                    <label htmlFor="file-input" className="cursor-pointer">
                      {file ? (
                        <div className="text-sm text-slate-700">
                          <p className="font-semibold">{file.name}</p>
                          <p className="text-slate-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">
                          <p className="font-semibold text-slate-900">Click to upload</p>
                          <p>or drag and drop CSV file</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* CSV Format Help */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-2">CSV Format Example:</p>
                  <code className="text-xs text-blue-800 block bg-white p-2 rounded border border-blue-100 overflow-x-auto">
                    po_number,vendor_name,order_date,total_amount,notes
                    <br />
                    PO-001,ABC Supplier,2025-01-01,5000.00,Received
                    <br />
                    PO-002,XYZ Vendor,2025-01-02,3500.50,
                  </code>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!file || loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3 rounded-lg transition"
                >
                  {loading ? "Importing..." : "Import Purchase Orders"}
                </button>
              </form>

              {/* Results */}
              {result && (
                <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="font-semibold text-green-900 mb-2">✅ Import Successful!</h3>
                  <div className="text-sm text-green-800 space-y-1">
                    <p>
                      <strong>Imported:</strong> {result.imported} POs
                    </p>
                    {result.duplicates > 0 && (
                      <p>
                        <strong>Duplicates Skipped:</strong> {result.duplicates}
                      </p>
                    )}
                    <p>
                      <strong>Total Processed:</strong> {result.total}
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h3 className="font-semibold text-red-900 mb-2">❌ Error</h3>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
