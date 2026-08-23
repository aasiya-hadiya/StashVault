import { describe, expect, it } from "vitest";

describe("application branding", () => {
  it("exposes StashVault as the configured user-facing application title", () => {
    expect(process.env.VITE_APP_TITLE).toBe("StashVault");
  });
});
