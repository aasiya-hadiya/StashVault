export type AssistantHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

const safeFailureMessages = [
  "The StashVault AI service needs configuration. Your saved data has not changed.",
  "The StashVault AI service returned no answer. Please try again.",
  "The StashVault AI service is temporarily unavailable. Please try again.",
];

export function safeAssistantFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return safeFailureMessages.includes(message)
    ? message
    : "StashVault couldn't answer right now. Your saved data has not changed.";
}

export function assistantHistoryForAttempt(history: AssistantHistoryMessage[], isRetry: boolean) {
  return isRetry ? history.slice(0, -1) : history;
}
