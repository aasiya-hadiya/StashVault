import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeLLM } from "./llm";

const response = () => new Response(JSON.stringify({
  id: "test",
  created: 0,
  model: "test-model",
  choices: [{
    index: 0,
    message: { role: "assistant", content: "OK" },
    finish_reason: "stop",
  }],
}), { status: 200, headers: { "content-type": "application/json" } });

describe("invokeLLM token caps", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses max_completion_tokens for GPT-5 calls so reasoning cannot consume the answer budget", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);

    await invokeLLM({
      model: "gpt-5-mini",
      maxTokens: 700,
      messages: [{ role: "user", content: "Return OK." }],
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.max_completion_tokens).toBe(700);
    expect(body.max_tokens).toBeUndefined();
  });

  it("keeps max_tokens for non-GPT-5 providers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);

    await invokeLLM({
      model: "claude-haiku-4-5",
      maxTokens: 700,
      messages: [{ role: "user", content: "Return OK." }],
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.max_tokens).toBe(700);
    expect(body.max_completion_tokens).toBeUndefined();
  });
});
