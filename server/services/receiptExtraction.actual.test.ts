import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractReceiptFromUpload } from "./receiptExtraction";

const fixturePath = "/home/ubuntu/webdev-static-assets/walmart-readable-receipt.webp";
const mobileFixturePath = "/home/ubuntu/webdev-static-assets/real-mobile-receipt-redacted.jpeg";

describe("actual receipt OCR validation", () => {
  const run = existsSync(fixturePath) ? it : it.skip;

  run("reads meaningful facts from a real readable receipt image", async () => {
    const bytes = await readFile(fixturePath);
    const result = await extractReceiptFromUpload({ bytes, mimeType: "image/webp" });

    expect(result.source).toBe("ocr");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.purchasePrice).toBe(98.21);
    expect(result.uncertainFields).toContain("brand");
  }, 90_000);

  const runMobile = existsSync(mobileFixturePath) ? it : it.skip;

  runMobile("retains meaningful raw-OCR facts from a real photographed mobile receipt", async () => {
    const bytes = await readFile(mobileFixturePath);
    const result = await extractReceiptFromUpload({ bytes, mimeType: "image/jpeg" });

    expect(result.source).toBe("ocr");
    expect(result.confidence).toBeGreaterThan(35);
    expect(result.purchasedAt).toBe("2024-11-25");
    expect(result.purchasedFrom?.toLowerCase()).toContain("apple");
    expect(result.purchasePrice).toBe(2849);
    expect(result.name).toBeNull();
    expect(result.uncertainFields).toContain("name");
  }, 120_000);
});
