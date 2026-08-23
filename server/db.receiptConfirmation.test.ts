import { describe, expect, it, vi } from "vitest";
import { documents, ownershipEvents, products } from "../drizzle/schema";
import { writeReceiptConfirmationTransaction, type ReceiptConfirmationTransaction } from "./db";

describe("receipt confirmation transaction", () => {
  it("creates the product, links the retained receipt, marks review completion, and records both ownership events", async () => {
    const productValues = vi.fn().mockResolvedValue([{ insertId: 71 }]);
    const eventValues = vi.fn().mockResolvedValue({});
    const linkedWhere = vi.fn().mockResolvedValue({});
    const documentSet = vi.fn().mockReturnValue({ where: linkedWhere });
    const transaction = {
      insert: vi.fn((table: unknown) => ({ values: table === products ? productValues : eventValues })),
      update: vi.fn((table: unknown) => {
        expect(table).toBe(documents);
        return { set: documentSet };
      }),
    } as unknown as ReceiptConfirmationTransaction;
    const now = new Date("2026-08-14T12:00:00.000Z");

    const productId = await writeReceiptConfirmationTransaction(transaction, {
      userId: 12,
      documentId: 44,
      documentName: "camera-receipt.pdf",
      input: {
        name: "Camera",
        category: "Photography",
        purchasedFrom: "Archive Photo",
        purchasedAt: "2026-08-15",
        warrantyMonths: 12,
        warrantyStartsAt: "2026-08-15",
        warrantyExpiresAt: "2027-08-15",
        returnPeriodDays: 30,
        returnStartsAt: "2026-08-15",
        returnExpiresAt: "2026-09-14",
      },
      now,
    });

    expect(productId).toBe(71);
    expect(productValues).toHaveBeenCalledWith(expect.objectContaining({
      userId: 12,
      name: "Camera",
      category: "Photography",
      purchasedFrom: "Archive Photo",
      purchasedAt: "2026-08-15",
      warrantyMonths: 12,
      warrantyStartsAt: "2026-08-15",
      warrantyExpiresAt: "2027-08-15",
      returnPeriodDays: 30,
      returnStartsAt: "2026-08-15",
      returnExpiresAt: "2026-09-14",
    }));
    expect(documentSet).toHaveBeenCalledWith(expect.objectContaining({ productId: 71, processingStatus: "completed", extractionReviewedAt: now }));
    expect(eventValues).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ productId: 71, eventType: "purchased", title: "Purchased", eventDate: new Date("2026-08-15T12:00:00.000Z") }),
      expect.objectContaining({ productId: 71, eventType: "document_added", title: "Receipt confirmed", description: "Linked camera-receipt.pdf after receipt review" }),
    ]));
    expect(transaction.insert).toHaveBeenCalledWith(ownershipEvents);
  });
});
