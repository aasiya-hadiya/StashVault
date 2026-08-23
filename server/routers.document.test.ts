import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMock = vi.hoisted(() => ({
  getDocumentForUser: vi.fn(),
  deleteDocumentForUser: vi.fn(),
  getProductForUser: vi.fn(),
}));

vi.mock("./db", () => dbMock);
vi.mock("./storage", () => ({ storageGetSignedUrl: vi.fn() }));

import { appRouter } from "./routers";

function createUserContext(userId = 42): TrpcContext {
  return {
    user: {
      id: userId,
      openId: "document-test-user",
      name: "Document Test",
      email: "document@example.com",
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

describe("document router ownership boundary", () => {
  it("checks the authenticated owner before preparing an upload", async () => {
    dbMock.getProductForUser.mockResolvedValue({ id: 3, userId: 42, name: "Headphones" });
    const caller = appRouter.createCaller(createUserContext(42));

    const result = await caller.document.prepareUpload({ productId: 3, fileName: "invoice.pdf", mimeType: "application/pdf", size: 1024 });

    expect(dbMock.getProductForUser).toHaveBeenCalledWith(42, 3);
    expect(result).toMatchObject({ accepted: true, productId: 3, fileName: "invoice.pdf", mimeType: "application/pdf" });
  });

  it("uses the authenticated user ID and never returns private storage fields", async () => {
    dbMock.getDocumentForUser.mockResolvedValue({
      id: 7,
      productId: 3,
      name: "invoice.pdf",
      fileName: "invoice.pdf",
      documentType: "invoice",
      mimeType: "application/pdf",
      fileKey: "stashly/documents/42/3/invoice.pdf",
      fileUrl: "private-storage-url",
      processingStatus: "not_requested",
      createdAt: new Date(),
    });
    const caller = appRouter.createCaller(createUserContext(42));

    const result = await caller.document.get({ id: 7 });

    expect(dbMock.getDocumentForUser).toHaveBeenCalledWith(42, 7);
    expect(result).toMatchObject({ id: 7, name: "invoice.pdf" });
    expect(result).not.toHaveProperty("fileKey");
    expect(result).not.toHaveProperty("fileUrl");
  });

  it("returns a not-found error when a document does not belong to the signed-in user", async () => {
    dbMock.getDocumentForUser.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createUserContext(42));

    await expect(caller.document.get({ id: 999 })).rejects.toMatchObject({ code: "NOT_FOUND", message: "We couldn't find this document." });
    expect(dbMock.getDocumentForUser).toHaveBeenCalledWith(42, 999);
  });
});
