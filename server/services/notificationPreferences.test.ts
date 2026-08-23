import { describe, expect, it } from "vitest";
import { dashboardNotificationEnabled, type NotificationPreferences } from "./notificationPreferences";

const allEnabled: NotificationPreferences = { warrantyExpiry: true, returnPeriod: true, generalReminders: true };

describe("dashboard notification preferences", () => {
  it("suppresses warranty-expiry alerts only when warranty reminders are disabled", () => {
    expect(dashboardNotificationEnabled("warranty_expiring", { ...allEnabled, warrantyExpiry: false })).toBe(false);
    expect(dashboardNotificationEnabled("return_ending", { ...allEnabled, warrantyExpiry: false })).toBe(true);
  });

  it("suppresses return-ending alerts only when return reminders are disabled", () => {
    expect(dashboardNotificationEnabled("return_ending", { ...allEnabled, returnPeriod: false })).toBe(false);
    expect(dashboardNotificationEnabled("warranty_expiring", { ...allEnabled, returnPeriod: false })).toBe(true);
  });

  it("suppresses document and coverage-review reminders when general reminders are disabled", () => {
    const preferences = { ...allEnabled, generalReminders: false };
    expect(dashboardNotificationEnabled("missing_invoice", preferences)).toBe(false);
    expect(dashboardNotificationEnabled("warranty_review", preferences)).toBe(false);
    expect(dashboardNotificationEnabled("return_review", preferences)).toBe(false);
  });
});
