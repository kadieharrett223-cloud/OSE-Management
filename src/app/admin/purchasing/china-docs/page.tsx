"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Printer, Download, FileText } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_name: string;
  order_date: string;
  status: string;
  total_amount: number;
  lines: Array<{
    sku?: string;
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
}

interface ChineseFile {
  id: string;
  file_name: string;
  file_size: number;
  file_uploaded_at: string;
  upload_notes: string | null;
  file_path: string;
}

export default function ChinaDocs() {
  const [chinesePOs, setChinesePOs] = useState<PurchaseOrder[]>([]);
  const [poFiles, setPoFiles] = useState<Record<string, ChineseFile[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedPOs, setExpandedPOs] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    fetchChinesePOs();
  }, []);

  const fetchChinesePOs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/purchase-orders?china=true");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setChinesePOs(data.data || []);

      // Fetch files for each PO
      for (const po of data.data || []) {
        fetchPOFiles(po.id);
      }
    } catch (error) {
      console.error("Error fetching Chinese POs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPOFiles = async (poId: string) => {
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/chinese-po-files`);
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();
      setPoFiles((prev) => ({
        ...prev,
        [poId]: data.data || [],
      }));
    } catch (error) {
      console.error("Error fetching files for PO:", error);
    }
  };

  const togglePO = (poId: string) => {
    setExpandedPOs((prev) =>
      prev.includes(poId) ? prev.filter((id) => id !== poId) : [...prev, poId]
    );
  };

  const handlePrint = (po: PurchaseOrder) => {
    const printContent = generatePOHTML(po);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    }
  };

  const generatePOHTML = (po: PurchaseOrder) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>PO #${po.po_number}</title>
        <style>
          * { margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { margin-bottom: 20px; }
          h1 { font-size: 24px; margin-bottom: 10px; }
          .po-info { margin-bottom: 15px; }
          .po-info p { margin: 5px 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .total { font-weight: bold; font-size: 16px; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PURCHASE ORDER</h1>
          <div class="po-info">
            <p><strong>PO #:</strong> ${po.po_number}</p>
            <p><strong>Supplier:</strong> ${po.vendor_name}</p>
            <p><strong>Order Date:</strong> ${new Date(po.order_date).toLocaleDateString()}</p>
            <p><strong>Status:</strong> ${po.status}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${po.lines
              .map(
                (line) => `
              <tr>
                <td>${line.sku || "—"}</td>
                <td>${line.description}</td>
                <td>${line.quantity}</td>
                <td>$${line.unit_price.toFixed(2)}</td>
                <td>$${line.line_total.toFixed(2)}</td>
              </tr>
            `
              )
              .join("")}
            <tr>
              <td colspan="4" style="text-align: right;"><strong>TOTAL:</strong></td>
              <td class="total">$${po.total_amount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <p>Printed on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;
  };

  const filteredPOs = chinesePOs.filter((po) =>
    filterStatus === "all" ? true : po.status === filterStatus
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-600">Loading Chinese POs...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activePage="Purchasing" />
      <div className="flex-1 overflow-auto">
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-6xl mx-auto p-6">
            {/* Header Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">China Docs</h1>
          <p className="text-gray-600 mb-6">
            Manage and organize all Chinese supplier purchase orders and documents
          </p>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap items-center">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-white"
            >
              <option value="all">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="RECEIVED">Received</option>
              <option value="PAID">Paid</option>
              <option value="SHIPPED">Shipped</option>
            </select>
            <span className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium text-sm">
              {filteredPOs.length} Chinese PO{filteredPOs.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* POs List */}
        {filteredPOs.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-lg">No Chinese purchase orders found</p>
            <p className="text-gray-400 text-sm mt-1">Mark POs as "China supplier" to see them here</p>
          </div>
        ) : (
          <div className="space-y-4">
          {filteredPOs.map((po) => (
            <div
              key={po.id}
              className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              {/* PO Header - Clickable */}
              <button
                onClick={() => togglePO(po.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      PO #{po.po_number}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        po.status === "PAID"
                          ? "bg-green-100 text-green-800"
                          : po.status === "SHIPPED"
                            ? "bg-blue-100 text-blue-800"
                            : po.status === "SUBMITTED"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {po.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {po.vendor_name} • {new Date(po.order_date).toLocaleDateString()} • $
                    {po.total_amount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {expandedPOs.includes(po.id) ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              {expandedPOs.includes(po.id) && (
                <div className="border-t border-gray-200 bg-white p-6 space-y-6">
                  {/* Printable PO Section */}
                  <div className="border border-gray-200 rounded-lg p-5 bg-gray-50">
                    <h4 className="font-semibold text-gray-900 text-lg mb-4">
                      Printable PO
                    </h4>
                    <div className="bg-white p-4 rounded border border-gray-200 max-h-72 overflow-y-auto text-xs">
                      <div className="space-y-2 text-gray-700 font-mono">
                        <p>
                          <strong>PO #:</strong> {po.po_number}
                        </p>
                        <p>
                          <strong>Supplier:</strong> {po.vendor_name}
                        </p>
                        <p>
                          <strong>Date:</strong>{" "}
                          {new Date(po.order_date).toLocaleDateString()}
                        </p>
                        <p>
                          <strong>Status:</strong> {po.status}
                        </p>

                        <table className="w-full mt-3 border-collapse text-[11px]">
                          <thead>
                            <tr className="border-b-2 border-gray-300">
                              <th className="text-left p-1">SKU</th>
                              <th className="text-left p-1">Description</th>
                              <th className="text-center p-1 w-16">Qty</th>
                              <th className="text-right p-1 w-20">Unit</th>
                              <th className="text-right p-1 w-20">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {po.lines.map((line, idx) => (
                              <tr
                                key={idx}
                                className="border-b border-gray-200"
                              >
                                <td className="p-1">{line.sku || "—"}</td>
                                <td className="p-1">{line.description}</td>
                                <td className="text-center p-1">
                                  {line.quantity}
                                </td>
                                <td className="text-right p-1">
                                  ${line.unit_price.toFixed(2)}
                                </td>
                                <td className="text-right p-1 font-semibold">
                                  ${line.line_total.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                            <tr className="font-semibold border-t-2 border-gray-300 bg-gray-100">
                              <td colSpan={4} className="text-right p-1">
                                TOTAL:
                              </td>
                              <td className="text-right p-1">
                                ${po.total_amount.toFixed(2)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => handlePrint(po)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                        Print PO
                      </button>
                    </div>
                  </div>

                  {/* Files Section */}
                  <div className="border border-gray-200 rounded-lg p-5 bg-gray-50">
                    <h4 className="font-semibold text-gray-900 text-lg mb-4">
                      Attached Documents ({(poFiles[po.id] || []).length})
                    </h4>

                    {(poFiles[po.id] || []).length === 0 ? (
                      <div className="text-center py-6">
                        <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">
                          No files uploaded yet
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 bg-white rounded border border-gray-200 p-3">
                        {(poFiles[po.id] || []).map((file) => (
                          <div
                            key={file.id}
                            className="flex items-start justify-between p-3 bg-gray-50 rounded border border-gray-100 hover:bg-blue-50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {file.file_name}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {(file.file_size / 1024).toFixed(1)} KB •{" "}
                                {new Date(
                                  file.file_uploaded_at
                                ).toLocaleDateString()}
                              </p>
                              {file.upload_notes && (
                                <p className="text-xs text-gray-600 mt-1 italic">
                                  {file.upload_notes}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                // Handle download
                                const link = document.createElement("a");
                                link.href = `/api/purchase-orders/${po.id}/chinese-po-files/download?path=${encodeURIComponent(file.file_path)}`;
                                link.download = file.file_name;
                                link.click();
                              }}
                              className="ml-3 p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors flex-shrink-0"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
          </div>
        </div>
      </div>
    </div>
  );
}
