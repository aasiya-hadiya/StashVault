import { describe, expect, it } from "vitest";
import { getReceiptFieldEvidenceStatus, getReceiptReviewState } from "./receiptReviewState";

describe("receipt review state", () => {
  it("requires review for low-confidence OCR even when no field was populated", () => {
    expect(getReceiptReviewState({ confidence: 31, uncertainFields: [] })).toEqual({ lowConfidence: true, uncertainFieldCount: 0, requiresReview: true });
  });

  it("requires review when an otherwise strong extraction has uncertain fields", () => {
    expect(getReceiptReviewState({ confidence: 86, uncertainFields: ["serialNumber"] })).toEqual({ lowConfidence: false, uncertainFieldCount: 1, requiresReview: true });
  });

  it("does not require review only when OCR is strong and all included fields are supported", () => {
    expect(getReceiptReviewState({ confidence: 82, uncertainFields: [] })).toEqual({ lowConfidence: false, uncertainFieldCount: 0, requiresReview: false });
  });

  it("marks only evidence-backed populated fields as read from the receipt", () => {
    expect(getReceiptFieldEvidenceStatus("purchasedFrom", "TECHNOVA RETAIL", ["model", "currency"])).toBe("read");
    expect(getReceiptFieldEvidenceStatus("currency", "", ["currency"])).toBe("review");
    expect(getReceiptFieldEvidenceStatus("category", "", [])).toBe("review");
    expect(getReceiptFieldEvidenceStatus("model", "QMS-99281X", ["model"])).toBe("review");
  });
});
