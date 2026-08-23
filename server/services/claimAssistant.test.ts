import { describe, expect, it } from "vitest";
import { buildClaimAssistantState, generateClaimRequest } from "./claimAssistant";

const coveredProduct = {
  id: 7,
  name: "Quantum Wireless Gaming Mouse",
  brand: "Quantum",
  model: null,
  purchasedAt: "2026-08-15",
  purchasedFrom: "TECHNOVA RETAIL",
  invoiceNumber: "INV-2026-8834",
  serialNumber: "QMS-99281X",
  warrantyStatus: "protected" as const,
  warrantyExpiresAt: "2027-08-15",
};

describe("claim assistant", () => {
  it("derives a claim checklist only from saved evidence", () => {
    const state = buildClaimAssistantState({ product: coveredProduct, documents: [{ documentType: "receipt" }, { documentType: "warranty" }] });
    expect(state.warranty).toMatchObject({ status: "protected", expiresAt: "2027-08-15" });
    expect(state.checklist.find(item => item.key === "proof")?.status).toBe("available");
    expect(state.checklist.find(item => item.key === "serial")?.status).toBe("available");
    expect(state.checklist.find(item => item.key === "warranty-document")?.status).toBe("available");
  });

  it("keeps missing evidence explicit rather than fabricating it", () => {
    const state = buildClaimAssistantState({ product: { id: 8, name: "Speaker", warrantyStatus: "review_needed", warrantyExpiresAt: null }, documents: [] });
    expect(state.warranty.status).toBe("review_needed");
    expect(state.checklist.find(item => item.key === "proof")?.status).toBe("missing");
    expect(state.checklist.find(item => item.key === "serial")?.status).toBe("review_needed");
    expect(state.checklist.find(item => item.key === "coverage")?.status).toBe("review_needed");
  });

  it("builds a copy-ready request from saved fields and the user's issue without adding unsupported details", () => {
    const result = generateClaimRequest({
      product: coveredProduct,
      documents: [{ documentType: "receipt" }],
      issue: "The pointer intermittently stops responding after fifteen minutes.",
    });
    expect(result.request).toContain("Quantum Wireless Gaming Mouse");
    expect(result.request).toContain("Issue: The pointer intermittently stops responding after fifteen minutes.");
    expect(result.request).toContain("Purchase date: 15 Aug 2026");
    expect(result.request).toContain("Serial number: QMS-99281X");
    expect(result.request).toContain("Invoice number: INV-2026-8834");
    expect(result.request).toContain("Warranty status: Warranty active (15 Aug 2027)");
    expect(result.request).not.toContain("Model:");
    expect(result.request).not.toContain("reference number");
  });
});
