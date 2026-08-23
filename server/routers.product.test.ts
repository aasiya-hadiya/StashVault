import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMock = vi.hoisted(() => ({
  getProductDetailsForUser: vi.fn(),
  listProductsForUser: vi.fn(),
  listDocumentsForUser: vi.fn(),
  updateProductForUser: vi.fn(),
  listConsideredProductsForUser: vi.fn(),
  getBeforeYouBuyContextForUser: vi.fn(),
  createConsideredProductForUser: vi.fn(),
  updateConsideredProductForUser: vi.fn(),
  deleteConsideredProductForUser: vi.fn(),
  compareConsideredProductsForUser: vi.fn(),
  moveConsideredProductToStashForUser: vi.fn(),
}));
const assistantMock = vi.hoisted(() => {
  class StashAssistantError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  }
  return { answerStashQuestion: vi.fn(), StashAssistantError };
});

vi.mock("./db", () => dbMock);
vi.mock("./services/stashAssistant", () => assistantMock);

import { appRouter } from "./routers";

function createUserContext(userId = 42): TrpcContext {
  return {
    user: {
      id: userId,
      openId: "ownership-test-user",
      name: "Ownership Test",
      email: "ownership@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("product router ownership boundary", () => {
  it("uses the authenticated user ID for product-list queries", async () => {
    dbMock.listProductsForUser.mockResolvedValue([]);
    const caller = appRouter.createCaller(createUserContext(42));

    await caller.product.list({ search: "laptop", category: "Electronics" });

    expect(dbMock.listProductsForUser).toHaveBeenCalledWith(42, { search: "laptop", category: "Electronics" });
  });

  it("returns only the authenticated owner's saved lifecycle fields for the repair page", async () => {
    const savedProducts = [{
      id: 24,
      name: "Saved blender",
      brand: "Kitchen Works",
      purchasedAt: "2026-08-15",
      warrantyStatus: "expired",
      warrantyExpiresAt: "2026-08-14",
      returnStatus: "review_needed",
    }];
    dbMock.listProductsForUser.mockResolvedValue(savedProducts);
    const caller = appRouter.createCaller(createUserContext(81));

    await expect(caller.product.list({})).resolves.toEqual(savedProducts);
    expect(dbMock.listProductsForUser).toHaveBeenCalledWith(81, {});
  });

  it("accepts the review-needed warranty filter and rejects the retired missing value", async () => {
    dbMock.listProductsForUser.mockResolvedValue([]);
    const caller = appRouter.createCaller(createUserContext(42));

    await expect(caller.product.list({ warrantyStatus: "review_needed" })).resolves.toEqual([]);
    expect(dbMock.listProductsForUser).toHaveBeenCalledWith(42, { warrantyStatus: "review_needed" });
    await expect(caller.product.list({ warrantyStatus: "missing" as never })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("returns a safe not-found error if the owned-product query returns no record", async () => {
    dbMock.getProductDetailsForUser.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createUserContext(42));

    await expect(caller.product.get({ id: 99 })).rejects.toMatchObject({ code: "NOT_FOUND", message: "We couldn't find this product." });
    expect(dbMock.getProductDetailsForUser).toHaveBeenCalledWith(42, 99);
  });

  it("keeps manually edited warranty and return dates as exact date-only values after reload", async () => {
    const saved = {
      id: 7,
      name: "Quantum Wireless Gaming Mouse",
      category: "Electronics",
      purchasedAt: "2026-08-15",
      warrantyStartsAt: "2026-08-15",
      warrantyExpiresAt: "2027-08-15",
      returnStartsAt: "2026-08-15",
      returnExpiresAt: "2026-08-18",
      returnStatus: "ending_soon",
    };
    dbMock.updateProductForUser.mockResolvedValue(saved);
    dbMock.getProductDetailsForUser.mockResolvedValue(saved);
    const caller = appRouter.createCaller(createUserContext(42));

    await expect(caller.product.update({
      id: 7,
      warrantyStartsAt: "2026-08-15",
      warrantyExpiresAt: "2027-08-15",
      returnStartsAt: "2026-08-15",
      returnExpiresAt: "2026-08-18",
    })).resolves.toMatchObject(saved);
    expect(dbMock.updateProductForUser).toHaveBeenCalledWith(42, 7, expect.objectContaining({
      warrantyStartsAt: "2026-08-15",
      warrantyExpiresAt: "2027-08-15",
      returnStartsAt: "2026-08-15",
      returnExpiresAt: "2026-08-18",
    }));

    await expect(caller.product.get({ id: 7 })).resolves.toMatchObject(saved);
  });

  it("preserves blank manual coverage values without fabricating warranty or return dates", async () => {
    const saved = {
      id: 8,
      name: "Receipt pending coverage",
      category: "Electronics",
      warrantyStartsAt: null,
      warrantyExpiresAt: null,
      returnStartsAt: null,
      returnExpiresAt: null,
      warrantyStatus: "review_needed",
      returnStatus: "review_needed",
    };
    dbMock.updateProductForUser.mockResolvedValue(saved);
    const caller = appRouter.createCaller(createUserContext(42));

    await expect(caller.product.update({
      id: 8,
      warrantyStartsAt: null,
      warrantyExpiresAt: null,
      returnStartsAt: null,
      returnExpiresAt: null,
    })).resolves.toMatchObject(saved);
    expect(dbMock.updateProductForUser).toHaveBeenCalledWith(42, 8, expect.objectContaining({
      warrantyStartsAt: null,
      warrantyExpiresAt: null,
      returnStartsAt: null,
      returnExpiresAt: null,
    }));
  });

  it("uses only the authenticated owner's stored product and documents for claim assistance", async () => {
    dbMock.getProductDetailsForUser.mockResolvedValue({
      product: {
        id: 11,
        name: "Quantum Wireless Gaming Mouse",
        purchasedAt: "2026-08-15",
        serialNumber: "QMS-99281X",
        invoiceNumber: "INV-2026-8834",
        warrantyStatus: "protected",
        warrantyExpiresAt: "2027-08-15",
      },
      documents: [{ documentType: "receipt" }],
    });
    const caller = appRouter.createCaller(createUserContext(73));

    const status = await caller.claimAssistant.status({ productId: 11 });
    expect(dbMock.getProductDetailsForUser).toHaveBeenCalledWith(73, 11);
    expect(status.checklist.find(item => item.key === "proof")?.status).toBe("available");
    expect(status.checklist.find(item => item.key === "warranty-document")?.status).toBe("review_needed");

    const request = await caller.claimAssistant.generate({ productId: 11, issue: "The pointer intermittently stops responding." });
    expect(dbMock.getProductDetailsForUser).toHaveBeenLastCalledWith(73, 11);
    expect(request.request).toContain("Issue: The pointer intermittently stops responding.");
    expect(request.request).toContain("Serial number: QMS-99281X");
    expect(request.request).not.toContain("Warranty document is saved");
  });

  it("does not expose claim assistance when the owned-product lookup returns no product", async () => {
    dbMock.getProductDetailsForUser.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createUserContext(73));
    await expect(caller.claimAssistant.generate({ productId: 404, issue: "It stopped working." })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(dbMock.getProductDetailsForUser).toHaveBeenCalledWith(73, 404);
  });

  it("scopes Ask StashVault evidence to the authenticated user’s products and documents", async () => {
    const savedProducts = [{ id: 16, name: "Owned headset", warrantyStatus: "protected", returnStatus: "active" }];
    const savedDocuments = [{ id: 8, productId: 16, name: "Owned receipt", documentType: "receipt" }];
    dbMock.listProductsForUser.mockResolvedValue(savedProducts);
    dbMock.listDocumentsForUser.mockResolvedValue(savedDocuments);
    assistantMock.answerStashQuestion.mockResolvedValue({ answer: "Your owned headset is covered.", hasSavedProducts: true, sources: [] });
    const caller = appRouter.createCaller(createUserContext(97));

    await expect(caller.stashAssistant.ask({ question: "Which products are covered?" })).resolves.toMatchObject({ answer: "Your owned headset is covered." });
    expect(dbMock.listProductsForUser).toHaveBeenLastCalledWith(97);
    expect(dbMock.listDocumentsForUser).toHaveBeenCalledWith(97);
    expect(assistantMock.answerStashQuestion).toHaveBeenCalledWith(expect.objectContaining({ products: savedProducts, documents: savedDocuments }));
  });

  it("returns a safe retry message when the assistant provider fails", async () => {
    dbMock.listProductsForUser.mockResolvedValue([]);
    dbMock.listDocumentsForUser.mockResolvedValue([]);
    assistantMock.answerStashQuestion.mockRejectedValue(new assistantMock.StashAssistantError("provider_unavailable"));
    const caller = appRouter.createCaller(createUserContext(97));

    try {
      await caller.stashAssistant.ask({ question: "What did I buy recently?" });
      throw new Error("Expected the provider failure to reject.");
    } catch (error) {
      expect(error).toMatchObject({ code: "SERVICE_UNAVAILABLE" });
      expect(error).toHaveProperty("message", "The StashVault AI service is temporarily unavailable. Please try again.");
    }
  });

  it("keeps saved considerations and comparison context scoped to the authenticated user", async () => {
    const context = { considerations: [{ id: 21, name: "Owned consideration" }], ownedCategoryCounts: [{ category: "Electronics", count: 2 }] };
    dbMock.getBeforeYouBuyContextForUser.mockResolvedValue(context);
    dbMock.compareConsideredProductsForUser.mockResolvedValue({ products: [{ id: 21, name: "Owned consideration" }, { id: 22, name: "Second owned consideration" }] });
    const caller = appRouter.createCaller(createUserContext(204));

    await expect(caller.beforeYouBuy.context()).resolves.toEqual(context);
    await expect(caller.beforeYouBuy.compare({ productIds: [21, 22] })).resolves.toMatchObject({ products: [{ id: 21 }, { id: 22 }] });
    expect(dbMock.getBeforeYouBuyContextForUser).toHaveBeenCalledWith(204);
    expect(dbMock.compareConsideredProductsForUser).toHaveBeenCalledWith(204, [21, 22]);
  });

  it("creates, edits, deletes, and moves only the authenticated user's saved consideration", async () => {
    const saved = { id: 31, name: "Considered tablet", category: "Electronics", estimatedPrice: 600, currency: "USD" };
    dbMock.createConsideredProductForUser.mockResolvedValue(saved);
    dbMock.updateConsideredProductForUser.mockResolvedValue({ ...saved, notes: "With keyboard" });
    dbMock.deleteConsideredProductForUser.mockResolvedValue(true);
    dbMock.moveConsideredProductToStashForUser.mockResolvedValue({ id: 88, name: "Considered tablet", category: "Electronics" });
    const caller = appRouter.createCaller(createUserContext(205));

    await expect(caller.beforeYouBuy.create({ name: "Considered tablet", category: "Electronics", estimatedPrice: 600, currency: "USD" })).resolves.toEqual(saved);
    await expect(caller.beforeYouBuy.update({ id: 31, notes: "With keyboard" })).resolves.toMatchObject({ notes: "With keyboard" });
    await expect(caller.beforeYouBuy.delete({ id: 31 })).resolves.toEqual({ success: true });
    await expect(caller.beforeYouBuy.moveToStash({ id: 31 })).resolves.toMatchObject({ id: 88 });

    expect(dbMock.createConsideredProductForUser).toHaveBeenCalledWith(205, expect.objectContaining({ name: "Considered tablet" }));
    expect(dbMock.updateConsideredProductForUser).toHaveBeenCalledWith(205, 31, { notes: "With keyboard" });
    expect(dbMock.deleteConsideredProductForUser).toHaveBeenCalledWith(205, 31);
    expect(dbMock.moveConsideredProductToStashForUser).toHaveBeenCalledWith(205, 31);
  });
});
