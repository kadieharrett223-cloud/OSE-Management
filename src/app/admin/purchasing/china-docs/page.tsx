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
  const [numPages, setNumPages] = useState<number>(0);
  const [currentDocIndex, setCurrentDocIndex] = useState<number>(0);

  // Configure PDF.js worker - must happen client-side only
  useEffect(() => {
    const setupWorker = async () => {
      const { pdfjs } = await import('react-pdf');
      
      // Set worker source
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      
      console.log('🎯 PDF worker configured (client-side):', pdfjs.GlobalWorkerOptions.workerSrc);
      console.log('📦 PDF.js version:', pdfjs.version);
      console.log('⏰ Setup time:', new Date().toISOString());
      
      setPdfWorkerReady(true);
      console.log('✅ PDF viewer ready');
    };
    
    setupWorker();
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
    setCurrentDocIndex(0);
    setNumPages(0);
    console.log('Opening PO viewer for:', po.po_number, 'PDF path:', po.generated_pdf_path);
  };

  const closeViewer = () => {
    setSelectedPO(null);
    setNumPages(0);
    setCurrentDocIndex(0);
  };

  const goToNextDoc = () => {
    if (selectedPO) {
      const totalDocs = 1 + (poFiles[selectedPO.id] || []).length;
      const nextIndex = Math.min(currentDocIndex + 1, totalDocs - 1);
      console.log('Going to next doc:', nextIndex);
      setCurrentDocIndex(nextIndex);
      setNumPages(0);
    }
  };

  const goToPrevDoc = () => {
    const prevIndex = Math.max(currentDocIndex - 1, 0);
    console.log('Going to previous doc:', prevIndex);
    setCurrentDocIndex(prevIndex);
    setNumPages(0);
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

      {/* PDF Viewer Modal - Single Document at a Time */}
      {selectedPO && (() => {
        const allDocs = [
          {
            type: 'generated',
            title: 'Your Generated PO',
            url: selectedPO.generated_pdf_path 
              ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generated-po-pdfs/${selectedPO.generated_pdf_path}`
              : null,
            filename: `PO-${selectedPO.po_number}.pdf`,
            headerColor: 'bg-blue-600',
            icon: '📄',
            notes: null as string | null
          },
          ...(poFiles[selectedPO.id] || []).map((file, idx) => ({
            type: 'chinese',
            title: `Chinese Doc #${idx + 1}: ${file.file_name}`,
            url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/chinese-po-files/${file.file_path}`,
            filename: file.file_name,
            headerColor: 'bg-orange-600',
            icon: '📑',
            notes: file.upload_notes
          }))
        ];

        const currentDoc = allDocs[currentDocIndex];
        const totalDocs = allDocs.length;

        return (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
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

              {/* Navigation Bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <button
                  onClick={goToPrevDoc}
                  disabled={currentDocIndex === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">Previous</span>
                </button>
                
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-900">
                    Document {currentDocIndex + 1} of {totalDocs}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {currentDoc.icon} {currentDoc.title}
                  </p>
                </div>
                
                <button
                  onClick={goToNextDoc}
                  disabled={currentDocIndex === totalDocs - 1}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="text-sm font-medium">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Document Viewer */}
              <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
                {currentDoc.url && pdfWorkerReady ? (
                  <div className="flex flex-col items-center space-y-4">
                    {/* Download Button */}
                    <div className="sticky top-0 z-10 mb-2">
                      <a
                        href={currentDoc.url}
                        download={currentDoc.filename}
                        className={`inline-flex items-center gap-2 px-4 py-2 ${currentDoc.headerColor} text-white rounded-lg hover:opacity-90 shadow-lg transition-opacity`}
                      >
                        <Download className="w-4 h-4" />
                        Download {currentDoc.type === 'generated' ? 'PO' : 'Document'}
                      </a>
                    </div>

                    {/* PDF Pages */}
                    <Document
                      file={currentDoc.url}
                      onLoadSuccess={({ numPages }) => {
                        console.log('PDF loaded successfully:', numPages, 'pages');
                        setNumPages(numPages);
                      }}
                      onLoadError={(error) => {
                        console.error('PDF load error:', error);
                      }}
                      options={{
                        cMapUrl: `https://unpkg.com/pdfjs-dist@5.4.624/cmaps/`,
                        cMapPacked: true,
                        standardFontDataUrl: `https://unpkg.com/pdfjs-dist@5.4.624/standard_fonts/`
                      }}
                      className="flex flex-col items-center space-y-4"
                      loading={
                        <div className="flex items-center justify-center py-16">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                            <p className="text-gray-600">Loading document...</p>
                            <p className="text-xs text-gray-500 mt-2">{currentDoc.url}</p>
                          </div>
                        </div>
                      }
                      error={
                        <div className="flex items-center justify-center py-16">
                          <div className="text-center">
                            <FileText className="w-16 h-16 text-red-300 mx-auto mb-4" />
                            <p className="text-red-600 text-lg font-medium">Failed to load PDF</p>
                            <p className="text-gray-600 text-sm mt-2">The document may not be ready yet</p>
                            <button
                              onClick={() => window.location.reload()}
                              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                              Refresh Page
                            </button>
                          </div>
                        </div>
                      }
                    >
                      {numPages > 0 && Array.from(new Array(numPages), (el, index) => (
                        <div key={`page_${index + 1}`} className="shadow-lg bg-white rounded-sm overflow-hidden">
                          <Page
                            pageNumber={index + 1}
                            width={Math.min(850, window.innerWidth - 150)}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                            loading={
                              <div className="flex items-center justify-center h-96 bg-gray-50">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                              </div>
                            }
                          />
                        </div>
                      ))}
                    </Document>

                    {/* Notes if present */}
                    {currentDoc.notes && (
                      <div className="w-full max-w-[850px] mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                        <p className="text-sm text-gray-800">
                          <span className="font-semibold">Note:</span> {currentDoc.notes}
                        </p>
                      </div>
                    )}
                  </div>
                ) : !pdfWorkerReady ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                      <p className="text-gray-600 text-lg">Initializing PDF viewer...</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                      <p className="text-gray-600 text-lg">Generating PDF...</p>
                      <p className="text-gray-500 text-sm mt-2">This may take a moment</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
