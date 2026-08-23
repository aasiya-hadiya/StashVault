import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import * as db from "./db";
import { storageGetSignedUrl, storageRead } from "./storage";
import { DocumentUploadValidationError, MAX_DOCUMENT_BYTES, storeDocumentUpload, storeReceiptUpload } from "./services/documentUpload";
import { extractReceiptWithDiagnostics } from "./services/receiptExtraction";
import { buildClaimAssistantState, generateClaimRequest } from "./services/claimAssistant";
import { answerStashQuestion, StashAssistantError } from "./services/stashAssistant";
import { buildDocumentExport } from "./services/documentExport";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const idSchema = z.object({ id: z.number().int().positive() });
const nullableText = z.string().trim().max(2000).nullable().optional();
const dateField = z.coerce.date().nullable().optional();
const dateOnlyField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.").refine(value => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Use a real calendar date.").nullable().optional();
const warrantyStatusSchema = z.enum(["protected", "expiring", "expired", "review_needed"]);
const returnStatusSchema = z.enum(["active", "expiring", "expired", "review_needed"]);
const urgencySchema = z.enum(["none", "soon", "attention"]);
const productStatusSchema = z.enum(["protected", "expiring", "action_required", "missing_information", "expired"]);
const documentTypeSchema = z.enum(["invoice", "receipt", "warranty", "service_record", "other"]);
const documentUploadSchema = z.object({
  productId: z.number().int().positive(),
  documentType: documentTypeSchema,
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(1).max(Math.ceil((MAX_DOCUMENT_BYTES * 4) / 3) + 4_096),
});
const documentPrepareUploadSchema = z.object({
  productId: z.number().int().positive(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(MAX_DOCUMENT_BYTES, "This file is too large. Please upload a file under 10 MB."),
});
const receiptUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(MAX_DOCUMENT_BYTES, "This file is too large. Please upload a file under 10 MB."),
});
const receiptScanSchema = receiptUploadSchema.extend({
  base64: z.string().min(1).max(Math.ceil((MAX_DOCUMENT_BYTES * 4) / 3) + 4_096),
});

const productFields = {
  name: z.string().trim().min(1, "Give this item a name.").max(255),
  brand: z.string().trim().max(120).nullable().optional(),
  model: z.string().trim().max(160).nullable().optional(),
  category: z.string().trim().min(1, "Choose a category.").max(80),
 description: nullableText,
 purchasePrice: z.coerce.number().min(0, "Price cannot be negative.").max(99_999_999).nullable().optional(),
 currency: z.string().trim().length(3, "Use a three-letter currency code.").optional(),
  purchasedAt: dateOnlyField,
 purchasedFrom: z.string().trim().max(255).nullable().optional(),
 invoiceNumber: z.string().trim().max(160).nullable().optional(),
 serialNumber: z.string().trim().max(160).nullable().optional(),
 notes: nullableText,
 warrantyMonths: z.coerce.number().int().min(0).max(240).nullable().optional(),
  warrantyStartsAt: dateOnlyField,
  warrantyExpiresAt: dateOnlyField,
 returnPeriodDays: z.coerce.number().int().min(0).max(365).nullable().optional(),
  returnStartsAt: dateOnlyField,
  returnExpiresAt: dateOnlyField,
 imageUrl: z.string().url().max(2048).nullable().optional(),
};

const createProductSchema = z.object(productFields).superRefine((value, context) => {
  const warrantyStart = value.warrantyStartsAt ?? value.purchasedAt;
  const returnStart = value.returnStartsAt ?? value.purchasedAt;
  if (warrantyStart && value.warrantyExpiresAt && value.warrantyExpiresAt < warrantyStart) context.addIssue({ code: "custom", path: ["warrantyExpiresAt"], message: "Warranty expiry must follow its start date." });
  if (returnStart && value.returnExpiresAt && value.returnExpiresAt < returnStart) context.addIssue({ code: "custom", path: ["returnExpiresAt"], message: "Return expiry must follow its start date." });
});

const updateProductSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(255).optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  model: z.string().trim().max(160).nullable().optional(),
  category: z.string().trim().min(1).max(80).optional(),
 description: nullableText,
 purchasePrice: z.coerce.number().min(0).max(99_999_999).nullable().optional(),
 currency: z.string().trim().length(3).optional(),
  purchasedAt: dateOnlyField,
 purchasedFrom: z.string().trim().max(255).nullable().optional(),
  invoiceNumber: z.string().trim().max(160).nullable().optional(),
  serialNumber: z.string().trim().max(160).nullable().optional(),
  notes: nullableText,
  warrantyMonths: z.coerce.number().int().min(0).max(240).nullable().optional(),
  warrantyStartsAt: dateOnlyField,
  warrantyExpiresAt: dateOnlyField,
  returnPeriodDays: z.coerce.number().int().min(0).max(365).nullable().optional(),
  returnStartsAt: dateOnlyField,
  returnExpiresAt: dateOnlyField,
  imageUrl: z.string().url().max(2048).nullable().optional(),
}).superRefine((value, context) => {
  const warrantyStart = value.warrantyStartsAt ?? value.purchasedAt;
  const returnStart = value.returnStartsAt ?? value.purchasedAt;
  if (warrantyStart && value.warrantyExpiresAt && value.warrantyExpiresAt < warrantyStart) context.addIssue({ code: "custom", path: ["warrantyExpiresAt"], message: "Warranty expiry must follow its start date." });
  if (returnStart && value.returnExpiresAt && value.returnExpiresAt < returnStart) context.addIssue({ code: "custom", path: ["returnExpiresAt"], message: "Return expiry must follow its start date." });
});

const listProductsSchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  status: productStatusSchema.optional(),
  warrantyStatus: warrantyStatusSchema.optional(),
  returnStatus: returnStatusSchema.optional(),
  urgency: urgencySchema.optional(),
}).optional();

const claimAssistantInput = z.object({
  productId: z.number().int().positive(),
  issue: z.string().trim().min(3, "Describe what went wrong in a few words.").max(2_000),
});
const stashAssistantInput = z.object({
  question: z.string().trim().min(1, "Ask a question about your StashVault.").max(2_000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2_000) })).max(8).optional(),
});
const consideredProductFields = {
  name: z.string().trim().min(1, "Give this item a name.").max(255),
  brand: z.string().trim().max(120).nullable().optional(),
  model: z.string().trim().max(160).nullable().optional(),
  category: z.string().trim().min(1, "Choose a category.").max(80),
  estimatedPrice: z.coerce.number().min(0, "Estimated cost cannot be negative.").max(99_999_999).nullable().optional(),
  currency: z.string().trim().length(3, "Use a three-letter currency code.").optional(),
  plannedOwnershipMonths: z.coerce.number().int().min(1).max(600).nullable().optional(),
  expectedWarrantyMonths: z.coerce.number().int().min(0).max(240).nullable().optional(),
  repairabilityNotes: nullableText,
  expectedResaleValue: z.coerce.number().min(0, "Expected resale value cannot be negative.").max(99_999_999).nullable().optional(),
  expectedResaleValueAtMonths: z.coerce.number().int().min(1).max(600).nullable().optional(),
  notes: nullableText,
};
const createConsideredProductSchema = z.object(consideredProductFields);
const updateConsideredProductSchema = z.object({
  id: z.number().int().positive(),
  name: consideredProductFields.name.optional(),
  brand: consideredProductFields.brand,
  model: consideredProductFields.model,
  category: consideredProductFields.category.optional(),
  estimatedPrice: consideredProductFields.estimatedPrice,
  currency: consideredProductFields.currency,
  plannedOwnershipMonths: consideredProductFields.plannedOwnershipMonths,
  expectedWarrantyMonths: consideredProductFields.expectedWarrantyMonths,
  repairabilityNotes: consideredProductFields.repairabilityNotes,
  expectedResaleValue: consideredProductFields.expectedResaleValue,
  expectedResaleValueAtMonths: consideredProductFields.expectedResaleValueAtMonths,
  notes: consideredProductFields.notes,
});
const compareConsideredProductsSchema = z.object({
  productIds: z.array(z.number().int().positive()).length(2, "Choose exactly two items to compare.").refine(ids => ids[0] !== ids[1], "Choose two different items to compare."),
});
const displayNameSchema = z.string().trim().min(1, "Enter the name you want StashVault to use.").max(120, "Use 120 characters or fewer.");
const notificationPreferencesSchema = z.object({
  warrantyExpiry: z.boolean(),
  returnPeriod: z.boolean(),
  generalReminders: z.boolean(),
});

async function safely<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    console.error("[Stashly API]", error);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "We couldn't reach your stash right now. Please try again." });
  }
}

function notFound(message = "We couldn't find this product."): never {
  throw new TRPCError({ code: "NOT_FOUND", message });
}

function documentMetadata(document: Awaited<ReturnType<typeof db.getDocumentForUser>>) {
  if (!document) return undefined;
  const { fileKey, fileUrl, ...metadata } = document;
  return metadata;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    summary: protectedProcedure.query(({ ctx }) => safely(() => db.getDashboardForUser(ctx.user.id))),
  }),
  settings: router({
    get: protectedProcedure.query(({ ctx }) => safely(async () => {
      const profile = await db.getSettingsProfileForUser(ctx.user.id);
      return profile ?? notFound("We couldn't find your account settings.");
    })),
    updateDisplayName: protectedProcedure.input(z.object({ displayName: displayNameSchema })).mutation(({ ctx, input }) => safely(async () => {
      const profile = await db.updateDisplayNameForUser(ctx.user.id, input.displayName);
      return profile ?? notFound("We couldn't update your account settings.");
    })),
    updateNotificationPreferences: protectedProcedure.input(notificationPreferencesSchema).mutation(({ ctx, input }) => safely(async () => {
      const profile = await db.updateNotificationPreferencesForUser(ctx.user.id, input);
      return profile ?? notFound("We couldn't update your notification preferences.");
    })),
  }),
  product: router({
    list: protectedProcedure.input(listProductsSchema).query(({ ctx, input }) => safely(() => db.listProductsForUser(ctx.user.id, input))),
    get: protectedProcedure.input(idSchema).query(({ ctx, input }) => safely(async () => {
      const product = await db.getProductDetailsForUser(ctx.user.id, input.id);
      return product ?? notFound();
    })),
    create: protectedProcedure.input(createProductSchema).mutation(({ ctx, input }) => safely(async () => {
      const product = await db.createProductForUser(ctx.user.id, input);
      if (!product) notFound("We couldn't save this product.");
      return product;
    })),
    update: protectedProcedure.input(updateProductSchema).mutation(({ ctx, input }) => safely(async () => {
      const { id, ...patch } = input;
      const product = await db.updateProductForUser(ctx.user.id, id, patch);
      if (!product) notFound();
      return product;
    })),
    delete: protectedProcedure.input(idSchema).mutation(({ ctx, input }) => safely(async () => {
      if (!(await db.deleteProductForUser(ctx.user.id, input.id))) notFound();
      return { success: true } as const;
    })),
    seedDemo: protectedProcedure.mutation(({ ctx }) => safely(() => db.seedDemoProductsForUser(ctx.user.id))),
  }),
  claimAssistant: router({
    status: protectedProcedure.input(z.object({ productId: z.number().int().positive() })).query(({ ctx, input }) => safely(async () => {
      const detail = await db.getProductDetailsForUser(ctx.user.id, input.productId);
      if (!detail) notFound();
      return buildClaimAssistantState({ product: detail.product, documents: detail.documents });
    })),
    generate: protectedProcedure.input(claimAssistantInput).mutation(({ ctx, input }) => safely(async () => {
      const detail = await db.getProductDetailsForUser(ctx.user.id, input.productId);
      if (!detail) notFound();
      return generateClaimRequest({ product: detail.product, documents: detail.documents, issue: input.issue });
    })),
  }),
  stashAssistant: router({
    ask: protectedProcedure.input(stashAssistantInput).mutation(({ ctx, input }) => safely(async () => {
      try {
        const [products, documents, considerations] = await Promise.all([
          db.listProductsForUser(ctx.user.id),
          db.listDocumentsForUser(ctx.user.id),
          db.listConsideredProductsForUser(ctx.user.id),
        ]);
        return await answerStashQuestion({ ...input, products, documents, considerations });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof StashAssistantError) {
          console.error(`[Ask StashVault] failure=${error.code}`);
          const message = error.code === "configuration"
            ? "The StashVault AI service needs configuration. Your saved data has not changed."
            : error.code === "empty_response"
              ? "The StashVault AI service returned no answer. Please try again."
              : "The StashVault AI service is temporarily unavailable. Please try again.";
          throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message });
        }
        console.error("[Ask StashVault] failure=unexpected");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "StashVault couldn't answer right now. Your saved data has not changed." });
      }
    })),
  }),
  beforeYouBuy: router({
    context: protectedProcedure.query(({ ctx }) => safely(() => db.getBeforeYouBuyContextForUser(ctx.user.id))),
    create: protectedProcedure.input(createConsideredProductSchema).mutation(({ ctx, input }) => safely(async () => {
      const product = await db.createConsideredProductForUser(ctx.user.id, input);
      if (!product) notFound("We couldn't save this item.");
      return product;
    })),
    update: protectedProcedure.input(updateConsideredProductSchema).mutation(({ ctx, input }) => safely(async () => {
      const { id, ...patch } = input;
      const product = await db.updateConsideredProductForUser(ctx.user.id, id, patch);
      if (!product) notFound("We couldn't find this item.");
      return product;
    })),
    delete: protectedProcedure.input(idSchema).mutation(({ ctx, input }) => safely(async () => {
      if (!(await db.deleteConsideredProductForUser(ctx.user.id, input.id))) notFound("We couldn't find this item.");
      return { success: true } as const;
    })),
    compare: protectedProcedure.input(compareConsideredProductsSchema).query(({ ctx, input }) => safely(async () => {
      const comparison = await db.compareConsideredProductsForUser(ctx.user.id, [input.productIds[0], input.productIds[1]]);
      if (!comparison) notFound("Choose two saved items to compare.");
      return comparison;
    })),
    moveToStash: protectedProcedure.input(idSchema).mutation(({ ctx, input }) => safely(async () => {
      const product = await db.moveConsideredProductToStashForUser(ctx.user.id, input.id);
      if (!product) notFound("We couldn't move this item to your Stash.");
      return product;
    })),
  }),
  document: router({
    list: protectedProcedure.input(z.object({ productId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => safely(() => db.listDocumentsForUser(ctx.user.id, input?.productId))),
    exportCsv: protectedProcedure.query(({ ctx }) => safely(async () => buildDocumentExport(await db.listDocumentExportForUser(ctx.user.id)))),
    get: protectedProcedure.input(idSchema).query(({ ctx, input }) => safely(async () => documentMetadata(await db.getDocumentForUser(ctx.user.id, input.id)) ?? notFound("We couldn't find this document."))),
    prepareUpload: protectedProcedure.input(documentPrepareUploadSchema).mutation(({ ctx, input }) => safely(async () => {
      if (!(await db.getProductForUser(ctx.user.id, input.productId))) notFound("We couldn't find this product.");
      return { accepted: true as const, productId: input.productId, maxBytes: MAX_DOCUMENT_BYTES, fileName: input.fileName, mimeType: input.mimeType };
    })),
    accessUrl: protectedProcedure.input(idSchema).query(({ ctx, input }) => safely(async () => {
      const document = await db.getDocumentForUser(ctx.user.id, input.id);
      if (!document) notFound("We couldn't find this document.");
      return { url: await storageGetSignedUrl(document.fileKey), fileName: document.fileName ?? document.name };
    })),
    upload: protectedProcedure.input(documentUploadSchema).mutation(({ ctx, input }) => safely(async () => {
      if (!(await db.getProductForUser(ctx.user.id, input.productId))) notFound("We couldn't find this product.");
      try {
        const stored = await storeDocumentUpload({ userId: ctx.user.id, productId: input.productId, fileName: input.fileName, mimeType: input.mimeType, base64: input.base64 });
        const document = await db.createDocumentForUser(ctx.user.id, { productId: input.productId, name: stored.fileName, documentType: input.documentType, fileKey: stored.key, fileUrl: stored.url, mimeType: input.mimeType });
        return document ?? notFound("You don't have permission to add this document.");
      } catch (error) {
        if (error instanceof DocumentUploadValidationError) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        throw error;
      }
    })),
    delete: protectedProcedure.input(idSchema).mutation(({ ctx, input }) => safely(async () => {
      if (!(await db.deleteDocumentForUser(ctx.user.id, input.id))) notFound("We couldn't find this document.");
      return { success: true } as const;
    })),
  }),
  receipt: router({
    prepare: protectedProcedure.input(receiptUploadSchema).mutation(({ input }) => ({ accepted: true as const, maxBytes: MAX_DOCUMENT_BYTES, fileName: input.fileName, mimeType: input.mimeType })),
    scan: protectedProcedure.input(receiptScanSchema).mutation(({ ctx, input }) => safely(async () => {
      try {
        const stored = await storeReceiptUpload({ userId: ctx.user.id, fileName: input.fileName, mimeType: input.mimeType, base64: input.base64 });
        const document = await db.createReceiptForExtraction(ctx.user.id, { name: stored.fileName, fileKey: stored.key, fileUrl: stored.url, mimeType: input.mimeType });
        if (!document) notFound("We couldn't save this receipt.");
        const result = await extractReceiptWithDiagnostics({ bytes: stored.bytes, mimeType: input.mimeType });
        const review = await db.saveReceiptExtractionForUser(ctx.user.id, document.id, result.extraction, result.extraction.source === "ocr" ? "tesseract-ocr + gpt-5-mini" : undefined, result.rawOcrText);
        return review ?? notFound("We couldn't prepare this receipt for review.");
      } catch (error) {
        if (error instanceof DocumentUploadValidationError) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        throw error;
      }
    })),
    getReview: protectedProcedure.input(idSchema).query(({ ctx, input }) => safely(async () => {
      const review = await db.getReceiptReviewForUser(ctx.user.id, input.id);
      return review ?? notFound("We couldn't find this receipt review.");
    })),
    retry: protectedProcedure.input(idSchema).mutation(({ ctx, input }) => safely(async () => {
      const document = await db.getDocumentForUser(ctx.user.id, input.id);
      if (!document || document.documentType !== "receipt" || document.productId) notFound("We couldn't find an unconfirmed receipt to read again.");
      const bytes = await storageRead(document.fileKey);
      const result = await extractReceiptWithDiagnostics({ bytes, mimeType: document.mimeType ?? "image/jpeg" });
      const review = await db.saveReceiptExtractionForUser(ctx.user.id, document.id, result.extraction, result.extraction.source === "ocr" ? "tesseract-ocr + gpt-5-mini" : undefined, result.rawOcrText);
      return review ?? notFound("We couldn't prepare this receipt for review.");
    })),
    confirm: protectedProcedure.input(z.object({ documentId: z.number().int().positive(), product: createProductSchema })).mutation(({ ctx, input }) => safely(async () => {
      const product = await db.confirmReceiptReviewForUser(ctx.user.id, input.documentId, input.product);
      return product ?? notFound("This receipt is no longer available to confirm.");
    })),
  }),
  ownershipEvent: router({
    list: protectedProcedure.input(z.object({ productId: z.number().int().positive() })).query(({ ctx, input }) => safely(async () => {
      if (!(await db.getProductForUser(ctx.user.id, input.productId))) notFound();
      return db.listOwnershipEventsForUser(ctx.user.id, input.productId);
    })),
  }),
  reminder: router({
    list: protectedProcedure.input(z.object({ productId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => safely(() => db.listRemindersForUser(ctx.user.id, input?.productId))),
    dismiss: protectedProcedure.input(idSchema).mutation(({ ctx, input }) => safely(async () => {
      if (!(await db.dismissReminderForUser(ctx.user.id, input.id))) notFound("We couldn't find this reminder.");
      return { success: true } as const;
    })),
  }),
  serviceRecord: router({
    list: protectedProcedure.input(z.object({ productId: z.number().int().positive() })).query(({ ctx, input }) => safely(async () => {
      if (!(await db.getProductForUser(ctx.user.id, input.productId))) notFound();
      return db.listServiceRecordsForUser(ctx.user.id, input.productId);
    })),
    create: protectedProcedure.input(z.object({
      productId: z.number().int().positive(),
      provider: z.string().trim().max(255).nullable().optional(),
      issue: z.string().trim().min(1).max(500),
      status: z.enum(["reported", "claim_preparing", "submitted", "in_progress", "resolved", "open", "scheduled", "completed", "cancelled"]).optional(),
      cost: z.coerce.number().min(0).max(99_999_999).nullable().optional(),
      servicedAt: dateField,
      notes: nullableText,
    })).mutation(({ ctx, input }) => safely(async () => db.createServiceRecordForUser(ctx.user.id, input) ?? notFound("You don't have permission to add a service record to this item."))),
  }),
});

export type AppRouter = typeof appRouter;
