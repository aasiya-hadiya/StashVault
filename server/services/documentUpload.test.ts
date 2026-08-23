import { describe, expect, it } from "vitest";
import { decodeAndValidateDocument, DocumentUploadValidationError, MAX_DOCUMENT_BYTES } from "./documentUpload";

describe("document upload validation", () => {
  it("accepts a supported document and normalizes the filename", () => {
    const result = decodeAndValidateDocument("Invoice 2026 / Stashly.pdf", "application/pdf", Buffer.from("receipt").toString("base64"));
    expect(result.fileName).toBe("Invoice-2026-Stashly.pdf");
    expect(result.bytes.toString()).toBe("receipt");
  });

  it("rejects unsupported media types before storage", () => {
    expect(() => decodeAndValidateDocument("archive.txt", "text/plain", Buffer.from("no").toString("base64"))).toThrow(DocumentUploadValidationError);
  });

  it("rejects malformed base64 payloads", () => {
    expect(() => decodeAndValidateDocument("receipt.pdf", "application/pdf", "not valid %%%")).toThrow("couldn't read");
  });

  it("rejects files larger than the private-upload limit", () => {
    const tooLarge = Buffer.alloc(MAX_DOCUMENT_BYTES + 1, 7).toString("base64");
    expect(() => decodeAndValidateDocument("large.pdf", "application/pdf", tooLarge)).toThrow("too large");
  });
});
