import { describe, expect, it, vi } from "vitest";
import { listProductsForUser } from "./db";

describe("product warranty-status filtering", () => {
  it("returns only evidence-safe review-needed coverage and does not accept the retired missing status", async () => {
    const rows = [
      {
        id: 9, userId: 7, name: "Proof pending item", brand: null, model: null, category: "Electronics", description: null,
        purchasePrice: null, currency: "INR", purchasedAt: "2026-08-15", purchasedFrom: null, invoiceNumber: null, serialNumber: null, notes: null,
        warrantyMonths: null, warrantyStartsAt: null, warrantyExpiresAt: null, returnPeriodDays: null, returnStartsAt: null, returnExpiresAt: null,
        imageUrl: null, createdAt: new Date("2026-08-15T12:00:00.000Z"), updatedAt: new Date("2026-08-15T12:00:00.000Z"),
      },
      {
        id: 10, userId: 7, name: "Covered item", brand: null, model: null, category: "Electronics", description: null,
        purchasePrice: null, currency: "INR", purchasedAt: "2026-08-15", purchasedFrom: null, invoiceNumber: null, serialNumber: null, notes: null,
        warrantyMonths: 12, warrantyStartsAt: "2026-08-15", warrantyExpiresAt: "2027-08-15", returnPeriodDays: null, returnStartsAt: null, returnExpiresAt: null,
        imageUrl: null, createdAt: new Date("2026-08-15T12:00:00.000Z"), updatedAt: new Date("2026-08-15T12:00:00.000Z"),
      },
    ];
    const database = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ orderBy: vi.fn(async () => rows) })),
        })),
      })),
    };

    const filtered = await listProductsForUser(7, { warrantyStatus: "review_needed" }, database as never);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({ id: 9, warrantyStatus: "review_needed" });
    expect(filtered.some(product => product.warrantyStatus === ("missing" as never))).toBe(false);
  });
});
