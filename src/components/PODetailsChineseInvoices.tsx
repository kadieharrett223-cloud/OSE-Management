"use client";

import { useState } from "react";
import { ChineseInvoiceUploader } from "./ChineseInvoiceUploader";
import { ChineseInvoicesList } from "./ChineseInvoicesList";
import { FileText, Edit2, Save, X } from "lucide-react";

interface PODetailsChineseInvoicesProps {
  poId: string;
  poNumber: string;
  currentInternalNotes?: string;
  onInternalNotesUpdate?: (notes: string) => void;
}

export function PODetailsChineseInvoices({
  poId,
  poNumber,
  currentInternalNotes = "",
  onInternalNotesUpdate,
}: PODetailsChineseInvoicesProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [editingNotes, setEditingNotes] = useState(false);
  const [internalNotes, setInternalNotes] = useState(currentInternalNotes);
  const [savingNotes, setSavingNotes] = useState(false);

  const handleUploadComplete = () => {
    // Trigger refresh of invoice list
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSaveNotes = async () => {
    try {
      setSavingNotes(true);
      const res = await fetch(`/api/purchase-orders/${poId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internal_notes: internalNotes }),
      });

      if (!res.ok) throw new Error("Failed to save notes");
      onInternalNotesUpdate?.(internalNotes);
      setEditingNotes(false);
    } catch (err: any) {
      alert(`Failed to save notes: ${err.message}`);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Internal Notes Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Internal Notes</h3>
          {!editingNotes && (
            <button
              onClick={() => setEditingNotes(true)}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit notes"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {editingNotes ? (
          <div className="space-y-3">
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Add internal notes about this PO..."
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={savingNotes}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setInternalNotes(currentInternalNotes);
                  setEditingNotes(false);
                }}
                className="px-3 py-1 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors text-sm font-medium"
                disabled={savingNotes}
              >
                <X className="w-4 h-4 inline mr-1" />
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                className="px-3 py-1 text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors text-sm font-medium"
                disabled={savingNotes}
              >
                <Save className="w-4 h-4 inline mr-1" />
                {savingNotes ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-700 whitespace-pre-wrap">
            {internalNotes || (
              <span className="text-gray-400 italic">No notes added yet</span>
            )}
          </p>
        )}
      </div>

      {/* Chinese Invoices Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Chinese Invoices (PO #{poNumber})
          </h3>
        </div>

        <div className="space-y-6">
          {/* Upload Form */}
          <ChineseInvoiceUploader
            poId={poId}
            onUploadComplete={handleUploadComplete}
          />

          {/* Invoices List */}
          <div className="border-t pt-6">
            <ChineseInvoicesList
              poId={poId}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
