import { storagePut } from "../storage";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export class DocumentUploadValidationError extends Error {}

function safeFileName(fileName: string) {
  const cleaned = fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned || "document";
}

export function decodeAndValidateDocument(fileName: string, mimeType: string, base64: string) {
  if (!SUPPORTED_DOCUMENT_TYPES.includes(mimeType as (typeof SUPPORTED_DOCUMENT_TYPES)[number])) {
    throw new DocumentUploadValidationError("That file type isn't supported. Please upload a PDF or image.");
  }
  const normalized = base64.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new DocumentUploadValidationError("We couldn't read that file. Please try another PDF or image.");
  }
  const bytes = Buffer.from(normalized, "base64");
  if (!bytes.length) throw new DocumentUploadValidationError("We couldn't read that file. Please try another PDF or image.");
  if (bytes.length > MAX_DOCUMENT_BYTES) {
    throw new DocumentUploadValidationError("This file is too large. Please upload a file under 10 MB.");
  }
  return { bytes, fileName: safeFileName(fileName) };
}

export async function storeDocumentUpload(input: { userId: number; productId: number; fileName: string; mimeType: string; base64: string }) {
  const validated = decodeAndValidateDocument(input.fileName, input.mimeType, input.base64);
  const path = `stashly/documents/${input.userId}/${input.productId}/${validated.fileName}`;
  const stored = await storagePut(path, validated.bytes, input.mimeType);
  return { ...stored, fileName: validated.fileName };
}

export async function storeReceiptUpload(input: { userId: number; fileName: string; mimeType: string; base64: string }) {
  const validated = decodeAndValidateDocument(input.fileName, input.mimeType, input.base64);
  const path = `stashly/receipts/${input.userId}/pending/${validated.fileName}`;
  const stored = await storagePut(path, validated.bytes, input.mimeType);
  return { ...stored, fileName: validated.fileName, bytes: validated.bytes };
}
