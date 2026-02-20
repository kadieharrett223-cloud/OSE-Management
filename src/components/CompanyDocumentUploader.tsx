"use client";

import { useState } from "react";
import { Upload, AlertCircle, CheckCircle } from "lucide-react";

interface CompanyDocumentUploaderProps {
  onUploadComplete?: (file: any) => void;
}

interface UploadState {
  status: "idle" | "uploading" | "success" | "error";
  message?: string;
}

export function CompanyDocumentUploader({ onUploadComplete }: CompanyDocumentUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [uploadNotes, setUploadNotes] = useState("");

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
    setUploadState({ status: "uploading" });

    try {
      const data = new FormData();
      data.append("file", file);
      data.append("uploadNotes", uploadNotes);

      const res = await fetch("/api/company-docs", {
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
        message: "Document uploaded successfully",
      });

      onUploadComplete?.(result.data);

      setTimeout(() => {
        setUploadNotes("");
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
    <div className="w-full p-4 bg-gray-50 rounded-lg border border-gray-200">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">Upload Company Document</h4>

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"
        } ${uploadState.status === "uploading" ? "pointer-events-none opacity-50" : ""}`}
      >
        <input
          type="file"
          onChange={handleFileInput}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploadState.status === "uploading"}
        />

        <div className="flex flex-col items-center justify-center gap-2">
          <Upload className="w-6 h-6 text-gray-400" />
          <div>
            <p className="text-xs font-medium text-gray-700">Drop a file here or click to browse</p>
            <p className="text-xs text-gray-500">PDF, Word, Excel, Images supported</p>
          </div>
        </div>
      </div>

      <textarea
        value={uploadNotes}
        onChange={(e) => setUploadNotes(e.target.value)}
        placeholder="Add notes (optional)..."
        className="w-full mt-3 px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        rows={2}
        disabled={uploadState.status === "uploading"}
      />

      {uploadState.status === "uploading" && (
        <div className="mt-3 flex items-center gap-2 text-blue-600">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" />
          <span className="text-xs">Uploading...</span>
        </div>
      )}

      {uploadState.status === "success" && (
        <div className="mt-3 flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded-md">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-medium">{uploadState.message}</span>
        </div>
      )}

      {uploadState.status === "error" && (
        <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded-md">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-medium">{uploadState.message}</span>
        </div>
      )}
    </div>
  );
}
