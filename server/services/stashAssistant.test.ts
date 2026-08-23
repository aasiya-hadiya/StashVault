import { describe, expect, it } from "vitest";
import { answerStashQuestion, buildStashAssistantEvidence, StashAssistantError } from "./stashAssistant";

const warrantyMouse = {
  id: 11,
  name: "Quantum Wireless Gaming Mouse",
  brand: "Quantum",
  model: "QW-1",
  category: "Electronics",
  purchasedAt: "2026-08-15",
  purchasePrice: 1532.82,
  currency: "INR",
  purchasedFrom: "TECHNOVA RETAIL",
  invoiceNumber: "INV-2026-8834",
  serialNumber: "QMS-99281X",
  warrantyStatus: "review_needed" as const,
  warrantyExpiresAt: null,
  warrantyMonths: null,
  returnStatus: "review_needed" as const,
  returnExpiresAt: null,
  returnPeriodDays: null,
};

describe("StashVault assistant evidence contract", () => {
  it("includes only question-relevant private fields and preserves missing lifecycle information", () => {
    const evidence = buildStashAssistantEvidence({
      question: "How much did I spend on electronics?",
      products: [warrantyMouse],
      documents: [{ id: 1, productId: 11, name: "TechNova invoice", documentType: "invoice" }],
    });

    expect(evidence.products[0]).toMatchObject({
      name: "Quantum Wireless Gaming Mouse",
      price: { amount: 1532.82, currency: "INR" },
      warranty: { status: "review_needed", expiresAt: null, months: null },
      return: { status: "review_needed", expiresAt: null, periodDays: null },
      documents: [{ type: "invoice", name: "TechNova invoice" }],
    });
    expect(evidence.products[0]).not.toHaveProperty("serialNumber");
    expect(evidence.products[0]).not.toHaveProperty("invoiceNumber");
    expect(evidence.products[0]).not.toHaveProperty("purchase");
  });

  it("sends saved evidence to the provider, returns only a real provider answer, and points to the matching saved product", async () => {
    let providerInput: unknown;
    const result = await answerStashQuestion({
      question: "Where is my receipt for the Quantum mouse?",
      products: [{ ...warrantyMouse, warrantyStatus: "protected", warrantyExpiresAt: "2027-08-15" }],
      documents: [{ id: 1, productId: 11, name: "TECHNOVA receipt", documentType: "receipt" }],
    }, async input => {
      providerInput = input;
      return { choices: [{ message: { content: "A receipt is saved with Quantum Wireless Gaming Mouse. Open that product to view it." } }] } as never;
    });

    expect(JSON.stringify(providerInput)).toContain("Quantum Wireless Gaming Mouse");
    expect(JSON.stringify(providerInput)).toContain("TECHNOVA receipt");
    expect(JSON.stringify(providerInput)).not.toContain("QMS-99281X");
    expect(result.answer).toContain("receipt is saved");
    expect(result.sources).toEqual([{ productId: 11, productName: "Quantum Wireless Gaming Mouse", hasReceiptOrInvoice: true, hasDocuments: true }]);
  });

  it("provides the exact saved date-only warranty evidence for warranty questions", async () => {
    let providerInput: unknown;
    const result = await answerStashQuestion({
      question: "When does my Quantum mouse warranty expire?",
      products: [{ ...warrantyMouse, warrantyStatus: "protected", warrantyExpiresAt: "2027-08-15" }],
      documents: [],
    }, async input => {
      providerInput = input;
      return { choices: [{ message: { content: "Your saved warranty expiry for Quantum Wireless Gaming Mouse is 2027-08-15." } }] } as never;
    });

    expect(JSON.stringify(providerInput)).toContain("2027-08-15");
    expect(result.answer).toContain("2027-08-15");
  });

  it("handles an empty stash without fabricating account facts", async () => {
    let providerInput: unknown;
    const result = await answerStashQuestion({ question: "Which warranties do I have?", products: [], documents: [] }, async input => {
      providerInput = input;
      return { choices: [{ message: { content: "You do not have any saved products yet. Add a product or upload a receipt to get started." } }] } as never;
    });

    expect((providerInput as { messages: Array<{ content: string }> }).messages.some(message => message.content.includes('"totalProducts":0'))).toBe(true);
    expect(result.hasSavedProducts).toBe(false);
    expect(result.sources).toEqual([]);
  });

  it("surfaces provider failures so the UI can offer a retry without a fabricated reply", async () => {
    await expect(answerStashQuestion({ question: "What is my warranty?", products: [warrantyMouse], documents: [] }, async () => {
      throw new Error("provider unavailable");
    })).rejects.toMatchObject({ code: "provider_unavailable" });
  });

  it("identifies missing provider configuration without exposing internal settings", async () => {
    await expect(answerStashQuestion({ question: "What is my warranty?", products: [warrantyMouse], documents: [] }, async () => {
      throw new Error("BUILT_IN_FORGE_API_KEY is missing");
    })).rejects.toMatchObject({ code: "configuration" });
  });

  it("treats an empty provider completion as a retryable failure", async () => {
    await expect(answerStashQuestion({ question: "What is my warranty?", products: [warrantyMouse], documents: [] }, async () => {
      return { choices: [{ message: { content: "" } }] } as never;
    })).rejects.toMatchObject({ code: "empty_response" });
  });
});
