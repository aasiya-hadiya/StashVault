/**
 * Warranty and return tracking contract.
 *
 * All business dates are ISO calendar dates (YYYY-MM-DD), never timestamps.
 * Receipt extraction may supply a duration only when evidence supports it.
 * A user-entered start or expiry date is authoritative; this module never
 * fabricates a duration or deadline when the required inputs are absent.
 */

export type DateOnly = string;
export type WarrantyTrackingStatus = "active" | "expiring_soon" | "expired" | "review_needed";
export type ReturnTrackingStatus = "active" | "ending_soon" | "expired" | "review_needed";
export type AttentionKind = "warranty_expiring" | "return_ending" | "missing_invoice" | "warranty_review" | "return_review";

export const WARRANTY_SOON_DAYS = 30;
export const RETURN_SOON_DAYS = 3;

export type WarrantyReturnSchedule = {
  purchasedAt?: DateOnly | null;
  warrantyMonths?: number | null;
  warrantyStartsAt?: DateOnly | null;
  warrantyExpiresAt?: DateOnly | null;
  returnPeriodDays?: number | null;
  returnStartsAt?: DateOnly | null;
  returnExpiresAt?: DateOnly | null;
};

export type WarrantyReturnSummary = {
  warrantyStartDate: DateOnly | null;
  warrantyExpiryDate: DateOnly | null;
  warrantyStatus: WarrantyTrackingStatus;
  warrantyDaysRemaining: number | null;
  returnStartDate: DateOnly | null;
  returnExpiryDate: DateOnly | null;
  returnStatus: ReturnTrackingStatus;
  returnDaysRemaining: number | null;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day;
}

export function dateOnlyFromDate(value: Date): DateOnly {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function asUtcDate(value: DateOnly): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDateOnlyDays(value: DateOnly, days: number): DateOnly | null {
  if (!isDateOnly(value) || !Number.isInteger(days) || days < 0) return null;
  const date = asUtcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnlyFromDate(date);
}

export function addDateOnlyMonths(value: DateOnly, months: number): DateOnly | null {
  if (!isDateOnly(value) || !Number.isInteger(months) || months < 0) return null;
  const original = asUtcDate(value);
  const originalDay = original.getUTCDate();
  original.setUTCMonth(original.getUTCMonth() + months, 1);
  const lastDay = new Date(Date.UTC(original.getUTCFullYear(), original.getUTCMonth() + 1, 0)).getUTCDate();
  original.setUTCDate(Math.min(originalDay, lastDay));
  return dateOnlyFromDate(original);
}

export function calendarToday(now = new Date()): DateOnly {
  return dateOnlyFromDate(now);
}

export function calendarDaysUntil(deadline: DateOnly | null | undefined, today = calendarToday()): number | null {
  if (!deadline || !isDateOnly(deadline) || !isDateOnly(today)) return null;
  return Math.round((asUtcDate(deadline).getTime() - asUtcDate(today).getTime()) / 86_400_000);
}

/** Explicit expiry dates are authoritative; otherwise calculate only from an evidence-backed/manual duration and start date. */
export function resolveWarrantyExpiry(schedule: Pick<WarrantyReturnSchedule, "purchasedAt" | "warrantyMonths" | "warrantyStartsAt" | "warrantyExpiresAt">): DateOnly | null {
  if (isDateOnly(schedule.warrantyExpiresAt)) return schedule.warrantyExpiresAt;
  const start = isDateOnly(schedule.warrantyStartsAt) ? schedule.warrantyStartsAt : schedule.purchasedAt;
  return start && typeof schedule.warrantyMonths === "number" && schedule.warrantyMonths > 0 ? addDateOnlyMonths(start, schedule.warrantyMonths) : null;
}

/** Explicit return deadlines are authoritative; otherwise calculate only from an evidence-backed/manual period and start date. */
export function resolveReturnExpiry(schedule: Pick<WarrantyReturnSchedule, "purchasedAt" | "returnPeriodDays" | "returnStartsAt" | "returnExpiresAt">): DateOnly | null {
  if (isDateOnly(schedule.returnExpiresAt)) return schedule.returnExpiresAt;
  const start = isDateOnly(schedule.returnStartsAt) ? schedule.returnStartsAt : schedule.purchasedAt;
  return start && typeof schedule.returnPeriodDays === "number" && schedule.returnPeriodDays > 0 ? addDateOnlyDays(start, schedule.returnPeriodDays) : null;
}

export function getWarrantyReturnSummary(schedule: WarrantyReturnSchedule, today = calendarToday()): WarrantyReturnSummary {
  const warrantyStartDate = isDateOnly(schedule.warrantyStartsAt) ? schedule.warrantyStartsAt : isDateOnly(schedule.purchasedAt) ? schedule.purchasedAt : null;
  const returnStartDate = isDateOnly(schedule.returnStartsAt) ? schedule.returnStartsAt : isDateOnly(schedule.purchasedAt) ? schedule.purchasedAt : null;
  const warrantyExpiryDate = resolveWarrantyExpiry(schedule);
  const returnExpiryDate = resolveReturnExpiry(schedule);
  const warrantyDaysRemaining = calendarDaysUntil(warrantyExpiryDate, today);
  const returnDaysRemaining = calendarDaysUntil(returnExpiryDate, today);

  const warrantyStatus: WarrantyTrackingStatus = warrantyDaysRemaining === null
    ? "review_needed"
    : warrantyDaysRemaining < 0
      ? "expired"
      : warrantyDaysRemaining <= WARRANTY_SOON_DAYS
        ? "expiring_soon"
        : "active";
  const returnStatus: ReturnTrackingStatus = returnDaysRemaining === null
    ? "review_needed"
    : returnDaysRemaining < 0
      ? "expired"
      : returnDaysRemaining <= RETURN_SOON_DAYS
        ? "ending_soon"
        : "active";

  return { warrantyStartDate, warrantyExpiryDate, warrantyStatus, warrantyDaysRemaining, returnStartDate, returnExpiryDate, returnStatus, returnDaysRemaining };
}

export function getAttentionKinds(summary: WarrantyReturnSummary, hasInvoice: boolean): AttentionKind[] {
  const attention: AttentionKind[] = [];
  if (summary.warrantyStatus === "expiring_soon") attention.push("warranty_expiring");
  if (summary.returnStatus === "ending_soon") attention.push("return_ending");
  if (!hasInvoice) attention.push("missing_invoice");
  if (summary.warrantyStatus === "review_needed") attention.push("warranty_review");
  if (summary.returnStatus === "review_needed") attention.push("return_review");
  return attention;
}
