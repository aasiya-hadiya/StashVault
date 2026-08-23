import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMock = vi.hoisted(() => ({
  getSettingsProfileForUser: vi.fn(),
  updateDisplayNameForUser: vi.fn(),
  updateNotificationPreferencesForUser: vi.fn(),
}));

vi.mock("./db", () => dbMock);

import { appRouter } from "./routers";

function createUserContext(userId = 42): TrpcContext {
  return {
    user: {
      id: userId,
      openId: "settings-test-user",
      name: "Provider Name",
      displayName: null,
      email: "settings@example.com",
      loginMethod: "manus",
      warrantyNotificationsEnabled: 1,
      returnNotificationsEnabled: 1,
      generalNotificationsEnabled: 1,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const profile = {
  displayName: "Archive Name",
  email: "settings@example.com",
  notificationPreferences: { warrantyExpiry: true, returnPeriod: true, generalReminders: true },
};

describe("settings router", () => {
  it("loads settings only for the authenticated account", async () => {
    dbMock.getSettingsProfileForUser.mockResolvedValue(profile);

    await expect(appRouter.createCaller(createUserContext(37)).settings.get()).resolves.toEqual(profile);
    expect(dbMock.getSettingsProfileForUser).toHaveBeenCalledWith(37);
  });

  it("persists an owner-scoped display name without accepting credential fields", async () => {
    dbMock.updateDisplayNameForUser.mockResolvedValue({ ...profile, displayName: "New Archive Name" });

    await expect(appRouter.createCaller(createUserContext(37)).settings.updateDisplayName({ displayName: "  New Archive Name  " })).resolves.toMatchObject({ displayName: "New Archive Name" });
    expect(dbMock.updateDisplayNameForUser).toHaveBeenCalledWith(37, "New Archive Name");
    await expect(appRouter.createCaller(createUserContext(37)).settings.updateDisplayName({ displayName: " " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("persists all notification preferences for the authenticated account", async () => {
    const preferences = { warrantyExpiry: false, returnPeriod: true, generalReminders: false };
    dbMock.updateNotificationPreferencesForUser.mockResolvedValue({ ...profile, notificationPreferences: preferences });

    await expect(appRouter.createCaller(createUserContext(88)).settings.updateNotificationPreferences(preferences)).resolves.toMatchObject({ notificationPreferences: preferences });
    expect(dbMock.updateNotificationPreferencesForUser).toHaveBeenCalledWith(88, preferences);
  });
});
