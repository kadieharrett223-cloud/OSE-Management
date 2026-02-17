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
    multiplier: 1.5,
  } as const;

  it("matches new pricing formula", () => {
    const result = computePricingRow(baseRow);

    // tariff = fobCost × 2
    expect(result.tariff).toBe(200);
    
    // oceanPerUnit = 3000 / quantity
    expect(result.oceanPerUnit).toBe(30);
    
    // importingPerUnit = 2100 / quantity
    expect(result.importingPerUnit).toBe(21);
    
    // costNoShipping = tariff + oceanPerUnit + importingPerUnit
    expect(result.costNoShipping).toBe(251);
    
    // finalCost = costNoShipping + shipping
    expect(result.finalCost).toBe(301);
    
    // sellPrice = (costNoShipping × multiplier) + shipping
    expect(result.sellPrice).toBeCloseTo(426.5);
    
    // profit = sellPrice - finalCost
    expect(result.profit).toBeCloseTo(125.5);
    
    // calculated list price = sellPrice × 1.2 (20% markup for 20% discount)
    expect(result.calculatedListPrice).toBeCloseTo(511.8);
    
    // discounted price = appliedListPrice × (1 - discountPercent / 100)
    expect(result.discountedPrice).toBeCloseTo(409.44);
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
      "Multiplier": 1.5,
    });

    expect(row).not.toBeNull();
    expect(row?.fobCost).toBe(100);
    expect(row?.quantity).toBe(100);
    expect(row?.shipping).toBe(50);
    expect(row?.multiplier).toBe(1.5);
  });
});
