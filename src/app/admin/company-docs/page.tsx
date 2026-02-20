"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Download, Trash2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { CompanyDocumentUploader } from "@/components/CompanyDocumentUploader";

const Document = dynamic(() => import("react-pdf").then((mod) => mod.Document), { ssr: false });
const Page = dynamic(() => import("react-pdf").then((mod) => mod.Page), { ssr: false });

interface CompanyDocument {
  id: string;
  file_name: string;
  file_size: number;
  file_mime_type: string | null;
  file_path: string;
  file_uploaded_at: string;
  upload_notes: string | null;
  signedUrl?: string | null;
  signError?: string | null;
}

const isPdf = (doc: CompanyDocument) => {
  if (doc.file_mime_type?.toLowerCase() === "application/pdf") return true;
  return doc.file_name.toLowerCase().endsWith(".pdf");
};

const PDFThumbnail = ({ pdfUrl, Document, Page }: { pdfUrl: string | null; Document: any; Page: any }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (!pdfUrl) {
    return (
      <div className="w-full h-56 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3" />
          <p className="text-sm text-gray-600 font-medium">Preparing preview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-56 bg-gray-50 rounded-t-lg overflow-hidden relative">
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
            <Page pageNumber={1} width={320} renderTextLayer={false} renderAnnotationLayer={false} />
          </Document>
        </div>
      )}
    </div>
  );
};

export default function CompanyDocs() {
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfWorkerReady, setPdfWorkerReady] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<CompanyDocument | null>(null);
  const [numPages, setNumPages] = useState<number>(0);

  useEffect(() => {
    const setupWorker = async () => {
      const { pdfjs } = await import("react-pdf");
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      setPdfWorkerReady(true);
    };

    setupWorker();
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/company-docs");
      if (!res.ok) throw new Error("Failed to fetch company documents");
      const data = await res.json();
      setDocuments(data.data || []);
    } catch (error) {
      console.error("Error fetching company documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!window.confirm("Delete this document? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/company-docs/${docId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Delete failed");
      }
      setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
      if (selectedDoc?.id === docId) {
        setSelectedDoc(null);
        setNumPages(0);
      }
    } catch (error) {
      console.error("Delete document error:", error);
      alert("Failed to delete document.");
    }
  };

  const selectedDocUrl = useMemo(() => {
    if (!selectedDoc) return null;
    return selectedDoc.signedUrl || null;
  }, [selectedDoc]);

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar activePage="Company Docs" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Loading company documents...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activePage="Company Docs" />
      <div className="flex-1 overflow-auto">
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Company Documents</h1>
            <p className="text-gray-600 mb-6">
              Upload and manage vital shared documents for the company.
            </p>

            <CompanyDocumentUploader
              onUploadComplete={(file) => setDocuments((prev) => [file, ...prev])}
            />
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-lg">No company documents uploaded</p>
              <p className="text-gray-400 text-sm mt-1">Upload your first shared document above</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map((doc) => {
                const pdfUrl = doc.signedUrl || null;
                const showPdf = isPdf(doc);

                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden hover:shadow-2xl transition-all hover:border-blue-500 hover:scale-[1.02] text-left"
                  >
                    {showPdf && pdfWorkerReady ? (
                      <PDFThumbnail pdfUrl={pdfUrl} Document={Document} Page={Page} />
                    ) : (
                      <div className="w-full h-56 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg flex items-center justify-center">
                        <div className="text-center">
                          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 font-medium">{showPdf ? "Loading preview..." : "Document"}</p>
                        </div>
                      </div>
                    )}

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-gray-900 mb-1 line-clamp-2">
                            {doc.file_name}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {new Date(doc.file_uploaded_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(doc.id);
                          }}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {doc.upload_notes && (
                        <p className="mt-3 text-xs text-gray-600 line-clamp-2">{doc.upload_notes}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedDoc.file_name}</h2>
                <p className="text-sm text-gray-600">
                  Uploaded {new Date(selectedDoc.file_uploaded_at).toLocaleDateString("en-US")}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedDoc(null);
                  setNumPages(0);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
              {selectedDocUrl && isPdf(selectedDoc) && pdfWorkerReady ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="sticky top-0 z-10 mb-2">
                    <a
                      href={selectedDocUrl}
                      download={selectedDoc.file_name}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90 shadow-lg transition-opacity"
                    >
                      <Download className="w-4 h-4" />
                      Download Document
                    </a>
                  </div>

                  <Document
                    file={selectedDocUrl}
                    onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                    className="flex flex-col items-center space-y-4"
                  >
                    {numPages > 0 &&
                      Array.from(new Array(numPages), (el, index) => (
                        <div key={`page_${index + 1}`} className="shadow-lg bg-white rounded-sm overflow-hidden">
                          <Page
                            pageNumber={index + 1}
                            width={Math.min(850, window.innerWidth - 150)}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                          />
                        </div>
                      ))}
                  </Document>
                </div>
              ) : selectedDocUrl ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-700 font-medium mb-2">Preview not available</p>
                    <a
                      href={selectedDocUrl}
                      download={selectedDoc.file_name}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90 shadow-lg transition-opacity"
                    >
                      <Download className="w-4 h-4" />
                      Download Document
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Preparing document...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
