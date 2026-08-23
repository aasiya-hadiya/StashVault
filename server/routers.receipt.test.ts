import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMock = vi.hoisted(() => ({
  getReceiptReviewForUser: vi.fn(),
  confirmReceiptReviewForUser: vi.fn(),
  getDocumentForUser: vi.fn(),
  saveReceiptExtractionForUser: vi.fn(),
}));

const storageMock = vi.hoisted(() => ({ storageGetSignedUrl: vi.fn(), storageRead: vi.fn() }));
const extractionMock = vi.hoisted(() => ({ extractReceiptWithDiagnostics: vi.fn() }));

vi.mock("./db", () => dbMock);
vi.mock("./storage", () => storageMock);
vi.mock("./services/receiptExtraction", () => extractionMock);

import { appRouter } from "./routers";

function createUserContext(userId = 42): TrpcContext {
  return { user: { id: userId, openId: "receipt-test-user", name: "Receipt Test", email: "receipt@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("receipt router ownership boundary", () => {
  it("uses the authenticated user ID when opening a receipt review", async () => {
    dbMock.getReceiptReviewForUser.mockResolvedValue({ id: 8, name: "receipt.pdf", processingStatus: "completed" });
    const result = await appRouter.createCaller(createUserContext(42)).receipt.getReview({ id: 8 });
    expect(dbMock.getReceiptReviewForUser).toHaveBeenCalledWith(42, 8);
    expect(result).toMatchObject({ id: 8, name: "receipt.pdf" });
  });

  it("does not confirm a receipt that is not owned by the signed-in user", async () => {
    dbMock.confirmReceiptReviewForUser.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createUserContext(42));
    await expect(caller.receipt.confirm({ documentId: 999, product: { name: "Camera", category: "Photography" } })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(dbMock.confirmReceiptReviewForUser).toHaveBeenCalledWith(42, 999, expect.objectContaining({ name: "Camera" }));
  });

  it("confirms a reviewed receipt by creating a product and retaining its source document link", async () => {
    dbMock.confirmReceiptReviewForUser.mockResolvedValue({ id: 21, name: "Camera", category: "Photography" });
    const caller = appRouter.createCaller(createUserContext(42));
    const result = await caller.receipt.confirm({ documentId: 8, product: { name: "Camera", category: "Photography", purchasedFrom: "Archive Photo" } });
    expect(dbMock.confirmReceiptReviewForUser).toHaveBeenCalledWith(42, 8, expect.objectContaining({ name: "Camera", purchasedFrom: "Archive Photo" }));
    expect(result).toMatchObject({ id: 21, name: "Camera" });
  });

  it("reprocesses the signed-in user's stored receipt bytes on retry", async () => {
    dbMock.getDocumentForUser.mockResolvedValue({ id: 8, documentType: "receipt", productId: null, fileKey: "receipts/8.jpg", mimeType: "image/jpeg" });
    storageMock.storageRead.mockResolvedValue(Buffer.from("receipt bytes"));
    extractionMock.extractReceiptWithDiagnostics.mockResolvedValue({
      extraction: { source: "ocr", confidence: 58, uncertainFields: ["name"], name: null, brand: null, model: null, category: null, purchasedAt: "2026-09-08", purchasePrice: 3499, currency: "INR", purchasedFrom: "Croma", invoiceNumber: "INV-8", serialNumber: null, warrantyMonths: null, returnPeriodDays: null },
      rawOcrText: "Croma\nNet payable INR 3499",
      ocrConfidence: 61,
    });
    dbMock.saveReceiptExtractionForUser.mockResolvedValue({ id: 8, processingStatus: "completed" });

    const result = await appRouter.createCaller(createUserContext(42)).receipt.retry({ id: 8 });

    expect(dbMock.getDocumentForUser).toHaveBeenCalledWith(42, 8);
    expect(storageMock.storageRead).toHaveBeenCalledWith("receipts/8.jpg");
    expect(extractionMock.extractReceiptWithDiagnostics).toHaveBeenCalledWith({ bytes: Buffer.from("receipt bytes"), mimeType: "image/jpeg" });
    expect(dbMock.saveReceiptExtractionForUser).toHaveBeenCalledWith(42, 8, expect.objectContaining({ purchasePrice: 3499 }), "tesseract-ocr + gpt-5-mini", "Croma\nNet payable INR 3499");
    expect(result).toMatchObject({ id: 8, processingStatus: "completed" });
  });
});
