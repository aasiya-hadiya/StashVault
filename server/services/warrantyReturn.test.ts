import { describe, expect, it } from "vitest";
import {
  addDateOnlyDays,
  addDateOnlyMonths,
  getAttentionKinds,
  getWarrantyReturnSummary,
  resolveReturnExpiry,
  resolveWarrantyExpiry,
} from "./warrantyReturn";

describe("warranty and return tracking", () => {
  it("keeps calendar calculations date-only across month boundaries", () => {
    expect(addDateOnlyMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addDateOnlyDays("2026-08-15", 30)).toBe("2026-09-14");
  });

  it("uses supported durations and purchase dates without inventing missing coverage", () => {
    expect(resolveWarrantyExpiry({ purchasedAt: "2026-08-15", warrantyMonths: 12, warrantyStartsAt: null, warrantyExpiresAt: null })).toBe("2027-08-15");
    expect(resolveReturnExpiry({ purchasedAt: "2026-08-15", returnPeriodDays: 30, returnStartsAt: null, returnExpiresAt: null })).toBe("2026-09-14");
    expect(resolveWarrantyExpiry({ purchasedAt: "2026-08-15", warrantyMonths: null, warrantyStartsAt: null, warrantyExpiresAt: null })).toBeNull();
    expect(resolveReturnExpiry({ purchasedAt: null, returnPeriodDays: 30, returnStartsAt: null, returnExpiresAt: null })).toBeNull();
  });

  it("honors user-entered deadline overrides", () => {
    expect(resolveWarrantyExpiry({ purchasedAt: "2026-08-15", warrantyMonths: 12, warrantyStartsAt: "2026-08-15", warrantyExpiresAt: "2026-10-01" })).toBe("2026-10-01");
    expect(resolveReturnExpiry({ purchasedAt: "2026-08-15", returnPeriodDays: 30, returnStartsAt: "2026-08-15", returnExpiresAt: "2026-08-20" })).toBe("2026-08-20");
  });

  it("marks active, upcoming, expired, and incomplete coverage at the correct boundaries", () => {
    const active = getWarrantyReturnSummary({ purchasedAt: "2026-08-15", warrantyMonths: 12, returnPeriodDays: 30 }, "2026-08-20");
    expect(active.warrantyStatus).toBe("active");
    expect(active.returnStatus).toBe("active");

    const upcoming = getWarrantyReturnSummary({ warrantyExpiresAt: "2026-09-19", returnExpiresAt: "2026-08-23" }, "2026-08-20");
    expect(upcoming.warrantyStatus).toBe("expiring_soon");
    expect(upcoming.returnStatus).toBe("ending_soon");

    const expired = getWarrantyReturnSummary({ warrantyExpiresAt: "2026-08-19", returnExpiresAt: "2026-08-19" }, "2026-08-20");
    expect(expired.warrantyStatus).toBe("expired");
    expect(expired.returnStatus).toBe("expired");

    const incomplete = getWarrantyReturnSummary({}, "2026-08-20");
    expect(incomplete.warrantyStatus).toBe("review_needed");
    expect(incomplete.returnStatus).toBe("review_needed");
  });

  it("keeps explicitly blank manual coverage null and review-needed without manufacturing a deadline", () => {
    const summary = getWarrantyReturnSummary({
      purchasedAt: "2026-08-15",
      warrantyMonths: null,
      warrantyStartsAt: null,
      warrantyExpiresAt: null,
      returnPeriodDays: null,
      returnStartsAt: null,
      returnExpiresAt: null,
    }, "2026-08-20");

    expect(summary.warrantyExpiryDate).toBeNull();
    expect(summary.returnExpiryDate).toBeNull();
    expect(summary.warrantyStatus).toBe("review_needed");
    expect(summary.returnStatus).toBe("review_needed");
  });

  it("generates actionable attention kinds without fabricating dates", () => {
    const summary = getWarrantyReturnSummary({ warrantyExpiresAt: "2026-09-19", returnExpiresAt: "2026-08-23" }, "2026-08-20");
    expect(getAttentionKinds(summary, false)).toEqual(["warranty_expiring", "return_ending", "missing_invoice"]);
    expect(getAttentionKinds(getWarrantyReturnSummary({}, "2026-08-20"), true)).toEqual(["warranty_review", "return_review"]);
  });
});
