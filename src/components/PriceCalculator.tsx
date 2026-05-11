"use client";

import { useState, useEffect } from "react";

interface PriceCalculatorProps {
  finalCost: number | null;
  currentMargin: number | null;
  currentSellPrice: number | null;
  itemNo: string;
  onSave: (margin: number, sellPrice: number) => Promise<void>;
  isLoading?: boolean;
}

export function PriceCalculator({
  finalCost,
  currentMargin,
  currentSellPrice,
  itemNo,
  onSave,
  isLoading = false,
}: PriceCalculatorProps) {
  const [mode, setMode] = useState<"margin" | "sell">("margin");
  const [marginInput, setMarginInput] = useState<string>("");
  const [sellPriceInput, setSellPriceInput] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Initialize with current values
  useEffect(() => {
    if (currentMargin !== null && currentMargin !== undefined) {
      setMarginInput((currentMargin * 100).toFixed(2));
    }
    if (currentSellPrice !== null && currentSellPrice !== undefined) {
      setSellPriceInput(currentSellPrice.toFixed(2));
    }
  }, [currentMargin, currentSellPrice]);

  // Compute derived values
  const compute = () => {
    if (!finalCost || finalCost <= 0) {
      return {
        sellPrice: null,
        margin: null,
        listPrice: null,
        profit: null,
        error: "Final cost required",
      };
    }

    if (mode === "margin") {
      const marginPercent = parseFloat(marginInput) || 0;
      if (marginPercent < 0 || marginPercent >= 100) {
        return {
          sellPrice: null,
          margin: null,
          listPrice: null,
          profit: null,
          error: "Margin must be 0-99.99%",
        };
      }

      const marginDecimal = marginPercent / 100;
      if (marginDecimal >= 0.95) {
        return {
          sellPrice: null,
          margin: null,
          listPrice: null,
          profit: null,
          error: "Margin must be less than 95%",
        };
      }

      // Sell = Final × (1 + Markup)
      const sellPrice = finalCost * (1 + marginDecimal);
      const listPrice = sellPrice / 0.8;
      const profit = sellPrice - finalCost;

      return {
        sellPrice,
        margin: marginDecimal,
        listPrice,
        profit,
        error: null,
      };
    } else {
      // Mode: sell price
      const sellPrice = parseFloat(sellPriceInput) || 0;
      if (sellPrice <= finalCost) {
        return {
          sellPrice: null,
          margin: null,
          listPrice: null,
          profit: null,
          error: "Sell price must be greater than final cost",
        };
      }

      // Markup = (Sell - Final) / Final
      const margin = (sellPrice - finalCost) / finalCost;
      if (margin >= 0.95) {
        return {
          sellPrice: null,
          margin: null,
          listPrice: null,
          profit: null,
          error: "Margin exceeds 95% – adjust sell price down",
        };
      }

      const listPrice = sellPrice / 0.8;
      const profit = sellPrice - finalCost;

      return {
        sellPrice,
        margin,
        listPrice,
        profit,
        error: null,
      };
    }
  };

  const result = compute();

  const handleSave = async () => {
    if (result.error || result.margin === null || result.sellPrice === null) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(result.margin, result.sellPrice);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Price Calculator</h3>

      {/* Mode Selector */}
      <div className="flex gap-2 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            value="margin"
            checked={mode === "margin"}
            onChange={(e) => setMode(e.target.value as "margin" | "sell")}
            disabled={isLoading || isSaving}
            className="h-4 w-4"
          />
          <span className="text-xs font-medium text-slate-700">Set by Margin %</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer ml-4">
          <input
            type="radio"
            value="sell"
            checked={mode === "sell"}
            onChange={(e) => setMode(e.target.value as "margin" | "sell")}
            disabled={isLoading || isSaving}
            className="h-4 w-4"
          />
          <span className="text-xs font-medium text-slate-700">Set by Sell Price</span>
        </label>
      </div>

      {/* Final Cost (Read-only) */}
      <div className="mb-3">
        <label className="block text-xs font-semibold text-slate-600 mb-1">Final Cost (Landed)</label>
        <div className="text-sm font-mono text-slate-900">
          ${finalCost ? finalCost.toFixed(2) : "—"}
        </div>
      </div>

      {/* Mode-specific Input */}
      {mode === "margin" ? (
        <div className="mb-3">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Margin %</label>
          <input
            type="number"
            min="0"
            max="99.99"
            step="0.01"
            value={marginInput}
            onChange={(e) => setMarginInput(e.target.value)}
            disabled={isLoading || isSaving || !finalCost}
            placeholder="22.96"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-mono text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
          />
        </div>
      ) : (
        <div className="mb-3">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Sell Price ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={sellPriceInput}
            onChange={(e) => setSellPriceInput(e.target.value)}
            disabled={isLoading || isSaving || !finalCost}
            placeholder="1234.56"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-mono text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
          />
        </div>
      )}

      {/* Error Message */}
      {result.error && (
        <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700 border border-red-200">
          {result.error}
        </div>
      )}

      {/* Calculated Results */}
      {!result.error && result.sellPrice !== null && (
        <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-blue-50 rounded border border-blue-200">
          <div>
            <div className="text-xs font-semibold text-slate-600">Sell Price</div>
            <div className="text-sm font-mono font-bold text-blue-900">
              ${result.sellPrice.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600">Margin %</div>
            <div className="text-sm font-mono font-bold text-blue-900">
              {(result.margin! * 100).toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600">List Price</div>
            <div className="text-sm font-mono font-bold text-slate-700">
              ${result.listPrice!.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600">Profit</div>
            <div className="text-sm font-mono font-bold text-emerald-700">
              ${result.profit!.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={handleSave}
          disabled={
            isSaving ||
            isLoading ||
            !finalCost ||
            !!result.error ||
            result.margin === null ||
            result.sellPrice === null
          }
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
        >
          {isSaving ? "Saving..." : "Apply to Product"}
        </button>
      </div>
    </div>
  );
}
