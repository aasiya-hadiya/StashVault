import { describe, expect, it } from "vitest";
import { repairPageState, repairRecommendation, returnPresentation, sortProductsForRepair, warrantyPresentation } from "./repairLifecycle";

describe("repair lifecycle presentation", () => {
  const baseProduct = {
    id: 1,
    name: "Saved headphones",
    brand: "Aural",
    purchasedAt: "2026-08-15",
    warrantyExpiresAt: "2027-08-15",
    returnStatus: "review_needed" as const,
  };

  it("uses the exact repair-first recommendation for an active warranty", () => {
    expect(repairRecommendation({ ...baseProduct, warrantyStatus: "protected" })).toBe("Repair may be covered by your warranty.");
    expect(repairRecommendation({ ...baseProduct, warrantyStatus: "expiring" })).toBe("Repair may be covered by your warranty.");
  });

  it("keeps unavailable and expired warranty recommendations evidence-safe", () => {
    expect(repairRecommendation({ ...baseProduct, warrantyStatus: "review_needed" })).toBe("Check your warranty details before replacing.");
    expect(repairRecommendation({ ...baseProduct, warrantyStatus: "expired" })).toBe("Warranty expired — consider repair before replacement.");
  });

  it("preserves saved lifecycle labels without inventing return coverage", () => {
    expect(warrantyPresentation("expired")).toEqual({ label: "Warranty expired", badge: "expired" });
    expect(returnPresentation("review_needed")).toEqual({ label: "Return details unavailable", badge: "neutral" });
  });

  it("prioritizes existing lifecycle attention and exposes an empty state only for no saved products", () => {
    const ordered = sortProductsForRepair([
      { ...baseProduct, id: 3, name: "Protected", warrantyStatus: "protected" },
      { ...baseProduct, id: 2, name: "Expired", warrantyStatus: "expired" },
      { ...baseProduct, id: 1, name: "Needs review", warrantyStatus: "review_needed" },
    ]);
    expect(ordered.map(product => product.name)).toEqual(["Expired", "Needs review", "Protected"]);
    expect(repairPageState([])).toBe("empty");
    expect(repairPageState(ordered)).toBe("products");
  });
});
