"use client";

import { useState } from "react";
import { ChinesePOFileUploader } from "./ChinesePOFileUploader";
import { ChinesePOFilesList } from "./ChinesePOFilesList";
import { FileText } from "lucide-react";

interface ChinesePOFilesProps {
  poId: string;
  poNumber: string;
}

export function ChinesePOFiles({ poId, poNumber }: ChinesePOFilesProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="w-5 h-5 text-amber-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Chinese PO Files (PO #{poNumber})
        </h3>
      </div>

      <div className="space-y-4">
        {/* Upload Form */}
        <ChinesePOFileUploader
          poId={poId}
          onUploadComplete={handleUploadComplete}
        />

        {/* Files List */}
        <div className="border-t pt-4">
          <ChinesePOFilesList
            poId={poId}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </div>
    </div>
  );
}
