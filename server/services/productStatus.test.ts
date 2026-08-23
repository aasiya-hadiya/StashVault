import { describe, expect, it } from "vitest";
import { addMonths, daysRemaining, getProductStatus } from "./productStatus";

describe("product status service", () => {
  const now = new Date("2026-08-14T00:00:00.000Z");

  it("calculates a protected warranty and active return window", () => {
    expect(getProductStatus({ warrantyExpiresAt: "2027-08-20T00:00:00.000Z", returnExpiresAt: "2026-09-10T00:00:00.000Z" }, now)).toMatchObject({ warrantyStatus: "protected", returnStatus: "active", urgency: "none" });
  });

  it("returns a combined status and warranty countdown data", () => {
    const status = getProductStatus({ purchasedAt: new Date("2026-02-14T00:00:00.000Z"), warrantyExpiresAt: new Date("2027-02-14T00:00:00.000Z"), returnExpiresAt: null }, now);
    expect(status).toMatchObject({ status: "protected", label: "Protected", warrantyDaysRemaining: 184, warrantyElapsedPercent: 50 });
  });

  it("flags close deadlines and missing warranty information", () => {
    expect(getProductStatus({ warrantyExpiresAt: "2026-09-01T00:00:00.000Z", returnExpiresAt: "2026-08-17T00:00:00.000Z" }, now)).toMatchObject({ warrantyStatus: "expiring", returnStatus: "expiring", urgency: "soon" });
    expect(getProductStatus({ warrantyExpiresAt: null, returnExpiresAt: null }, now)).toMatchObject({ warrantyStatus: "review_needed", returnStatus: "review_needed", urgency: "attention" });
  });

  it("treats passed dates as expired and clamps remaining days to zero", () => {
    expect(daysRemaining("2026-08-13T00:00:00.000Z", now)).toBe(0);
    expect(getProductStatus({ warrantyExpiresAt: "2026-08-13T00:00:00.000Z", returnExpiresAt: null }, now)).toMatchObject({ warrantyStatus: "expired", urgency: "attention" });
  });

  it("keeps month-end warranties on the last valid day of the target month", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00.000Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
});
