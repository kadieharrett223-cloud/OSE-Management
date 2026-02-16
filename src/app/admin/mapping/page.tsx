"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import QboMappingTab from "./QboMappingTab";
import ShopifyMappingTab from "./ShopifyMappingTab";

export default function ProductMappingPage() {
  const [activeTab, setActiveTab] = useState<"qbo" | "shopify">("qbo");
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activePage="Product Mapping" />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Product Mapping</h1>
              <p className="text-gray-600 mt-1">Map products between your systems and price list</p>
            </div>
            <button
              type="button"
              onClick={() => setShowInfo(true)}
              className="h-9 w-9 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100"
              aria-label="Mapping help"
              title="How mapping works"
            >
              i
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex gap-4">
              <button
                onClick={() => setActiveTab("qbo")}
                className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === "qbo"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                QuickBooks Mapping
              </button>
              <button
                onClick={() => setActiveTab("shopify")}
                className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === "shopify"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Shopify Mapping
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow">
            {activeTab === "qbo" ? <QboMappingTab /> : <ShopifyMappingTab />}
          </div>
        </div>
      </div>

      {showInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">How product mapping works</h2>
              <p className="text-sm text-gray-600 mt-1">
                A price list item is the central record. QBO and Shopify products map to it.
              </p>
            </div>
            <div className="p-6 space-y-3 text-sm text-gray-700">
              <p>
                QuickBooks mapping links a QBO item to a price list SKU and stores the shipping
                deduction for commissions. Saving a mapping updates the price list item with the
                QBO item id and name.
              </p>
              <p>
                Shopify mapping links a Shopify variant to a price list item by storing the variant
                id on the price list item. One variant maps to one price list item.
              </p>
              <p>
                You can create a new price list item directly in the mapping flow, then map it to
                the QBO item or Shopify variant you selected.
              </p>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
