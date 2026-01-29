"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import QboMappingTab from "./QboMappingTab";
import ShopifyMappingTab from "./ShopifyMappingTab";

export default function ProductMappingPage() {
  const [activeTab, setActiveTab] = useState<"qbo" | "shopify">("qbo");

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activePage="Product Mapping" />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Product Mapping</h1>
            <p className="text-gray-600 mt-1">Map products between your systems and price list</p>
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
    </div>
  );
}
