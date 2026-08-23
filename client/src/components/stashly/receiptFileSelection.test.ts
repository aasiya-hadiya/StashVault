import { describe, expect, it } from "vitest";
import { receiptFileInputSettings, validateReceiptCandidate } from "./receiptFileSelection";

describe("receipt scan file selection", () => {
  it("accepts a receipt dropped or selected from the device when it has a supported file type and size", () => {
    expect(validateReceiptCandidate({ name: "receipt.pdf", type: "application/pdf", size: receiptFileInputSettings.maxBytes } as File)).toMatchObject({ accepted: true });
  });

  it("rejects unsupported files and files larger than 10 MB before scanning", () => {
    expect(validateReceiptCandidate({ name: "receipt.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 100 } as File)).toMatchObject({ accepted: false, message: "Please choose a PDF, JPG, PNG, or WEBP image." });
    expect(validateReceiptCandidate({ name: "large.jpg", type: "image/jpeg", size: receiptFileInputSettings.maxBytes + 1 } as File)).toMatchObject({ accepted: false, message: "This file is too large. Please choose one under 10 MB." });
  });

  it("keeps the camera input restricted to supported image formats and mobile environment capture", () => {
    expect(receiptFileInputSettings.cameraAccept).toBe("image/jpeg,image/png,image/webp");
    expect(receiptFileInputSettings.capture).toBe("environment");
  });
});
