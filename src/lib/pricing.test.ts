import { describe, expect, it } from "vitest";
import { computePricingRow, mapSheetRowToInput } from "./pricing";

describe("pricing calculations", () => {
  const baseRow = {
    itemNo: "ABC123",
    description: "Widget",
    supplier: "ACME",
    fobCost: 100,
    quantity: 100, // Container capacity
    shipping: 50,
    margin: 0.25,
  } as const;

  it("matches pricing guide formula", () => {
    const result = computePricingRow(baseRow);

    // tariff = fobCost × (1 + 80%)
    expect(result.tariff).toBe(180);
    
    // oceanPerUnit = 3000 / quantity
    expect(result.oceanPerUnit).toBe(30);
    
    // importingPerUnit = 2100 / quantity
    expect(result.importingPerUnit).toBe(21);
    
    // costNoShipping = tariff + oceanPerUnit + importingPerUnit
    expect(result.costNoShipping).toBe(231);
    
    // finalCost = costNoShipping + shipping
    expect(result.finalCost).toBe(281);
    
    // sellPrice = finalCost / (1 - margin)
    expect(result.sellPrice).toBeCloseTo(374.6666667);
    
    // profit = sellPrice - finalCost
    expect(result.profit).toBeCloseTo(93.6666667);
    
    // calculated list price = sellPrice ÷ 0.80
    expect(result.calculatedListPrice).toBeCloseTo(468.3333333);
    
    // discounted price = appliedListPrice × (1 - discountPercent / 100)
    expect(result.discountedPrice).toBeCloseTo(374.6666667);
  });

  it("allows manual list price override", () => {
    const rowWithManualPrice = {
      ...baseRow,
      listPrice: 500,
    };
    
    const result = computePricingRow(rowWithManualPrice);
    
    // Should use manual list price, not calculated
    expect(result.appliedListPrice).toBe(500);
    
    // Discounted price based on manual list price
    expect(result.discountedPrice).toBeCloseTo(400); // 500 × 0.8
  });

  it("supports custom discount percentage", () => {
    const rowWithCustomDiscount = {
      ...baseRow,
      discount: 30, // 30% off
    };
    
    const result = computePricingRow(rowWithCustomDiscount);
    
    // List price should account for custom discount
    expect(result.discountedPrice).toBeLessThan(result.appliedListPrice);
    expect(result.discountedPrice).toBeCloseTo(result.appliedListPrice * 0.7);
  });

  it("parses sheet rows using new header aliases", () => {
    const row = mapSheetRowToInput({
      "Item No": "XYZ",
      description: "Thing",
      supplier: "Supplier",
      "FOB COST": "100",
      "Quantity": 100,
      "Shipping": 50,
      "Margin": 25,
    });

    expect(row).not.toBeNull();
    expect(row?.fobCost).toBe(100);
    expect(row?.quantity).toBe(100);
    expect(row?.shipping).toBe(50);
    expect(row?.margin).toBe(0.25);
  });
});
