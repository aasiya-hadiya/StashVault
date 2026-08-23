import { date, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  displayName: varchar("displayName", { length: 120 }),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  warrantyNotificationsEnabled: int("warrantyNotificationsEnabled").default(1).notNull(),
  returnNotificationsEnabled: int("returnNotificationsEnabled").default(1).notNull(),
  generalNotificationsEnabled: int("generalNotificationsEnabled").default(1).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  brand: varchar("brand", { length: 120 }),
  model: varchar("model", { length: 160 }),
  category: varchar("category", { length: 80 }).notNull(),
  description: text("description"),
  purchasePrice: decimal("purchasePrice", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  purchasedAt: date("purchasedAt", { mode: "string" }),
  purchasedFrom: varchar("purchasedFrom", { length: 255 }),
  invoiceNumber: varchar("invoiceNumber", { length: 160 }),
  serialNumber: varchar("serialNumber", { length: 160 }),
  notes: text("notes"),
  warrantyMonths: int("warrantyMonths"),
  warrantyStartsAt: date("warrantyStartsAt", { mode: "string" }),
  warrantyExpiresAt: date("warrantyExpiresAt", { mode: "string" }),
  returnPeriodDays: int("returnPeriodDays"),
  returnStartsAt: date("returnStartsAt", { mode: "string" }),
  returnExpiresAt: date("returnExpiresAt", { mode: "string" }),
  imageUrl: varchar("imageUrl", { length: 2048 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("products_user_idx").on(table.userId),
  index("products_category_idx").on(table.category),
  index("products_warranty_expiry_idx").on(table.warrantyExpiresAt),
]);

export const consideredProducts = mysqlTable("consideredProducts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  brand: varchar("brand", { length: 120 }),
  model: varchar("model", { length: 160 }),
  category: varchar("category", { length: 80 }).notNull(),
  estimatedPrice: decimal("estimatedPrice", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  plannedOwnershipMonths: int("plannedOwnershipMonths"),
  expectedWarrantyMonths: int("expectedWarrantyMonths"),
  repairabilityNotes: text("repairabilityNotes"),
  expectedResaleValue: decimal("expectedResaleValue", { precision: 12, scale: 2 }),
  expectedResaleValueAtMonths: int("expectedResaleValueAtMonths"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("considered_products_user_idx").on(table.userId),
  index("considered_products_category_idx").on(table.category),
]);

export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: int("productId").references(() => products.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  fileName: varchar("fileName", { length: 255 }),
  documentType: mysqlEnum("documentType", ["invoice", "receipt", "warranty", "service_record", "manual", "order_confirmation", "other"]).default("other").notNull(),
  fileKey: varchar("fileKey", { length: 1024 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 2048 }),
  mimeType: varchar("mimeType", { length: 120 }),
  fileType: varchar("fileType", { length: 120 }),
  processingStatus: mysqlEnum("processingStatus", ["not_requested", "queued", "processing", "completed", "failed"]).default("not_requested").notNull(),
  extractedData: text("extractedData"),
  rawOcrText: text("rawOcrText"),
  extractionConfidence: decimal("extractionConfidence", { precision: 5, scale: 2 }),
  extractionModel: varchar("extractionModel", { length: 120 }),
  extractionError: text("extractionError"),
  extractionReviewedAt: timestamp("extractionReviewedAt"),
  processedAt: timestamp("processedAt"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("documents_user_idx").on(table.userId),
  index("documents_product_idx").on(table.productId),
]);

export const ownershipEvents = mysqlTable("ownershipEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  eventType: mysqlEnum("eventType", ["purchased", "return_window_started", "return_window_ended", "warranty_started", "warranty_expiring", "warranty_expired", "service_requested", "repaired", "replaced", "resold", "product_created", "product_updated", "purchase_recorded", "document_added", "document_deleted", "service_recorded", "reminder_dismissed"]).notNull(),
  title: varchar("title", { length: 255 }),
  description: varchar("description", { length: 500 }).notNull(),
  eventDate: timestamp("eventDate").defaultNow().notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, table => [
  index("ownership_events_user_idx").on(table.userId),
  index("ownership_events_product_idx").on(table.productId),
]);

export const reminders = mysqlTable("reminders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  reminderType: mysqlEnum("reminderType", ["warranty", "return", "service", "custom"]).notNull(),
  title: varchar("title", { length: 255 }),
  message: text("message"),
  attentionKind: mysqlEnum("attentionKind", ["warranty_expiring", "return_ending", "missing_invoice", "warranty_review", "return_review", "custom"]),
  dueDate: date("dueDate", { mode: "string" }),
  remindAt: timestamp("remindAt").notNull(),
  status: mysqlEnum("status", ["active", "dismissed", "sent"]).default("active").notNull(),
  isRead: int("isRead").default(0).notNull(),
  isCompleted: int("isCompleted").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("reminders_user_idx").on(table.userId),
  index("reminders_product_idx").on(table.productId),
  index("reminders_due_idx").on(table.remindAt),
]);

export const serviceRecords = mysqlTable("serviceRecords", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 255 }),
  issue: varchar("issue", { length: 500 }).notNull(),
  status: mysqlEnum("status", ["reported", "claim_preparing", "submitted", "in_progress", "resolved", "open", "scheduled", "completed", "cancelled"]).default("reported").notNull(),
  cost: decimal("cost", { precision: 12, scale: 2 }),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
  servicedAt: timestamp("servicedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("service_records_user_idx").on(table.userId),
  index("service_records_product_idx").on(table.productId),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
export type ConsideredProduct = typeof consideredProducts.$inferSelect;
export type InsertConsideredProduct = typeof consideredProducts.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type OwnershipEvent = typeof ownershipEvents.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type ServiceRecord = typeof serviceRecords.$inferSelect;
