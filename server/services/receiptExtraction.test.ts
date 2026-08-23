import { describe, expect, it } from "vitest";
import { extractReceiptFieldsFromText, fallbackReceiptExtraction, normalizeStoredReceiptExtraction, parseReceiptExtraction } from "./receiptExtraction";

describe("receipt extraction safeguards", () => {
  it("keeps missing receipt fields null and flags them for review", () => {
    const result = parseReceiptExtraction(JSON.stringify({
      name: "Coffee grinder", brand: null, model: null, category: null, purchasedAt: "2026-08-14", purchasePrice: 49.99, currency: "usd", purchasedFrom: "Corner Store", invoiceNumber: null, serialNumber: null, warrantyMonths: null, returnPeriodDays: null, confidence: 88, uncertainFields: ["brand"],
    }));
    expect(result.currency).toBe("USD");
    expect(result.uncertainFields).toEqual(expect.arrayContaining(["brand", "model", "serialNumber", "warrantyMonths"]));
  });

  it("returns an honest empty fallback when extraction is unavailable", () => {
    const result = fallbackReceiptExtraction();
    expect(result.source).toBe("fallback");
    expect(result.name).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.uncertainFields).toHaveLength(12);
  });

  it("derives only directly readable baseline facts when the structuring pass is unavailable", () => {
    const result = extractReceiptFieldsFromText([
      "Example Market",
      "Receipt # A-12345",
      "Warranty: 24 months",
      "Returns accepted within 30 days",
      "Grand Total USD 49.95",
      "2026-08-14",
    ].join("\n"), 82);

    expect(result.source).toBe("ocr");
    expect(result.purchasedFrom).toBe("Example Market");
    expect(result.invoiceNumber).toBe("A-12345");
    expect(result.purchasePrice).toBe(49.95);
    expect(result.currency).toBe("USD");
    expect(result.purchasedAt).toBe("2026-08-14");
    expect(result.warrantyMonths).toBe(24);
    expect(result.returnPeriodDays).toBe(30);
    expect(result.name).toBeNull();
    expect(result.uncertainFields).toContain("name");
  });

  it("recognizes direct Indian receipt facts without inventing unsupported fields", () => {
    const result = extractReceiptFieldsFromText([
      "Reliance Digital",
      "Wireless Earbuds Rs. 1,599.00",
      "Tax Invoice No: IN-2026-0042",
      "Date: 14/08/2026",
      "Grand Total ₹1,599.00",
    ].join("\n"), 71);

    expect(result.name).toBe("Wireless Earbuds");
    expect(result.purchasedFrom).toBe("Reliance Digital");
    expect(result.invoiceNumber).toBe("IN-2026-0042");
    expect(result.purchasedAt).toBe("2026-08-14");
    expect(result.purchasePrice).toBe(1599);
    expect(result.currency).toBe("INR");
    expect(result.brand).toBeNull();
    expect(result.uncertainFields).toContain("brand");
  });

  it("reads labelled Indian invoice facts and leaves unprinted values reviewable", () => {
    const result = extractReceiptFieldsFromText([
      "Retailer: Croma Retail Ltd",
      "Product: NoiseFit Pulse 2 Max",
      "Brand: Noise",
      "Model No: NFP2M-BLK",
      "Category: Wearables",
      "Tax Invoice No: CR/DEL/2026/0042",
      "Date: 08-09-2026",
      "Warranty: 12 months",
      "Return within 7 days",
      "Net Payable INR 3,499.00",
    ].join("\n"), 86);

    expect(result.name).toBe("NoiseFit Pulse 2 Max");
    expect(result.brand).toBe("Noise");
    expect(result.model).toBe("NFP2M-BLK");
    expect(result.category).toBe("Wearables");
    expect(result.purchasedFrom).toBe("Croma Retail Ltd");
    expect(result.purchasedAt).toBe("2026-09-08");
    expect(result.purchasePrice).toBe(3499);
    expect(result.currency).toBe("INR");
    expect(result.invoiceNumber).toBe("CR/DEL/2026/0042");
    expect(result.warrantyMonths).toBe(12);
    expect(result.returnPeriodDays).toBe(7);
    expect(result.uncertainFields).toContain("serialNumber");
  });

  it("keeps an incomplete receipt low-confidence and reviewable", () => {
    const result = extractReceiptFieldsFromText("Corner shop\nThank you", 31);
    expect(result.confidence).toBeLessThan(70);
    expect(result).toMatchObject({ name: null, brand: null, purchasedAt: null, purchasePrice: null, invoiceNumber: null });
    expect(result.uncertainFields).toEqual(expect.arrayContaining(["name", "purchasedAt", "purchasePrice"]));
  });

  it("repairs the reported Indian total OCR artifact and keeps only supported receipt values", () => {
    const result = extractReceiptFieldsFromText([
      "TECHNOVA RETAIL",
      "#42, Cyber Park, Outer Ring Road",
      "Bangalore - 560103",
      "Invoice No: INV-2026-8834",
      "Date: 18/08/2026",
      "Qty Price",
      "Quantum Wireless Gaming Mouse 1 71,299\"",
      "- Serial No: QMS-99281X",
      "- Warranty: 1 Year (Valid till 18/08/2027)",
      "Subtotal: 71,299",
      "GST (18%): $233.82",
      "TOTAL: 21,532.82",
    ].join("\n"), 82);

    expect(result.purchasedFrom).toBe("TECHNOVA RETAIL");
    expect(result.name).toBe("Quantum Wireless Gaming Mouse");
    expect(result.brand).toBe("Quantum");
    expect(result.category).toBe("Electronics");
    expect(result.model).toBeNull();
    expect(result.invoiceNumber).toBe("INV-2026-8834");
    expect(result.serialNumber).toBe("QMS-99281X");
    expect(result.purchasedAt).toBe("2026-08-18");
    expect(result.purchasePrice).toBe(1532.82);
    expect(result.currency).toBe("INR");
    expect(result.warrantyMonths).toBeNull();
    expect(result.returnPeriodDays).toBeNull();
    expect(result.uncertainFields).toEqual(expect.arrayContaining(["model", "warrantyMonths", "returnPeriodDays"]));
    expect(result.uncertainFields).not.toEqual(expect.arrayContaining(["category", "currency"]));
  });

  it("reconciles the exact stale real-device payload with its retained OCR evidence before review", () => {
    const rawOcrText = [
      "TECHNOVA RETAIL",
      "#42, Cyber Park, Outer Ring Road",
      "Bangalore - 560103",
      "Invoice No: INV-2026-8834",
      "Date: 18/08/2026",
      "Qty Price",
      "Quantum Wireless Gaming Mouse 1 71,299\"",
      "- Serial No: QMS-99281X",
      "- Warranty: 1 Year (Valid till 18/08/2027)",
      "Subtotal: 21,299 |",
      "GST (18%): 7233.82 |",
      "TOTAL: 21,532.82",
    ].join("\n");
    const oldStoredExtraction = {
      ...extractReceiptFieldsFromText(rawOcrText, 88),
      name: "Quantum Wireless Gaming Mouse 1 \"",
      category: "Electronics / Computer Accessories",
      purchasePrice: 21532.82,
      currency: null,
      confidence: 88,
      uncertainFields: ["model", "currency", "warrantyMonths", "returnPeriodDays"],
    };

    const result = normalizeStoredReceiptExtraction(oldStoredExtraction, rawOcrText);

    expect(result).toMatchObject({
      name: "Quantum Wireless Gaming Mouse",
      category: "Electronics",
      purchasePrice: 1532.82,
      currency: "INR",
      purchasedFrom: "TECHNOVA RETAIL",
      invoiceNumber: "INV-2026-8834",
      serialNumber: "QMS-99281X",
      model: null,
      warrantyMonths: null,
      returnPeriodDays: null,
    });
    expect(result.uncertainFields).toEqual(expect.arrayContaining(["model", "warrantyMonths", "returnPeriodDays"]));
    expect(result.uncertainFields).not.toEqual(expect.arrayContaining(["name", "category", "purchasePrice", "currency"]));
  });

  it("preserves an Indian labelled DD/MM/YYYY purchase date through extraction and stored-review normalization", () => {
    const rawOcrText = [
      "DIGITAL WORLD STORE",
      "Mumbai - 400070",
      "Invoice No: DW-99321",
      "Date: 15/08/2026",
      "Qty Price",
      "Quantum Wireless Gaming Mouse 1 1,299",
      "GST (18%): 233.82",
      "TOTAL: 21,532.82",
    ].join("\n");

    const firstPass = extractReceiptFieldsFromText(rawOcrText, 84);
    const retryPass = extractReceiptFieldsFromText(rawOcrText, 84);
    const reloaded = normalizeStoredReceiptExtraction({ ...firstPass, purchasedAt: "2026-08-15" }, rawOcrText);

    expect(firstPass.purchasedAt).toBe("2026-08-15");
    expect(retryPass.purchasedAt).toBe("2026-08-15");
    expect(reloaded.purchasedAt).toBe("2026-08-15");
    expect(firstPass.name).toBe("Quantum Wireless Gaming Mouse");
  });

  it("reads ambiguous DD/MM/YYYY Indian dates as day-first without treating 01/08 as January 8", () => {
    const result = extractReceiptFieldsFromText([
      "Mumbai - 400070",
      "Date: 01/08/2026",
      "GST (18%): 18.00",
      "Total: INR 118.00",
    ].join("\n"), 80);

    expect(result.purchasedAt).toBe("2026-08-01");
  });

  it("leaves an ambiguous numeric date reviewable without Indian receipt evidence", () => {
    const result = extractReceiptFieldsFromText([
      "Example Market",
      "Date: 01/08/2026",
      "Total USD 118.00",
    ].join("\n"), 80);

    expect(result.purchasedAt).toBeNull();
    expect(result.uncertainFields).toContain("purchasedAt");
  });

  it("removes only an unambiguous line-item quantity and preserves legitimate product numbers", () => {
    const noisyMouse = extractReceiptFieldsFromText([
      "Tech Shop",
      "Qty Price",
      "Quantum Wireless Gaming Mouse 1 1,299",
      "Total INR 1,299.00",
    ].join("\n"), 80);
    const numberedProduct = extractReceiptFieldsFromText([
      "Tech Shop",
      "Qty Price",
      "iPhone 15 1 79,999",
      "Total INR 79,999.00",
    ].join("\n"), 80);
    const terminalModelNumber = extractReceiptFieldsFromText([
      "Tech Shop",
      "Qty Price",
      "Device 1 1,799",
      "Total INR 1,799.00",
    ].join("\n"), 80);

    expect(noisyMouse.name).toBe("Quantum Wireless Gaming Mouse");
    expect(numberedProduct.name).toBe("iPhone 15");
    expect(terminalModelNumber.name).toBe("Device 1");
  });

  it("supports INR total formats without treating a currency marker as a digit", () => {
    const totalLines = [
      "Grand Total ₹1,532.82",
      "Net Payable INR 1,532.82",
      "Amount Due Rs. 1,532.82",
      "Balance Due Rs 1,532.82",
    ];

    for (const line of totalLines) {
      const result = extractReceiptFieldsFromText(["Indian Retail", line].join("\n"), 80);
      expect(result.purchasePrice).toBe(1532.82);
      expect(result.currency).toBe("INR");
    }
  });

  it("does not treat GST alone as Indian currency evidence", () => {
    const result = extractReceiptFieldsFromText([
      "Example Market",
      "GST (18%): 233.82",
      "Total: 1,532.82",
    ].join("\n"), 80);

    expect(result.purchasePrice).toBe(1532.82);
    expect(result.currency).toBeNull();
    expect(result.uncertainFields).toContain("currency");
  });

  it("never accepts identifier-like seller values even when a labelled seller line is present", () => {
    const result = extractReceiptFieldsFromText([
      "Seller: 99281X",
      "Serial Number: QMS-99281X",
      "Invoice Number: INV-2026-8834",
      "Total INR 1,532.82",
    ].join("\n"), 80);

    expect(result.purchasedFrom).toBeNull();
    expect(result.serialNumber).toBe("QMS-99281X");
    expect(result.invoiceNumber).toBe("INV-2026-8834");
    expect(result.currency).toBe("INR");
  });
});
