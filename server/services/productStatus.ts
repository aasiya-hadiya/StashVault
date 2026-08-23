import { calendarDaysUntil, calendarToday, dateOnlyFromDate, getWarrantyReturnSummary, isDateOnly } from "./warrantyReturn";

export type WarrantyStatus = "protected" | "expiring" | "expired" | "review_needed";
export type ReturnStatus = "active" | "expiring" | "expired" | "review_needed";
export type ProductUrgency = "none" | "soon" | "attention";

type DateLike = Date | string | null | undefined;

export type ProductSchedule = {
  purchasedAt?: DateLike;
  warrantyMonths?: number | null;
  warrantyStartsAt?: DateLike;
  warrantyExpiresAt: DateLike;
  returnPeriodDays?: number | null;
  returnStartsAt?: DateLike;
  returnExpiresAt: DateLike;
};

function toDate(value: DateLike): Date | null {
  if (!value) return null;
  const date = value instanceof Date
    ? value
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00.000Z`)
      : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateOnly(value: DateLike): string | null {
  if (!value) return null;
  if (typeof value === "string" && isDateOnly(value)) return value;
  const date = toDate(value);
  return date ? dateOnlyFromDate(date) : null;
}

/** Retained for existing card consumers; expired values display zero instead of a negative number. */
export function daysRemaining(value: DateLike, now = new Date()): number | null {
  const remaining = calendarDaysUntil(toDateOnly(value), calendarToday(now));
  return remaining === null ? null : Math.max(0, remaining);
}

export function addMonths(date: Date, months: number): Date {
  const copy = new Date(date);
  const originalDay = copy.getDate();
  copy.setMonth(copy.getMonth() + months, 1);
  const lastDay = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate();
  copy.setDate(Math.min(originalDay, lastDay));
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function warrantyElapsedPercent(schedule: ProductSchedule, now: Date): number | null {
  const start = toDate(schedule.warrantyStartsAt ?? schedule.purchasedAt);
  const expiry = toDate(schedule.warrantyExpiresAt);
  if (!start || !expiry || expiry.getTime() <= start.getTime()) return null;
  const elapsed = (now.getTime() - start.getTime()) / (expiry.getTime() - start.getTime());
  return Math.max(0, Math.min(100, Math.round(elapsed * 100)));
}

export function getProductStatus(schedule: ProductSchedule, now = new Date()) {
  const summary = getWarrantyReturnSummary({
    purchasedAt: toDateOnly(schedule.purchasedAt),
    warrantyMonths: schedule.warrantyMonths ?? null,
    warrantyStartsAt: toDateOnly(schedule.warrantyStartsAt),
    warrantyExpiresAt: toDateOnly(schedule.warrantyExpiresAt),
    returnPeriodDays: schedule.returnPeriodDays ?? null,
    returnStartsAt: toDateOnly(schedule.returnStartsAt),
    returnExpiresAt: toDateOnly(schedule.returnExpiresAt),
  }, calendarToday(now));
  const warrantyStatus: WarrantyStatus = summary.warrantyStatus === "active" ? "protected" : summary.warrantyStatus === "expiring_soon" ? "expiring" : summary.warrantyStatus === "expired" ? "expired" : "review_needed";
  const returnStatus: ReturnStatus = summary.returnStatus === "ending_soon" ? "expiring" : summary.returnStatus;
  const urgency: ProductUrgency = warrantyStatus === "review_needed" || warrantyStatus === "expired" || returnStatus === "expired" ? "attention" : warrantyStatus === "expiring" || returnStatus === "expiring" ? "soon" : "none";
  const status = warrantyStatus === "review_needed" ? "missing_information" : warrantyStatus === "expired" ? "expired" : warrantyStatus === "expiring" || returnStatus === "expiring" ? "expiring" : "protected";
  const label = status === "protected" ? "Protected" : status === "expiring" ? "Expiring soon" : status === "expired" ? "Expired" : "Review needed";
  return {
    status,
    label,
    urgency,
    warrantyStatus,
    returnStatus,
    warrantyDaysRemaining: summary.warrantyDaysRemaining === null ? null : Math.max(0, summary.warrantyDaysRemaining),
    warrantyExpiresAt: summary.warrantyExpiryDate,
    warrantyStartDate: summary.warrantyStartDate,
    warrantyElapsedPercent: warrantyElapsedPercent(schedule, now),
    returnDaysRemaining: summary.returnDaysRemaining === null ? null : Math.max(0, summary.returnDaysRemaining),
    returnExpiresAt: summary.returnExpiryDate,
    returnStartDate: summary.returnStartDate,
  };
}
