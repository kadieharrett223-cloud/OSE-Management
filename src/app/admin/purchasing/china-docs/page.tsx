"use client";

import { useEffect, useState } from "react";
import { FileText, Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import dynamic from "next/dynamic";

// Dynamically import react-pdf to avoid SSR issues
const Document = dynamic(
  () => import("react-pdf").then((mod) => mod.Document),
  { ssr: false }
);
const Page = dynamic(
  () => import("react-pdf").then((mod) => mod.Page),
  { ssr: false }
);

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_name: string;
  order_date: string;
  status: string;
  total_amount: number;
  generated_pdf_path: string | null;
  lines: any[];
}

interface ChineseFile {
  id: string;
  file_name: string;
  file_size: number;
  file_uploaded_at: string;
  upload_notes: string | null;
  file_path: string;
}

// Component for thumbnail preview on card
const PDFThumbnail = ({ 
  pdfUrl, 
  poNumber, 
  Document, 
  Page 
}: { 
  pdfUrl: string | null; 
  poNumber: string;
  Document: any;
  Page: any;
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  if (!pdfUrl) {
    return (
      <div 
        className="w-full h-56 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg flex items-center justify-center relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3" />
          <p className="text-sm text-gray-600 font-medium">Generating PDF...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full h-56 bg-gray-50 rounded-t-lg overflow-hidden relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
        </div>
      )}
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
          <FileText className="w-16 h-16 text-gray-300 mb-2" />
          <p className="text-xs text-gray-400">Preview unavailable</p>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full bg-white">
          <Document
            file={pdfUrl}
            onLoadSuccess={() => setLoading(false)}
            onLoadError={() => {
              setError(true);
              setLoading(false);
            }}
            loading={null}
          >
            <Page
              pageNumber={1}
              width={320}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="shadow-sm"
            />
          </Document>
        </div>
      )}
      
      {/* Hover Overlay - "Click to View" */}
      {isHovered && !loading && !error && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20 transition-all">
          <div className="bg-white px-6 py-3 rounded-lg shadow-lg">
            <p className="text-sm font-semibold text-gray-900">Click to View</p>
          </div>
        </div>
      )}
      
      {/* PO Number Badge */}
      <div className="absolute top-3 left-3 bg-blue-600 text-white px-3 py-1 rounded-md shadow-lg z-10">
        <p className="text-xs font-bold">PO #{poNumber}</p>
      </div>
    </div>
  );
};

export default function ChinaDocs() {
  const [chinesePOs, setChinesePOs] = useState<PurchaseOrder[]>([]);
  const [poFiles, setPoFiles] = useState<Record<string, ChineseFile[]>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [pdfWorkerReady, setPdfWorkerReady] = useState(false);
  
  // PDF Viewer state
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  const [currentPdfName, setCurrentPdfName] = useState<string>("");
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"generated" | "uploads">("generated");
  const [scrollMode, setScrollMode] = useState(true); // true = scroll all pages, false = single page

  // Set up PDF.js worker on client side only
  useEffect(() => {
    const setupPdfWorker = async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
      setPdfWorkerReady(true);
    };
    setupPdfWorker();
  }, []);

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

      // Fetch files for each PO and auto-generate PDFs if missing
      for (const po of data.data || []) {
        fetchPOFiles(po.id);
        
        // Auto-generate PDF if missing
        if (!po.generated_pdf_path) {
          generatePDFInBackground(po.id);
        }
      }
    } catch (error) {
      console.error("Error fetching Chinese POs:", error);
    } finally {
      setLoading(false);
    }
  };

  const generatePDFInBackground = async (poId: string) => {
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/generate-pdf`, {
        method: "POST",
      });
      
      if (res.ok) {
        const result = await res.json();
        // Update the PO in state with the new PDF path
        setChinesePOs((prev) =>
          prev.map((po) =>
            po.id === poId
              ? { ...po, generated_pdf_path: result.data.path }
              : po
          )
        );
      }
    } catch (error) {
      console.error("Background PDF generation error:", error);
      // Silently fail - user won't see errors, PDF will show "generating" state
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

  const openPOViewer = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setActiveTab("generated");
    setPageNumber(1);
    
    if (po.generated_pdf_path) {
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generated-po-pdfs/${po.generated_pdf_path}`;
      setCurrentPdfUrl(publicUrl);
      setCurrentPdfName(`PO-${po.po_number}.pdf`);
    } else {
      setCurrentPdfUrl(null);
      setCurrentPdfName("");
    }
  };

  const closeViewer = () => {
    setSelectedPO(null);
    setCurrentPdfUrl(null);
    setCurrentPdfName("");
    setNumPages(0);
    setPageNumber(1);
  };

  const switchToUploadedDoc = (file: ChineseFile) => {
    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/chinese-po-files/${file.file_path}`;
    setCurrentPdfUrl(publicUrl);
    setCurrentPdfName(file.file_name);
    setActiveTab("uploads");
    setPageNumber(1);
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const filteredPOs = chinesePOs.filter((po) =>
    filterStatus === "all" ? true : po.status === filterStatus
  );

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar activePage="Purchasing" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Loading Chinese POs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activePage="Purchasing" />
      <div className="flex-1 overflow-auto">
        <div className="min-h-screen bg-gray-50 p-6">
          {/* Header */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">China Docs</h1>
            <p className="text-gray-600 mb-6">
              View and manage all Chinese supplier purchase orders and documents
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

          {/* PO Gallery */}
          {filteredPOs.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-lg">No Chinese purchase orders found</p>
              <p className="text-gray-400 text-sm mt-1">
                Upload Chinese files to POs to see them here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPOs.map((po) => {
                const pdfUrl = po.generated_pdf_path
                  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generated-po-pdfs/${po.generated_pdf_path}`
                  : null;

                return (
                  <button
                    key={po.id}
                    onClick={() => openPOViewer(po)}
                    className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden hover:shadow-2xl transition-all hover:border-blue-500 hover:scale-[1.02] text-left"
                  >
                    {/* PDF Thumbnail Preview */}
                    {pdfWorkerReady ? (
                      <PDFThumbnail 
                        pdfUrl={pdfUrl} 
                        poNumber={po.po_number}
                        Document={Document}
                        Page={Page}
                      />
                    ) : (
                      <div className="w-full h-56 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3" />
                          <p className="text-sm text-gray-600 font-medium">Loading viewer...</p>
                        </div>
                      </div>
                    )}

                    {/* PO Info */}
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900 mb-1 line-clamp-1">
                            {po.vendor_name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {new Date(po.order_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                            po.status === "PAID"
                              ? "bg-green-100 text-green-700"
                              : po.status === "SHIPPED"
                                ? "bg-blue-100 text-blue-700"
                                : po.status === "SUBMITTED"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {po.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                        <span className="text-2xl font-bold text-gray-900">
                          ${po.total_amount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        {(poFiles[po.id] || []).length > 0 && (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
                            <FileText className="w-3.5 h-3.5" />
                            {(poFiles[po.id] || []).length}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {selectedPO && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  PO #{selectedPO.po_number}
                </h2>
                <p className="text-sm text-gray-600">{selectedPO.vendor_name}</p>
              </div>
              <button
                onClick={closeViewer}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-4">
              <button
                onClick={() => {
                  setActiveTab("generated");
                  if (selectedPO.generated_pdf_path) {
                    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generated-po-pdfs/${selectedPO.generated_pdf_path}`;
                    setCurrentPdfUrl(publicUrl);
                    setCurrentPdfName(`PO-${selectedPO.po_number}.pdf`);
                    setPageNumber(1);
                  }
                }}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "generated"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                Generated PO
              </button>
              <button
                onClick={() => setActiveTab("uploads")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "uploads"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                Uploaded Docs ({(poFiles[selectedPO.id] || []).length})
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              {activeTab === "generated" ? (
                currentPdfUrl ? (
                  <div className="flex flex-col items-center space-y-4">
                    {/* Controls */}
                    <div className="sticky top-0 z-10 bg-white p-3 rounded-lg shadow-md flex items-center gap-4">
                      <span className="text-sm text-gray-700 font-medium">
                        {numPages} page{numPages !== 1 ? "s" : ""}
                      </span>
                      <div className="h-4 w-px bg-gray-300" />
                      <button
                        onClick={() => setScrollMode(!scrollMode)}
                        className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                      >
                        {scrollMode ? "Single Page" : "Scroll All"}
                      </button>
                      <a
                        href={currentPdfUrl}
                        download={currentPdfName}
                        className="ml-auto flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download PDF
                      </a>
                    </div>

                    {/* PDF Display */}
                    {pdfWorkerReady ? (
                      scrollMode ? (
                        <Document
                          file={currentPdfUrl}
                          onLoadSuccess={onDocumentLoadSuccess}
                          className="flex flex-col items-center space-y-3"
                        >
                          {Array.from(new Array(numPages), (el, index) => (
                            <div key={`page_${index + 1}`} className="shadow-lg bg-white">
                              <Page
                                pageNumber={index + 1}
                                width={Math.min(900, window.innerWidth - 100)}
                                renderTextLayer={true}
                                renderAnnotationLayer={true}
                              />
                            </div>
                          ))}
                        </Document>
                      ) : (
                        <div className="flex flex-col items-center">
                          <div className="mb-4 flex items-center gap-3">
                            <button
                              onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                              disabled={pageNumber <= 1}
                              className="p-2 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300 transition-colors"
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="text-sm text-gray-700 px-4">
                              Page {pageNumber} of {numPages}
                            </span>
                            <button
                              onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                              disabled={pageNumber >= numPages}
                              className="p-2 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300 transition-colors"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </div>
                          <Document
                            file={currentPdfUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            className="shadow-lg bg-white"
                          >
                            <Page
                              pageNumber={pageNumber}
                              width={Math.min(900, window.innerWidth - 100)}
                              renderTextLayer={true}
                              renderAnnotationLayer={true}
                            />
                          </Document>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        <span className="ml-3 text-gray-600">Loading PDF viewer...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">No PDF generated yet</p>
                    <p className="text-gray-500 text-sm mt-2">
                      PDF will be auto-generated when files are uploaded
                    </p>
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  {(poFiles[selectedPO.id] || []).length === 0 ? (
                    <div className="text-center py-16">
                      <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 text-lg">No uploaded documents</p>
                    </div>
                  ) : (
                    (poFiles[selectedPO.id] || []).map((file) => (
                      <button
                        key={file.id}
                        onClick={() => switchToUploadedDoc(file)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-400 transition-colors text-left"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{file.file_name}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {(file.file_size / 1024).toFixed(1)} KB •{" "}
                            {new Date(file.file_uploaded_at).toLocaleDateString()}
                          </p>
                          {file.upload_notes && (
                            <p className="text-xs text-gray-600 mt-1 italic">
                              {file.upload_notes}
                            </p>
                          )}
                        </div>
                        <FileText className="w-5 h-5 text-blue-600" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
