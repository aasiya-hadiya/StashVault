import { describe, expect, it } from "vitest";
import { buildDocumentDataCsv, buildDocumentExport, type DocumentExportSource } from "./documentExport";

const receipt: DocumentExportSource = {
  id: 14,
  productId: 6,
  productName: "Quantum Wireless Gaming Mouse",
  name: "receipt, august.jpg",
  fileName: "receipt, august.jpg",
  documentType: "receipt",
  mimeType: "image/jpeg",
  processingStatus: "completed",
  extractedData: JSON.stringify({
    name: "Quantum Wireless Gaming Mouse",
    brand: "Quantum",
    category: "Electronics",
    purchasedAt: "2026-08-15",
    purchasePrice: 1532.82,
    currency: "INR",
    purchasedFrom: "TECHNOVA RETAIL",
    invoiceNumber: "INV-42",
    serialNumber: "QWM-100",
    confidence: 96,
    source: "ocr",
  }),
  extractionConfidence: "96.00",
  extractionReviewedAt: new Date("2026-08-15T12:00:00.000Z"),
  uploadedAt: new Date("2026-08-15T12:00:00.000Z"),
};

describe("document CSV export", () => {
  it("exports supported document and receipt-extraction fields without raw OCR or storage references", () => {
    const csv = buildDocumentDataCsv([receipt]);

    expect(csv).toContain('"Document name"');
    expect(csv).toContain('"receipt, august.jpg"');
    expect(csv).toContain('"Quantum Wireless Gaming Mouse"');
    expect(csv).toContain('"2026-08-15"');
    expect(csv).toContain('"1532.82"');
    expect(csv).toContain('"INR"');
    expect(csv).not.toContain("rawOcrText");
    expect(csv).not.toContain("fileKey");
    expect(csv).not.toContain("fileUrl");
  });

  it("escapes quoted cells and neutralizes spreadsheet formula prefixes", () => {
    const csv = buildDocumentDataCsv([{ ...receipt, name: '=HYPERLINK("https://example.com")', fileName: 'proof "quoted".jpg' }]);

    expect(csv).toContain('"\'=HYPERLINK(""https://example.com"")"');
    expect(csv).toContain('"proof ""quoted"".jpg"');
  });

  it("keeps a usable header for an empty archive and reports no extracted rows", () => {
    const exportResult = buildDocumentExport([], new Date("2026-08-23T00:00:00.000Z"));

    expect(exportResult).toMatchObject({ fileName: "stashvault-document-data-2026-08-23.csv", totalDocuments: 0, extractedDocuments: 0 });
    expect(exportResult.csv).toContain('"Document ID"');
    expect(exportResult.csv).not.toContain("\r\n\r\n");
  });

  it("leaves receipt fields blank when stored extraction data is malformed", () => {
    const csv = buildDocumentDataCsv([{ ...receipt, extractedData: "not valid json", extractionConfidence: null }]);

    expect(csv).toContain('"receipt"');
    expect(csv).not.toContain('"Quantum"');
  });
});
