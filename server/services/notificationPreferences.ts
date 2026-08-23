export type NotificationPreferences = {
  warrantyExpiry: boolean;
  returnPeriod: boolean;
  generalReminders: boolean;
};

export type DashboardNotificationKind = "return_ending" | "warranty_expiring" | "missing_invoice" | "warranty_review" | "return_review";

export function dashboardNotificationEnabled(kind: DashboardNotificationKind, preferences: NotificationPreferences) {
  if (kind === "warranty_expiring") return preferences.warrantyExpiry;
  if (kind === "return_ending") return preferences.returnPeriod;
  return preferences.generalReminders;
}
