import { describe, expect, it } from "vitest";
import { documents } from "../drizzle/schema";
import { toDocumentView } from "./db";

describe("document view mapping", () => {
  it("keeps OCR review metadata for the product paper trail while redacting private storage references", () => {
    const reviewedAt = new Date("2026-08-14T12:00:00.000Z");
    const source = {
      id: 9,
      userId: 4,
      productId: 7,
      name: "camera receipt",
      fileName: "camera-receipt.pdf",
      documentType: "receipt",
      fileKey: "private/receipts/camera.pdf",
      fileUrl: "https://private.example/camera.pdf",
      mimeType: "application/pdf",
      fileType: "pdf",
      processingStatus: "completed",
      extractedData: "{}",
      extractionConfidence: "0.88",
      extractionModel: "gemini-2.5-flash-lite",
      extractionError: null,
      extractionReviewedAt: reviewedAt,
      processedAt: reviewedAt,
      uploadedAt: reviewedAt,
      createdAt: reviewedAt,
    } as typeof documents.$inferSelect;

    const view = toDocumentView(source);

    expect(view).toMatchObject({ id: 9, productId: 7, documentType: "receipt", extractionReviewedAt: reviewedAt, processingStatus: "completed" });
    expect(view).not.toHaveProperty("fileKey");
    expect(view).not.toHaveProperty("fileUrl");
  });
});
