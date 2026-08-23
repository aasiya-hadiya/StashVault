export type DocumentExportSource = {
  id: number;
  productId: number | null;
  productName?: string | null;
  name: string;
  fileName: string | null;
  documentType: string;
  mimeType: string | null;
  processingStatus: string;
  extractedData: string | null;
  extractionConfidence: string | number | null;
  extractionReviewedAt: Date | string | null;
  uploadedAt: Date | string;
};

type ExtractedReceiptValues = Record<string, string | number | null | undefined> & {
  confidence?: number;
  source?: string;
};

const headers = [
  "Document ID",
  "Document name",
  "File name",
  "Document type",
  "MIME type",
  "Processing status",
  "Uploaded at",
  "Linked product",
  "Extraction reviewed",
  "Extraction source",
  "Extraction confidence",
  "Product name",
  "Brand",
  "Model",
  "Category",
  "Purchase date",
  "Purchase price",
  "Currency",
  "Retailer",
  "Invoice number",
  "Serial number",
  "Warranty months",
  "Return period days",
] as const;

function parseExtraction(value: string | null): ExtractedReceiptValues | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as ExtractedReceiptValues : undefined;
  } catch {
    return undefined;
  }
}

function csvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const protectedValue = /^[=+\-@]/.test(stringValue.trimStart()) ? `'${stringValue}` : stringValue;
  return `"${protectedValue.replace(/"/g, '""')}"`;
}

function isoTimestamp(value: Date | string | null | undefined) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return Number.isNaN(value.getTime()) ? "" : value.toISOString();
}

function extractedValue(extraction: ExtractedReceiptValues | undefined, key: keyof ExtractedReceiptValues) {
  return extraction?.[key] ?? "";
}

export function buildDocumentDataCsv(documents: DocumentExportSource[]) {
  const rows = documents.map(document => {
    const extraction = parseExtraction(document.extractedData);
    return [
      document.id,
      document.name,
      document.fileName ?? "",
      document.documentType,
      document.mimeType ?? "",
      document.processingStatus,
      isoTimestamp(document.uploadedAt),
      document.productName ?? "",
      document.extractionReviewedAt ? "Yes" : "No",
      extractedValue(extraction, "source"),
      extractedValue(extraction, "confidence") || document.extractionConfidence || "",
      extractedValue(extraction, "name"),
      extractedValue(extraction, "brand"),
      extractedValue(extraction, "model"),
      extractedValue(extraction, "category"),
      extractedValue(extraction, "purchasedAt"),
      extractedValue(extraction, "purchasePrice"),
      extractedValue(extraction, "currency"),
      extractedValue(extraction, "purchasedFrom"),
      extractedValue(extraction, "invoiceNumber"),
      extractedValue(extraction, "serialNumber"),
      extractedValue(extraction, "warrantyMonths"),
      extractedValue(extraction, "returnPeriodDays"),
    ].map(csvValue).join(",");
  });

  return [headers.map(csvValue).join(","), ...rows].join("\r\n");
}

export function buildDocumentExport(documents: DocumentExportSource[], now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  return {
    fileName: `stashvault-document-data-${date}.csv`,
    csv: buildDocumentDataCsv(documents),
    totalDocuments: documents.length,
    extractedDocuments: documents.filter(document => Boolean(parseExtraction(document.extractedData))).length,
  };
}
