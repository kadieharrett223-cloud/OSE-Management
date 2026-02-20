"use client";

import { useState, useCallback } from "react";
import { Upload, X, FileText, CheckCircle, AlertCircle } from "lucide-react";

interface ChineseInvoiceUploaderProps {
  poId: string;
  onUploadComplete?: (invoice: any) => void;
}

interface UploadState {
  status: "idle" | "uploading" | "success" | "error";
  message?: string;
  progress?: number;
}

export function ChineseInvoiceUploader({
  poId,
  onUploadComplete,
}: ChineseInvoiceUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [formData, setFormData] = useState({
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    factoryName: "",
    totalAmount: "",
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!formData.invoiceNumber) {
      setUploadState({
        status: "error",
        message: "Invoice number is required",
      });
      return;
    }

    setUploadState({ status: "uploading", progress: 0 });

    try {
      const data = new FormData();
      data.append("file", file);
      data.append("poId", poId);
      data.append("invoiceNumber", formData.invoiceNumber);
      data.append("invoiceDate", formData.invoiceDate);
      data.append("factoryName", formData.factoryName);
      data.append("totalAmount", formData.totalAmount);

      const res = await fetch(`/api/purchase-orders/${poId}/chinese-invoices`, {
        method: "POST",
        body: data,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }

      const result = await res.json();
      setUploadState({
        status: "success",
        message: "Invoice uploaded successfully",
      });
      
      onUploadComplete?.(result.data);
      
      // Reset form after 2 seconds
      setTimeout(() => {
        setFormData({
          invoiceNumber: "",
          invoiceDate: new Date().toISOString().split("T")[0],
          factoryName: "",
          totalAmount: "",
        });
        setUploadState({ status: "idle" });
      }, 2000);
    } catch (error: any) {
      setUploadState({
        status: "error",
        message: error.message || "Upload failed",
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Upload Chinese Invoice</h3>

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Invoice Number *
          </label>
          <input
            type="text"
            value={formData.invoiceNumber}
            onChange={(e) =>
              setFormData({ ...formData, invoiceNumber: e.target.value })
            }
            placeholder="e.g., INV-2026-001"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={uploadState.status === "uploading"}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Invoice Date
          </label>
          <input
            type="date"
            value={formData.invoiceDate}
            onChange={(e) =>
              setFormData({ ...formData, invoiceDate: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={uploadState.status === "uploading"}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Factory Name
          </label>
          <input
            type="text"
            value={formData.factoryName}
            onChange={(e) =>
              setFormData({ ...formData, factoryName: e.target.value })
            }
            placeholder="e.g., ABC Factory Ltd."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={uploadState.status === "uploading"}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total Amount (CNY)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.totalAmount}
            onChange={(e) =>
              setFormData({ ...formData, totalAmount: e.target.value })
            }
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={uploadState.status === "uploading"}
          />
        </div>
      </div>

      {/* Drag and Drop Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50"
        } ${uploadState.status === "uploading" ? "pointer-events-none opacity-50" : ""}`}
      >
        <input
          type="file"
          onChange={handleFileInput}
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploadState.status === "uploading"}
        />

        <div className="flex flex-col items-center justify-center gap-2">
          <Upload className="w-8 h-8 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-700">
              Drag and drop your file here
            </p>
            <p className="text-xs text-gray-500">
              or click to select (PDF, PNG, JPG, WEBP)
            </p>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {uploadState.status === "uploading" && (
        <div className="mt-4 flex items-center gap-2 text-blue-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
          <span className="text-sm">Uploading...</span>
        </div>
      )}

      {uploadState.status === "success" && (
        <div className="mt-4 flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-md">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{uploadState.message}</span>
        </div>
      )}

      {uploadState.status === "error" && (
        <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{uploadState.message}</span>
        </div>
      )}
    </div>
  );
}
