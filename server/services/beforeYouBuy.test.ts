import { describe, expect, it } from "vitest";
import { buildConsideredProductView, compareConsideredProducts, comparisonMissingFields } from "./beforeYouBuy";

describe("Before You Buy calculations", () => {
  it("derives a transparent monthly cost from the saved price and planned ownership period", () => {
    const result = buildConsideredProductView({
      id: 1,
      name: "Considered headphones",
      category: "Electronics",
      estimatedPrice: 1200,
      currency: "USD",
      plannedOwnershipMonths: 24,
      expectedWarrantyMonths: 12,
      expectedResaleValue: 300,
      expectedResaleValueAtMonths: 24,
    });

    expect(result.monthlyCost).toBe(50);
    expect(result.ownershipEstimateMissing).toEqual([]);
    expect(result.resaleEstimate).toEqual({ value: 300, months: 24 });
  });

  it("keeps unavailable inputs explicit and does not fabricate estimates", () => {
    const result = buildConsideredProductView({ id: 2, name: "Unknown details", category: "Electronics", estimatedPrice: null, plannedOwnershipMonths: null });

    expect(result.monthlyCost).toBeNull();
    expect(result.ownershipEstimateMissing).toEqual(["estimatedPrice", "plannedOwnershipMonths"]);
    expect(comparisonMissingFields(result)).toEqual(expect.arrayContaining(["estimated cost", "planned ownership period", "expected warranty period", "repairability notes", "resale estimate"]));
  });

  it("distinguishes a saved zero-month warranty from missing warranty information", () => {
    const result = buildConsideredProductView({ id: 3, name: "No warranty option", category: "Electronics", estimatedPrice: 80, plannedOwnershipMonths: 10, expectedWarrantyMonths: 0 });

    expect(comparisonMissingFields(result)).not.toContain("expected warranty period");
  });

  it("compares exactly two saved items and returns no comparison for any other count", () => {
    const first = buildConsideredProductView({ id: 4, name: "Option A", category: "Electronics", estimatedPrice: 100, plannedOwnershipMonths: 10 });
    const second = buildConsideredProductView({ id: 5, name: "Option B", category: "Electronics", estimatedPrice: 240, plannedOwnershipMonths: 24 });

    expect(compareConsideredProducts([first, second])).toMatchObject({ products: [{ id: 4, monthlyCost: 10 }, { id: 5, monthlyCost: 10 }] });
    expect(compareConsideredProducts([first])).toBeNull();
  });
});
