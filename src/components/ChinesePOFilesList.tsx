"use client";

import { useEffect, useState } from "react";
import { FileText, Download, Trash2, MessageSquare } from "lucide-react";

interface ChinesePOFile {
  id: string;
  file_name: string;
  file_size: number;
  file_uploaded_at: string;
  upload_notes: string | null;
  file_path: string;
}

interface ChinesePOFilesListProps {
  poId: string;
  refreshTrigger?: number;
}

export function ChinesePOFilesList({
  poId,
  refreshTrigger = 0,
}: ChinesePOFilesListProps) {
  const [files, setFiles] = useState<ChinesePOFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [poId, refreshTrigger]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/purchase-orders/${poId}/chinese-po-files`);
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();
      setFiles(data.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      // For now, direct browser download from Supabase URL
      // This requires public URL generation via API or storage access
      const res = await fetch(
        `/api/purchase-orders/${poId}/chinese-po-files/download?path=${encodeURIComponent(filePath)}`
      );
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
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

  const deleteFile = async (id: string) => {
    if (!confirm("Delete this PO file?")) return;

    try {
      const res = await fetch(
        `/api/purchase-orders/${poId}/chinese-po-files/${id}`,
        { method: "DELETE" }
      );

      if (!res.ok) throw new Error("Failed to delete");
      setFiles(files.filter((f) => f.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-3">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
        <span className="ml-2 text-xs text-gray-600">Loading files...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs">
        Error: {error}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-gray-600 text-xs text-center">
        No PO files uploaded yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-700">
        Uploaded Files ({files.length})
      </p>
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-start justify-between p-2 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <FileText className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">
                {file.file_name}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {file.file_size &&
                  `${(file.file_size / 1024).toFixed(1)} KB • `}
                {new Date(file.file_uploaded_at).toLocaleDateString()}
              </p>
              {file.upload_notes && (
                <p className="text-xs text-gray-600 mt-1 flex items-start gap-1">
                  <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span className="italic">{file.upload_notes}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            <button
              onClick={() =>
                downloadFile(file.file_path, file.file_name)
              }
              className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Download"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => deleteFile(file.id)}
              className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
