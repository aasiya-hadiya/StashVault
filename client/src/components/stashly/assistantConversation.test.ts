import { describe, expect, it } from "vitest";
import { assistantHistoryForAttempt, safeAssistantFailureMessage } from "./assistantConversation";

describe("Ask StashVault conversation recovery", () => {
  it("keeps only known server-safe assistant failures visible to the user", () => {
    expect(safeAssistantFailureMessage(new Error("The StashVault AI service is temporarily unavailable. Please try again."))).toContain("temporarily unavailable");
    expect(safeAssistantFailureMessage(new Error("upstream stack trace"))).toBe("StashVault couldn't answer right now. Your saved data has not changed.");
  });

  it("removes the failed final user turn from retry history so the original question is resent once", () => {
    const history = [
      { role: "user" as const, content: "Which warranties are active?" },
      { role: "assistant" as const, content: "One warranty is active." },
      { role: "user" as const, content: "When does it expire?" },
    ];
    expect(assistantHistoryForAttempt(history, true)).toEqual(history.slice(0, 2));
    expect(assistantHistoryForAttempt(history, false)).toEqual(history);
  });
});
