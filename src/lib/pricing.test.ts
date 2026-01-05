import { describe, expect, it } from "vitest";
import { computePricingRow, mapSheetRowToInput } from "./pricing";

describe("pricing calculations", () => {
  const baseRow = {
    itemNo: "ABC123",
    description: "Widget",
    supplier: "ACME",
    fobCost: 100,
    oceanFrt: 20,
    importing: 10,
    zone5: 5,
    multiplier: 1.5,
  } as const;

  it("matches Excel-equivalent math", () => {
    const result = computePricingRow(baseRow);

    expect(result.tariff105).toBe(200);
    expect(result.perUnit).toBe(230);
    expect(result.costWithShipping).toBe(235);
    expect(result.sellPrice).toBeCloseTo(352.5);
    expect(result.roundedNormalPrice).toBe(350);
    expect(result.listPrice).toBeCloseTo(423);
    expect(result.blackFridayPrice).toBeCloseTo(317.25);
    expect(result.roundedSalePrice).toBe(299);
  });

  it("parses sheet rows using header aliases", () => {
    const row = mapSheetRowToInput({
      "Item No": "XYZ",
      description: "Thing",
      supplier: "Supplier",
      "FOB COST": "80",
      "Ocean frt": 15,
      importing: 7,
      "Zone 5": 4,
      Multiplier: 2,
    });

    expect(row).not.toBeNull();
    const computed = row && computePricingRow(row);
    expect(computed?.sellPrice).toBe(2 * ((80 * 2) + 15 + 7 + 4));
  });
});
