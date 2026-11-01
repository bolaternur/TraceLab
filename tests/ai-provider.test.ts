import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_LIMITS, AiProviderError, DeterministicFakeProvider, getAiProvider, OpenAiCompatibleProvider } from "@/modules/ai/provider";
import { assertProductionConfiguration } from "@/server/runtime-config";

const request = { system: "Use only source evidence.", prompt: "Private fixture text." };
const production = { NODE_ENV: "production", AI_PROVIDER: "disabled" } as NodeJS.ProcessEnv;
const provider = () => new OpenAiCompatibleProvider("https://provider.example.invalid/v1", "private-fixture-key", "fixture-model", production);
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("production AI and development fallback boundary", () => {
  it("keeps optional AI disabled without network requests", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(getAiProvider(production).enabled).toBe(false);
    expect(await getAiProvider(production).generate(request)).toMatchObject({ generated: false, text: "" });
    expect(fetch).not.toHaveBeenCalled();
    expect(() => assertProductionConfiguration(production)).not.toThrow();
  });
  it("rejects fake providers in production including a direct adapter invocation", async () => {
    expect(() => getAiProvider({ ...production, AI_PROVIDER: "fake" })).toThrow("ai_development_provider_forbidden");
    vi.stubEnv("NODE_ENV", "production");
    await expect(new DeterministicFakeProvider().generate(request)).rejects.toThrow("ai_development_provider_forbidden");
    vi.stubEnv("NODE_ENV", "test");
    expect((await getAiProvider({ NODE_ENV: "test", AI_PROVIDER: "fake" }).generate(request)).text).toContain("Development adapter");
  });
  it("fails startup for explicit development fallbacks and invalid selected AI, without including values", () => {
    for (const flag of [{ DEV_AUTH_BYPASS: "true" }, { ENABLE_DEV_SIMULATOR: "true" }, { BILLING_ADAPTER: "development" }, { MAIL_TRANSPORT: "local" }, { MAIL_PREVIEW_ENABLED: "true" }]) {
      expect(() => assertProductionConfiguration({ ...production, ...flag })).toThrow("production_development_configuration_forbidden");
      expect(() => assertProductionConfiguration({ ...production, ...flag, NODE_ENV: "development" })).not.toThrow();
    }
    for (const config of [{ AI_PROVIDER: "unknown-secret-value" }, { AI_PROVIDER: "openai-compatible" }, { AI_PROVIDER: "openai-compatible", AI_API_KEY: "fixture", AI_API_BASE_URL: "http://localhost:1234" }]) {
      expect(() => assertProductionConfiguration({ ...production, ...config })).toThrow("ai_configuration_invalid");
    }
    expect(() => getAiProvider({ NODE_ENV: "test", AI_PROVIDER: "openai-compatible", AI_API_KEY: "fixture", AI_API_BASE_URL: "http://127.0.0.1:1234/v1" })).not.toThrow();
  });
});

describe("bounded hosted AI requests", () => {
  it("returns labelled output once and applies a cancellable private POST", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: "Saved rationale [test:fixture]." } }], model: "response-model" }));
    vi.stubGlobal("fetch", fetch);
    expect(await provider().generate(request)).toEqual({ provider: "openai-compatible", model: "response-model", text: "Saved rationale [test:fixture].", generated: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://provider.example.invalid/v1/chat/completions");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toMatchObject({ max_tokens: 600, messages: [{ role: "system", content: request.system }, { role: "user", content: request.prompt }] });
  });
  it("rejects oversized input and token budgets before sending any request", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    for (const req of [{ ...request, maxTokens: 0 }, { ...request, maxTokens: AI_LIMITS.maxTokens + 1 }, { ...request, prompt: "я".repeat(AI_LIMITS.requestBytes) }]) {
      await expect(provider().generate(req)).rejects.toBeInstanceOf(AiProviderError);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("stops both stalled headers and stalled response bodies at the total deadline", async () => {
    vi.useFakeTimers();
    for (const fetch of [vi.fn(() => new Promise(() => {})), vi.fn().mockResolvedValue(new Response(new ReadableStream({ start() {} })))]) {
      vi.stubGlobal("fetch", fetch);
      const pending = provider().generate(request);
      const outcome = expect(pending).rejects.toThrow("ai_timeout");
      await vi.advanceTimersByTimeAsync(AI_LIMITS.timeoutMs + 1); await outcome;
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    }
  });
  it("caps declared and streamed response bytes and rejects malformed JSON/schema", async () => {
    const cases = [
      new Response("{}", { headers: { "content-length": String(AI_LIMITS.responseBytes + 1) } }),
      new Response("x".repeat(AI_LIMITS.responseBytes + 1)),
      new Response("not-json"), Response.json({ choices: [{ message: { content: 123 } }] }), Response.json({ choices: [] }),
    ];
    for (const response of cases) {
      const fetch = vi.fn().mockResolvedValue(response); vi.stubGlobal("fetch", fetch);
      await expect(provider().generate(request)).rejects.toBeInstanceOf(AiProviderError);
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });
  it("redacts upstream body/errors and never retries uncertain provider requests", async () => {
    for (const fetch of [vi.fn().mockResolvedValue(new Response("private-fixture-key " + request.prompt, { status: 429 })), vi.fn().mockRejectedValue(new Error("private-fixture-key " + request.prompt))]) {
      vi.stubGlobal("fetch", fetch);
      const result = await provider().generate(request).catch(error => error as Error);
      expect(result).toBeInstanceOf(AiProviderError);
      expect(String(result)).toBe("AiProviderError: ai_provider_unavailable");
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });
});
