import { describe, expect, it, vi } from "vitest";
import { type ProductInput, updateProductForUser } from "./db";
import { products } from "../drizzle/schema";

describe("manual warranty and return date persistence", () => {
  it("keeps exact date-only coverage edits through the real update helper save-and-reload path", async () => {
    const row = {
      id: 44,
      userId: 7,
      name: "Quantum Wireless Gaming Mouse",
      brand: "Quantum",
      model: null,
      category: "Electronics",
      description: null,
      purchasePrice: "1532.82",
      currency: "INR",
      purchasedAt: "2026-08-15",
      purchasedFrom: "TECHNOVA RETAIL",
      invoiceNumber: "INV-2026-8834",
      serialNumber: "QMS-99281X",
      notes: null,
      warrantyMonths: null,
      warrantyStartsAt: null,
      warrantyExpiresAt: null,
      returnPeriodDays: null,
      returnStartsAt: null,
      returnExpiresAt: null,
      imageUrl: null,
      createdAt: new Date("2026-08-15T12:00:00.000Z"),
      updatedAt: new Date("2026-08-15T12:00:00.000Z"),
    } as typeof products.$inferSelect;
    const database = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(async () => [row]) })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((values: Record<string, unknown>) => ({
          where: vi.fn(async () => Object.assign(row, values)),
        })),
      })),
      insert: vi.fn(() => ({ values: vi.fn(async () => ({})) })),
    };
    const manualEdit: ProductInput = {
      name: row.name,
      category: row.category,
      warrantyStartsAt: "2026-08-15",
      warrantyExpiresAt: "2027-08-15",
      returnStartsAt: "2026-08-15",
      returnExpiresAt: "2026-08-18",
    };

    const reloaded = await updateProductForUser(7, 44, manualEdit, database as never);

    expect(reloaded).toMatchObject({
      warrantyStartsAt: "2026-08-15",
      warrantyExpiresAt: "2027-08-15",
      returnStartsAt: "2026-08-15",
      returnExpiresAt: "2026-08-18",
    });
    const cleared = await updateProductForUser(7, 44, {
      warrantyMonths: null,
      warrantyStartsAt: null,
      warrantyExpiresAt: null,
      returnPeriodDays: null,
      returnStartsAt: null,
      returnExpiresAt: null,
    }, database as never);

    expect(cleared).toMatchObject({
      warrantyExpiresAt: null,
      returnExpiresAt: null,
      warrantyStatus: "review_needed",
      returnStatus: "review_needed",
    });
  });
});
