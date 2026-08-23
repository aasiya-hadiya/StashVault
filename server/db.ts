import { and, count, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { consideredProducts, documents, InsertUser, ownershipEvents, products, reminders, serviceRecords, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getProductStatus } from "./services/productStatus";
import { normalizeStoredReceiptExtraction } from "./services/receiptExtraction";
import { addDateOnlyDays, addDateOnlyMonths, isDateOnly } from "./services/warrantyReturn";
import { buildConsideredProductView, compareConsideredProducts, type ConsideredProductInput, type ConsideredProductRow } from "./services/beforeYouBuy";
import { dashboardNotificationEnabled, type NotificationPreferences } from "./services/notificationPreferences";
import type { DocumentExportSource } from "./services/documentExport";

let _db: ReturnType<typeof drizzle> | null = null;

export type ProductInput = {
  name: string;
  brand?: string | null;
  model?: string | null;
  category: string;
  description?: string | null;
  purchasePrice?: number | null;
  currency?: string;
  purchasedAt?: string | null;
  purchasedFrom?: string | null;
  invoiceNumber?: string | null;
  serialNumber?: string | null;
  notes?: string | null;
  warrantyMonths?: number | null;
  warrantyStartsAt?: string | null;
  warrantyExpiresAt?: string | null;
  returnPeriodDays?: number | null;
  returnStartsAt?: string | null;
  returnExpiresAt?: string | null;
  imageUrl?: string | null;
};

export type ReceiptConfirmationInput = ProductInput;

export type ProductFilters = {
  search?: string;
  category?: string;
  status?: "protected" | "expiring" | "action_required" | "missing_information" | "expired";
  warrantyStatus?: "protected" | "expiring" | "expired" | "review_needed";
  returnStatus?: "active" | "expiring" | "expired" | "review_needed";
  urgency?: "none" | "soon" | "attention";
};

export type { ConsideredProductInput } from "./services/beforeYouBuy";

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

type ProductDataClient = Pick<NonNullable<Awaited<ReturnType<typeof getDb>>>, "select" | "update" | "insert">;

function databaseUnavailable() {
  return new Error("StashVault database is unavailable");
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export type { NotificationPreferences } from "./services/notificationPreferences";

export type SettingsProfile = {
  displayName: string;
  email: string | null;
  notificationPreferences: NotificationPreferences;
};

const defaultNotificationPreferences: NotificationPreferences = {
  warrantyExpiry: true,
  returnPeriod: true,
  generalReminders: true,
};

function settingsProfileForUser(user: typeof users.$inferSelect): SettingsProfile {
  return {
    displayName: user.displayName ?? user.name ?? "",
    email: user.email ?? null,
    notificationPreferences: {
      warrantyExpiry: user.warrantyNotificationsEnabled === 1,
      returnPeriod: user.returnNotificationsEnabled === 1,
      generalReminders: user.generalNotificationsEnabled === 1,
    },
  };
}

export async function getSettingsProfileForUser(userId: number) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0] ? settingsProfileForUser(result[0]) : undefined;
}

export async function updateDisplayNameForUser(userId: number, displayName: string) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  await db.update(users).set({ displayName }).where(eq(users.id, userId));
  return getSettingsProfileForUser(userId);
}

export async function updateNotificationPreferencesForUser(userId: number, preferences: NotificationPreferences) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  await db.update(users).set({
    warrantyNotificationsEnabled: preferences.warrantyExpiry ? 1 : 0,
    returnNotificationsEnabled: preferences.returnPeriod ? 1 : 0,
    generalNotificationsEnabled: preferences.generalReminders ? 1 : 0,
  }).where(eq(users.id, userId));
  return getSettingsProfileForUser(userId);
}

export function deriveProductDates(input: ProductInput, existing?: typeof products.$inferSelect) {
  const purchasedAt = input.purchasedAt === undefined ? existing?.purchasedAt ?? null : input.purchasedAt;
  const warrantyMonths = input.warrantyMonths === undefined ? existing?.warrantyMonths ?? null : input.warrantyMonths;
  const returnPeriodDays = input.returnPeriodDays === undefined ? existing?.returnPeriodDays ?? null : input.returnPeriodDays;
  const warrantyStartsAt = input.warrantyStartsAt === undefined ? existing?.warrantyStartsAt ?? null : input.warrantyStartsAt;
  const returnStartsAt = input.returnStartsAt === undefined ? existing?.returnStartsAt ?? null : input.returnStartsAt;
  const warrantyChanged = input.warrantyMonths !== undefined || input.warrantyStartsAt !== undefined || input.purchasedAt !== undefined;
  const returnChanged = input.returnPeriodDays !== undefined || input.returnStartsAt !== undefined || input.purchasedAt !== undefined;
  const warrantyStart = warrantyStartsAt ?? purchasedAt;
  const returnStart = returnStartsAt ?? purchasedAt;
  const warrantyExpiresAt = input.warrantyExpiresAt === undefined
    ? warrantyChanged && warrantyStart && warrantyMonths ? addDateOnlyMonths(warrantyStart, warrantyMonths) : existing?.warrantyExpiresAt ?? null
    : input.warrantyExpiresAt;
  const returnExpiresAt = input.returnExpiresAt === undefined
    ? returnChanged && returnStart && returnPeriodDays ? addDateOnlyDays(returnStart, returnPeriodDays) : existing?.returnExpiresAt ?? null
    : input.returnExpiresAt;
  return { purchasedAt, warrantyMonths, warrantyStartsAt, warrantyExpiresAt, returnPeriodDays, returnStartsAt, returnExpiresAt };
}

export function toProductView(product: typeof products.$inferSelect) {
  return {
    ...product,
    purchasePrice: product.purchasePrice === null ? null : Number(product.purchasePrice),
    ...getProductStatus(product),
  };
}

export function toDocumentView(document: typeof documents.$inferSelect) {
  const { fileKey, fileUrl, ...metadata } = document;
  return metadata;
}

function toConsideredProductRow(product: typeof consideredProducts.$inferSelect): ConsideredProductRow {
  return {
    ...product,
    estimatedPrice: product.estimatedPrice === null ? null : Number(product.estimatedPrice),
    expectedResaleValue: product.expectedResaleValue === null ? null : Number(product.expectedResaleValue),
  };
}

async function findConsideredProductRecord(userId: number, productId: number) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const result = await db.select().from(consideredProducts).where(and(eq(consideredProducts.id, productId), eq(consideredProducts.userId, userId))).limit(1);
  return result[0];
}

export async function listConsideredProductsForUser(userId: number) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const result = await db.select().from(consideredProducts).where(eq(consideredProducts.userId, userId)).orderBy(desc(consideredProducts.createdAt));
  return result.map(toConsideredProductRow).map(buildConsideredProductView);
}

export async function getConsideredProductForUser(userId: number, productId: number) {
  const product = await findConsideredProductRecord(userId, productId);
  return product ? buildConsideredProductView(toConsideredProductRow(product)) : undefined;
}

function consideredProductValues(input: ConsideredProductInput) {
  return {
    name: input.name.trim(),
    brand: input.brand?.trim() || null,
    model: input.model?.trim() || null,
    category: input.category.trim(),
    estimatedPrice: input.estimatedPrice === null || input.estimatedPrice === undefined ? null : String(input.estimatedPrice),
    currency: input.currency?.trim().toUpperCase() || "USD",
    plannedOwnershipMonths: input.plannedOwnershipMonths ?? null,
    expectedWarrantyMonths: input.expectedWarrantyMonths ?? null,
    repairabilityNotes: input.repairabilityNotes?.trim() || null,
    expectedResaleValue: input.expectedResaleValue === null || input.expectedResaleValue === undefined ? null : String(input.expectedResaleValue),
    expectedResaleValueAtMonths: input.expectedResaleValueAtMonths ?? null,
    notes: input.notes?.trim() || null,
  };
}

export async function createConsideredProductForUser(userId: number, input: ConsideredProductInput) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const inserted = await db.insert(consideredProducts).values({ userId, ...consideredProductValues(input) });
  return getConsideredProductForUser(userId, Number(inserted[0].insertId));
}

export async function updateConsideredProductForUser(userId: number, productId: number, patch: Partial<ConsideredProductInput>) {
  const existing = await findConsideredProductRecord(userId, productId);
  if (!existing) return undefined;
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const merged: ConsideredProductInput = {
    name: patch.name ?? existing.name,
    brand: patch.brand === undefined ? existing.brand : patch.brand,
    model: patch.model === undefined ? existing.model : patch.model,
    category: patch.category ?? existing.category,
    estimatedPrice: patch.estimatedPrice === undefined ? (existing.estimatedPrice === null ? null : Number(existing.estimatedPrice)) : patch.estimatedPrice,
    currency: patch.currency ?? existing.currency,
    plannedOwnershipMonths: patch.plannedOwnershipMonths === undefined ? existing.plannedOwnershipMonths : patch.plannedOwnershipMonths,
    expectedWarrantyMonths: patch.expectedWarrantyMonths === undefined ? existing.expectedWarrantyMonths : patch.expectedWarrantyMonths,
    repairabilityNotes: patch.repairabilityNotes === undefined ? existing.repairabilityNotes : patch.repairabilityNotes,
    expectedResaleValue: patch.expectedResaleValue === undefined ? (existing.expectedResaleValue === null ? null : Number(existing.expectedResaleValue)) : patch.expectedResaleValue,
    expectedResaleValueAtMonths: patch.expectedResaleValueAtMonths === undefined ? existing.expectedResaleValueAtMonths : patch.expectedResaleValueAtMonths,
    notes: patch.notes === undefined ? existing.notes : patch.notes,
  };
  await db.update(consideredProducts).set(consideredProductValues(merged)).where(and(eq(consideredProducts.id, productId), eq(consideredProducts.userId, userId)));
  return getConsideredProductForUser(userId, productId);
}

export async function deleteConsideredProductForUser(userId: number, productId: number) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const result = await db.delete(consideredProducts).where(and(eq(consideredProducts.id, productId), eq(consideredProducts.userId, userId)));
  return result[0].affectedRows > 0;
}

export async function compareConsideredProductsForUser(userId: number, productIds: [number, number]) {
  const products = await Promise.all(productIds.map(id => getConsideredProductForUser(userId, id)));
  if (products.some(product => !product)) return undefined;
  return compareConsideredProducts(products as [NonNullable<typeof products[number]>, NonNullable<typeof products[number]>]);
}

export async function getBeforeYouBuyContextForUser(userId: number) {
  const [considerations, ownedProducts] = await Promise.all([listConsideredProductsForUser(userId), listProductsForUser(userId)]);
  const ownedCategoryCounts = Object.entries(ownedProducts.reduce<Record<string, number>>((counts, product) => {
    counts[product.category] = (counts[product.category] ?? 0) + 1;
    return counts;
  }, {})).sort(([first], [second]) => first.localeCompare(second)).map(([category, count]) => ({ category, count }));
  return { considerations, ownedCategoryCounts };
}

export async function moveConsideredProductToStashForUser(userId: number, productId: number) {
  const consideration = await getConsideredProductForUser(userId, productId);
  if (!consideration) return undefined;
  const product = await createProductForUser(userId, {
    name: consideration.name,
    brand: consideration.brand,
    model: consideration.model,
    category: consideration.category,
    purchasePrice: consideration.estimatedPrice,
    currency: consideration.currency,
    warrantyMonths: consideration.expectedWarrantyMonths,
    notes: [consideration.notes?.trim(), consideration.repairabilityNotes?.trim() ? `Repairability notes: ${consideration.repairabilityNotes.trim()}` : null, consideration.plannedOwnershipMonths ? `Planned ownership: ${consideration.plannedOwnershipMonths} months.` : null].filter(Boolean).join("\n") || null,
  });
  if (!product || !(await deleteConsideredProductForUser(userId, productId))) return undefined;
  return product;
}

async function findProductRecord(userId: number, productId: number, database?: ProductDataClient) {
  const db = database ?? await getDb();
  if (!db) throw databaseUnavailable();
  const result = await db.select().from(products).where(and(eq(products.id, productId), eq(products.userId, userId))).limit(1);
  return result[0];
}

export async function listProductsForUser(userId: number, filters: ProductFilters = {}, database?: ProductDataClient) {
  const db = database ?? await getDb();
  if (!db) throw databaseUnavailable();
  const conditions = [eq(products.userId, userId)];
  if (filters.category) conditions.push(eq(products.category, filters.category));
  if (filters.search?.trim()) {
    const pattern = `%${filters.search.trim()}%`;
    const searchCondition = or(like(products.name, pattern), like(products.brand, pattern), like(products.model, pattern), like(products.purchasedFrom, pattern), like(products.category, pattern));
    if (searchCondition) conditions.push(searchCondition);
  }
  const result = await db.select().from(products).where(and(...conditions)).orderBy(desc(products.createdAt));
  return result.map(toProductView).filter(product =>
    (!filters.status || product.status === filters.status) &&
    (!filters.warrantyStatus || product.warrantyStatus === filters.warrantyStatus) &&
    (!filters.returnStatus || product.returnStatus === filters.returnStatus) &&
    (!filters.urgency || product.urgency === filters.urgency),
  );
}

export async function getProductForUser(userId: number, productId: number, database?: ProductDataClient) {
  const record = await findProductRecord(userId, productId, database);
  return record ? toProductView(record) : undefined;
}

export async function createProductForUser(userId: number, input: ProductInput) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const dates = deriveProductDates(input);
  const now = new Date();
  const result = await db.transaction(async tx => {
    const inserted = await tx.insert(products).values({
      userId,
      name: input.name,
      brand: input.brand ?? null,
      model: input.model ?? null,
      category: input.category,
      description: input.description ?? null,
      purchasePrice: input.purchasePrice === null || input.purchasePrice === undefined ? null : String(input.purchasePrice),
      currency: input.currency ?? "USD",
      purchasedAt: dates.purchasedAt,
      purchasedFrom: input.purchasedFrom ?? null,
      invoiceNumber: input.invoiceNumber ?? null,
      serialNumber: input.serialNumber ?? null,
      notes: input.notes ?? null,
      warrantyMonths: dates.warrantyMonths,
      warrantyStartsAt: dates.warrantyStartsAt,
      warrantyExpiresAt: dates.warrantyExpiresAt,
      returnPeriodDays: dates.returnPeriodDays,
      returnStartsAt: dates.returnStartsAt,
      returnExpiresAt: dates.returnExpiresAt,
      imageUrl: input.imageUrl ?? null,
      createdAt: now,
      updatedAt: now,
    });
    const productId = Number((inserted as unknown as [{ insertId: number }])[0]?.insertId);
    await tx.insert(ownershipEvents).values({
      userId,
      productId,
      eventType: "purchased",
      title: "Purchased",
      description: `Added ${input.name} to the stash`,
      eventDate: dates.purchasedAt ? new Date(`${dates.purchasedAt}T12:00:00.000Z`) : now,
      occurredAt: now,
    });
    return productId;
  });
  return getProductForUser(userId, result);
}

export async function updateProductForUser(userId: number, productId: number, patch: Partial<ProductInput>, database?: ProductDataClient) {
  const db = database ?? await getDb();
  if (!db) throw databaseUnavailable();
  const existing = await findProductRecord(userId, productId, db);
  if (!existing) return undefined;
  const dates = deriveProductDates(patch as ProductInput, existing);
  const now = new Date();
  await db.update(products).set({
    name: patch.name ?? existing.name,
    brand: patch.brand === undefined ? existing.brand : patch.brand,
    model: patch.model === undefined ? existing.model : patch.model,
    category: patch.category ?? existing.category,
    description: patch.description === undefined ? existing.description : patch.description,
    purchasePrice: patch.purchasePrice === undefined ? existing.purchasePrice : patch.purchasePrice === null ? null : String(patch.purchasePrice),
    currency: patch.currency ?? existing.currency,
    purchasedAt: dates.purchasedAt,
    purchasedFrom: patch.purchasedFrom === undefined ? existing.purchasedFrom : patch.purchasedFrom,
    invoiceNumber: patch.invoiceNumber === undefined ? existing.invoiceNumber : patch.invoiceNumber,
    serialNumber: patch.serialNumber === undefined ? existing.serialNumber : patch.serialNumber,
    notes: patch.notes === undefined ? existing.notes : patch.notes,
    warrantyMonths: dates.warrantyMonths,
    warrantyStartsAt: dates.warrantyStartsAt,
    warrantyExpiresAt: dates.warrantyExpiresAt,
    returnPeriodDays: dates.returnPeriodDays,
    returnStartsAt: dates.returnStartsAt,
    returnExpiresAt: dates.returnExpiresAt,
    imageUrl: patch.imageUrl === undefined ? existing.imageUrl : patch.imageUrl,
    updatedAt: now,
  }).where(and(eq(products.id, productId), eq(products.userId, userId)));
  await db.insert(ownershipEvents).values({
    userId,
    productId,
    eventType: "product_updated",
    title: "Updated",
    description: `Updated ${patch.name ?? existing.name}`,
    eventDate: now,
    occurredAt: now,
  });
  return getProductForUser(userId, productId, db);
}

export async function deleteProductForUser(userId: number, productId: number) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const existing = await findProductRecord(userId, productId);
  if (!existing) return false;
  await db.delete(products).where(and(eq(products.id, productId), eq(products.userId, userId)));
  return true;
}

export async function getDashboardForUser(userId: number) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const [allProducts, documentRows, settings] = await Promise.all([
    listProductsForUser(userId),
    db.select({ productId: documents.productId, documentType: documents.documentType }).from(documents).where(eq(documents.userId, userId)),
    getSettingsProfileForUser(userId),
  ]);
  const notificationPreferences = settings?.notificationPreferences ?? defaultNotificationPreferences;
  const proofByProduct = new Map<number, Set<string>>();
  for (const document of documentRows) {
    if (!document.productId) continue;
    const types = proofByProduct.get(document.productId) ?? new Set<string>();
    types.add(document.documentType);
    proofByProduct.set(document.productId, types);
  }
  const attention = allProducts.flatMap(product => {
    const documentTypes = proofByProduct.get(product.id) ?? new Set<string>();
    const hasInvoice = documentTypes.has("invoice") || documentTypes.has("receipt") || documentTypes.has("order_confirmation");
    const alerts: Array<{ id: string; productId: number; kind: "warranty_expiring" | "return_ending" | "missing_invoice" | "warranty_review" | "return_review"; title: string; detail: string; priority: number }> = [];
    if (dashboardNotificationEnabled("return_ending", notificationPreferences) && product.returnStatus === "expiring") alerts.push({ id: `${product.id}:return_ending`, productId: product.id, kind: "return_ending", title: "Return window ends soon", detail: `${product.name} · ${product.returnDaysRemaining ?? 0} days remaining`, priority: 0 });
    if (dashboardNotificationEnabled("warranty_expiring", notificationPreferences) && product.warrantyStatus === "expiring") alerts.push({ id: `${product.id}:warranty_expiring`, productId: product.id, kind: "warranty_expiring", title: "Warranty expires soon", detail: `${product.name} · ${product.warrantyDaysRemaining ?? 0} days remaining`, priority: 1 });
    if (dashboardNotificationEnabled("missing_invoice", notificationPreferences) && !hasInvoice) alerts.push({ id: `${product.id}:missing_invoice`, productId: product.id, kind: "missing_invoice", title: "Invoice or receipt missing", detail: `${product.name} · save proof before you need it`, priority: 2 });
    if (dashboardNotificationEnabled("warranty_review", notificationPreferences) && product.warrantyStatus === "review_needed") alerts.push({ id: `${product.id}:warranty_review`, productId: product.id, kind: "warranty_review", title: "Warranty details need review", detail: `${product.name} · no evidence-backed coverage date`, priority: 3 });
    if (dashboardNotificationEnabled("return_review", notificationPreferences) && product.returnStatus === "review_needed") alerts.push({ id: `${product.id}:return_review`, productId: product.id, kind: "return_review", title: "Return details need review", detail: `${product.name} · no evidence-backed return date`, priority: 4 });
    return alerts;
  }).sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title));
  return {
    totals: {
      items: allProducts.length,
      protected: allProducts.filter(product => product.warrantyStatus === "protected").length,
      returnsEndingSoon: notificationPreferences.returnPeriod ? allProducts.filter(product => product.returnStatus === "expiring").length : 0,
      warrantiesExpiringSoon: notificationPreferences.warrantyExpiry ? allProducts.filter(product => product.warrantyStatus === "expiring").length : 0,
      itemsNeedingReview: notificationPreferences.generalReminders ? allProducts.filter(product => product.warrantyStatus === "review_needed" || product.returnStatus === "review_needed").length : 0,
      attention: attention.length,
      documents: documentRows.length,
    },
    recentProducts: allProducts.slice(0, 3),
    attention: attention.slice(0, 5),
  };
}

export async function getProductDetailsForUser(userId: number, productId: number) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const product = await getProductForUser(userId, productId);
  if (!product) return undefined;
  const [productDocuments, events, productReminders, services] = await Promise.all([
    db.select().from(documents).where(and(eq(documents.userId, userId), eq(documents.productId, productId))).orderBy(desc(documents.createdAt)),
    db.select().from(ownershipEvents).where(and(eq(ownershipEvents.userId, userId), eq(ownershipEvents.productId, productId))).orderBy(desc(ownershipEvents.occurredAt)),
    db.select().from(reminders).where(and(eq(reminders.userId, userId), eq(reminders.productId, productId))).orderBy(desc(reminders.remindAt)),
    db.select().from(serviceRecords).where(and(eq(serviceRecords.userId, userId), eq(serviceRecords.productId, productId))).orderBy(desc(serviceRecords.createdAt)),
  ]);
  return { product, documents: productDocuments.map(toDocumentView), events, reminders: productReminders, serviceRecords: services };
}

export async function listDocumentsForUser(userId: number, productId?: number) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const conditions = [eq(documents.userId, userId)];
  if (productId) conditions.push(eq(documents.productId, productId));
  const result = await db.select().from(documents).where(and(...conditions)).orderBy(desc(documents.createdAt));
  return result.map(toDocumentView);
}

export async function listDocumentExportForUser(userId: number): Promise<DocumentExportSource[]> {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const [documentRows, productRows] = await Promise.all([
    db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt)),
    db.select({ id: products.id, name: products.name }).from(products).where(eq(products.userId, userId)),
  ]);
  const productNames = new Map(productRows.map(product => [product.id, product.name]));
  return documentRows.map(document => ({
    id: document.id,
    productId: document.productId,
    productName: document.productId ? productNames.get(document.productId) ?? null : null,
    name: document.name,
    fileName: document.fileName,
    documentType: document.documentType,
    mimeType: document.mimeType,
    processingStatus: document.processingStatus,
    extractedData: document.extractedData,
    extractionConfidence: document.extractionConfidence,
    extractionReviewedAt: document.extractionReviewedAt,
    uploadedAt: document.uploadedAt,
  }));
}

export async function createDocumentForUser(userId: number, input: { productId?: number | null; name: string; documentType: "invoice" | "receipt" | "warranty" | "service_record" | "manual" | "order_confirmation" | "other"; fileKey: string; fileUrl?: string | null; mimeType?: string | null; }) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  if (input.productId && !(await findProductRecord(userId, input.productId))) return undefined;
  const inserted = await db.insert(documents).values({ userId, ...input, fileName: input.name, fileUrl: input.fileUrl ?? null, mimeType: input.mimeType ?? null, fileType: input.mimeType ?? null, uploadedAt: new Date() });
  const documentId = Number((inserted as unknown as [{ insertId: number }])[0]?.insertId);
  if (input.productId) await db.insert(ownershipEvents).values({ userId, productId: input.productId, eventType: "document_added", title: "Document saved", description: `Saved ${input.name}`, eventDate: new Date(), occurredAt: new Date() });
  const record = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId))).limit(1);
  return record[0] ? toDocumentView(record[0]) : undefined;
}

export async function createReceiptForExtraction(userId: number, input: { name: string; fileKey: string; fileUrl?: string | null; mimeType: string }) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const inserted = await db.insert(documents).values({
    userId,
    productId: null,
    name: input.name,
    fileName: input.name,
    documentType: "receipt",
    fileKey: input.fileKey,
    fileUrl: input.fileUrl ?? null,
    mimeType: input.mimeType,
    fileType: input.mimeType,
    processingStatus: "processing",
    uploadedAt: new Date(),
  });
  const documentId = Number((inserted as unknown as [{ insertId: number }])[0]?.insertId);
  return getDocumentForUser(userId, documentId);
}

export async function saveReceiptExtractionForUser(userId: number, documentId: number, extraction: import("./services/receiptExtraction").ReceiptExtraction, model?: string, rawOcrText?: string | null) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const existing = await getDocumentForUser(userId, documentId);
  if (!existing || existing.documentType !== "receipt") return undefined;
  const failed = extraction.source === "fallback";
  await db.update(documents).set({
    processingStatus: failed ? "failed" : "completed",
    extractedData: JSON.stringify(extraction),
    rawOcrText: rawOcrText ?? null,
    extractionConfidence: String(extraction.confidence),
    extractionModel: failed ? null : model ?? null,
    extractionError: failed ? extraction.message ?? "Receipt extraction could not be completed." : null,
    processedAt: new Date(),
  }).where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
  return getReceiptReviewForUser(userId, documentId);
}

function parseStoredExtraction(value: string | null): import("./services/receiptExtraction").ReceiptExtraction | undefined {
  if (!value) return undefined;
  try { return JSON.parse(value) as import("./services/receiptExtraction").ReceiptExtraction; } catch { return undefined; }
}

export async function getReceiptReviewForUser(userId: number, documentId: number) {
  const document = await getDocumentForUser(userId, documentId);
  if (!document || document.documentType !== "receipt") return undefined;
  const storedExtraction = parseStoredExtraction(document.extractedData);
  const extraction = storedExtraction ? normalizeStoredReceiptExtraction(storedExtraction, document.rawOcrText) : undefined;
  return { ...toDocumentView(document), extraction, extractionError: document.extractionError, extractionReviewedAt: document.extractionReviewedAt };
}

export type ReceiptConfirmationTransaction = Pick<NonNullable<Awaited<ReturnType<typeof getDb>>>, "insert" | "update">;

export async function writeReceiptConfirmationTransaction(transaction: ReceiptConfirmationTransaction, args: { userId: number; documentId: number; documentName: string; input: ReceiptConfirmationInput; now: Date }) {
  const { userId, documentId, documentName, input, now } = args;
  const dates = deriveProductDates(input);
  const inserted = await transaction.insert(products).values({ userId, name: input.name, brand: input.brand ?? null, model: input.model ?? null, category: input.category, description: input.description ?? null, purchasePrice: input.purchasePrice === null || input.purchasePrice === undefined ? null : String(input.purchasePrice), currency: input.currency ?? "USD", purchasedAt: dates.purchasedAt, purchasedFrom: input.purchasedFrom ?? null, invoiceNumber: input.invoiceNumber ?? null, serialNumber: input.serialNumber ?? null, notes: input.notes ?? null, warrantyMonths: dates.warrantyMonths, warrantyStartsAt: dates.warrantyStartsAt, warrantyExpiresAt: dates.warrantyExpiresAt, returnPeriodDays: dates.returnPeriodDays, returnStartsAt: dates.returnStartsAt, returnExpiresAt: dates.returnExpiresAt, imageUrl: input.imageUrl ?? null, createdAt: now, updatedAt: now });
  const productId = Number((inserted as unknown as [{ insertId: number }])[0]?.insertId);
  if (!productId) throw new Error("StashVault could not create the reviewed product record.");
  await transaction.update(documents).set({ productId, processingStatus: "completed", extractionReviewedAt: now }).where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
  await transaction.insert(ownershipEvents).values([
    { userId, productId, eventType: "purchased", title: "Purchased", description: `Added ${input.name} from a reviewed receipt`, eventDate: dates.purchasedAt ? new Date(`${dates.purchasedAt}T12:00:00.000Z`) : now, occurredAt: now },
    { userId, productId, eventType: "document_added", title: "Receipt confirmed", description: `Linked ${documentName} after receipt review`, eventDate: now, occurredAt: now },
  ]);
  return productId;
}

export async function confirmReceiptReviewForUser(userId: number, documentId: number, input: ReceiptConfirmationInput) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const document = await getDocumentForUser(userId, documentId);
  if (!document || document.documentType !== "receipt" || document.productId) return undefined;
  const now = new Date();
  const productId = await db.transaction(tx => writeReceiptConfirmationTransaction(tx as ReceiptConfirmationTransaction, { userId, documentId, documentName: document.name, input, now }));
  return getProductForUser(userId, productId);
}

export async function getDocumentForUser(userId: number, documentId: number) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const result = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId))).limit(1);
  return result[0];
}

export async function deleteDocumentForUser(userId: number, documentId: number) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const document = await getDocumentForUser(userId, documentId);
  if (!document) return false;
  await db.delete(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
  if (document.productId) {
    const now = new Date();
    await db.insert(ownershipEvents).values({ userId, productId: document.productId, eventType: "document_deleted", title: "Document removed", description: `Removed ${document.name}`, eventDate: now, occurredAt: now });
  }
  return true;
}

export async function listOwnershipEventsForUser(userId: number, productId: number) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  return db.select().from(ownershipEvents).where(and(eq(ownershipEvents.userId, userId), eq(ownershipEvents.productId, productId))).orderBy(desc(ownershipEvents.occurredAt));
}

export async function listRemindersForUser(userId: number, productId?: number) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const conditions = [eq(reminders.userId, userId)];
  if (productId) conditions.push(eq(reminders.productId, productId));
  return db.select().from(reminders).where(and(...conditions)).orderBy(desc(reminders.remindAt));
}

export async function dismissReminderForUser(userId: number, reminderId: number) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  const record = await db.select().from(reminders).where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId))).limit(1);
  if (!record[0]) return false;
  await db.update(reminders).set({ status: "dismissed" }).where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)));
  await db.insert(ownershipEvents).values({ userId, productId: record[0].productId, eventType: "reminder_dismissed", title: "Reminder dismissed", description: `Dismissed ${record[0].reminderType} reminder`, eventDate: new Date(), occurredAt: new Date() });
  return true;
}

export async function listServiceRecordsForUser(userId: number, productId: number) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  return db.select().from(serviceRecords).where(and(eq(serviceRecords.userId, userId), eq(serviceRecords.productId, productId))).orderBy(desc(serviceRecords.createdAt));
}

export async function createServiceRecordForUser(userId: number, input: { productId: number; provider?: string | null; issue: string; status?: "reported" | "claim_preparing" | "submitted" | "in_progress" | "resolved" | "open" | "scheduled" | "completed" | "cancelled"; cost?: number | null; servicedAt?: Date | null; notes?: string | null; }) {
  const db = await getDb();
  if (!db) throw databaseUnavailable();
  if (!(await findProductRecord(userId, input.productId))) return undefined;
  const inserted = await db.insert(serviceRecords).values({ ...input, userId, provider: input.provider ?? null, status: input.status ?? "reported", cost: input.cost === null || input.cost === undefined ? null : String(input.cost), requestedAt: new Date(), servicedAt: input.servicedAt ?? null, notes: input.notes ?? null });
  const recordId = Number((inserted as unknown as [{ insertId: number }])[0]?.insertId);
  await db.insert(ownershipEvents).values({ userId, productId: input.productId, eventType: "service_requested", title: "Service requested", description: `Recorded service issue: ${input.issue}`, eventDate: new Date(), occurredAt: new Date() });
  const record = await db.select().from(serviceRecords).where(and(eq(serviceRecords.id, recordId), eq(serviceRecords.userId, userId))).limit(1);
  return record[0];
}

export async function seedDemoProductsForUser(userId: number) {
  const existing = await listProductsForUser(userId);
  if (existing.length > 0) return { created: 0, skipped: true };

  const now = new Date();
  const demoDate = (year: number, monthIndex: number, day: number) => `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const demoProducts: ProductInput[] = [
    { name: "MacBook Air", brand: "Apple", model: "M3", category: "Electronics", purchasePrice: 1299, purchasedAt: demoDate(now.getFullYear(), 2, 12), warrantyMonths: 24, notes: "Personal laptop · midnight" },
    { name: "WH-1000XM5", brand: "Sony", model: "WH-1000XM5", category: "Electronics", purchasePrice: 349, purchasedAt: demoDate(now.getFullYear(), 6, 30), warrantyMonths: 12, returnPeriodDays: 30, notes: "Noise-cancelling headphones" },
    { name: "iPhone 15 Pro", brand: "Apple", model: "A3106", category: "Electronics", purchasePrice: 999, purchasedAt: demoDate(now.getFullYear() - 1, 8, 16), warrantyMonths: 24 },
    { name: "AquaWash 7kg", brand: "Samsung", model: "WW70T", category: "Home", purchasePrice: 620, purchasedAt: demoDate(now.getFullYear() - 1, 6, 1), warrantyMonths: 14, notes: "Laundry room appliance" },
    { name: "Apple Watch Series 9", brand: "Apple", model: "GPS 45mm", category: "Wearables", purchasePrice: 399, purchasedAt: demoDate(now.getFullYear() - 1, 8, 5), warrantyMonths: 12 },
    { name: "EOS R50", brand: "Canon", model: "EOS R50", category: "Photography", purchasePrice: 679, purchasedAt: demoDate(now.getFullYear(), 0, 3), notes: "Invoice still needs to be added" },
    { name: "PlayStation 5", brand: "Sony", model: "Slim", category: "Gaming", purchasePrice: 499, purchasedAt: demoDate(now.getFullYear(), 4, 11), warrantyMonths: 24 },
    { name: "Family Hub Refrigerator", brand: "Samsung", model: "RF23", category: "Home", purchasePrice: 1840, purchasedAt: demoDate(now.getFullYear() - 2, 7, 8), warrantyMonths: 24 },
  ];
  await Promise.all(demoProducts.map(product => createProductForUser(userId, product)));
  return { created: demoProducts.length, skipped: false };
}
