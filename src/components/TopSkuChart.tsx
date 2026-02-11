"use client";

import { useEffect, useState } from "react";

interface TopSkuData {
  month: string;
  topSkus: Array<{
    sku: string;
    quantity: number;
    description: string;
  }>;
}

export function TopSkuChart() {
  const [data, setData] = useState<TopSkuData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  useEffect(() => {
    const fetchTopSkus = async () => {
      try {
        const response = await fetch("/api/dashboard/top-skus");
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch");
        }
        const result = await response.json();
        if (result.ok && result.data) {
          setData(result.data);
          if (result.data.length > 0) {
            setSelectedMonth(result.data[0].month);
          }
        }
      } catch (err: any) {
        console.error("Error fetching top SKUs:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTopSkus();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200 p-6">
        <p className="text-slate-500">Loading top SKUs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200 p-6">
        <p className="text-red-600">Failed to load top SKUs: {error}</p>
      </div>
    );
  }

  const currentMonthData = data.find((d) => d.month === selectedMonth);
  if (!currentMonthData || currentMonthData.topSkus.length === 0) {
    return (
      <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200 p-6">
        <p className="text-slate-500">No SKU data available</p>
      </div>
    );
  }

  const maxQuantity = Math.max(...currentMonthData.topSkus.map((s) => s.quantity));
  const months = data.map((d) => d.month);

  return (
    <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-blue-700">Sales Analytics</p>
          <h2 className="text-2xl font-semibold text-slate-900">Top 10 SKUs by Month</h2>
          <p className="text-sm text-slate-600 mt-1">Units sold ranked by volume</p>
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {months.map((month) => {
            const date = new Date(month + "-01");
            const label = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
            return (
              <option key={month} value={month}>
                {label}
              </option>
            );
          })}
        </select>
      </div>

      <div className="space-y-3">
        {currentMonthData.topSkus.map((sku, index) => {
          const percentage = (sku.quantity / maxQuantity) * 100;
          return (
            <div key={sku.sku} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 text-sm">{index + 1}. {sku.sku}</p>
                  <p className="text-xs text-slate-500 truncate">{sku.description}</p>
                </div>
                <div className="flex-shrink-0 ml-4 text-right">
                  <p className="font-semibold text-slate-900">{sku.quantity.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">units</p>
                </div>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-6 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          {currentMonthData.topSkus.length} SKUs tracked • Total units:{" "}
          <span className="font-semibold text-slate-900">
            {currentMonthData.topSkus.reduce((sum, s) => sum + s.quantity, 0).toLocaleString()}
          </span>
        </p>
      </div>
    </div>
  );
}
