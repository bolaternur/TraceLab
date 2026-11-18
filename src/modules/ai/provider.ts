/**
 * AI provider abstraction. The Evidence Core never depends on this.
 * Providers: disabled (default), deterministic fake (dev/tests), openai-compatible (hosted, env-configured).
 */
export interface AiGenerateRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface AiGenerateResult {
  provider: string;
  model: string | null;
  text: string;
  generated: boolean; // false when provider is disabled / deterministic
}

export interface AiProvider {
  readonly name: string;
  readonly enabled: boolean;
  generate(req: AiGenerateRequest): Promise<AiGenerateResult>;
}

export const AI_LIMITS = Object.freeze({ requestBytes: 32 * 1024, responseBytes: 256 * 1024, maxTokens: 4096, timeoutMs: 15_000 });

/** Stable error codes only: provider bodies, private prompts and credentials never enter logs. */
export class AiProviderError extends Error {
  constructor(readonly code: string) { super(code); this.name = "AiProviderError"; }
}

function requestBody(req: AiGenerateRequest, model: string) {
  const tokens = req.maxTokens ?? 600;
  if (typeof req.system !== "string" || typeof req.prompt !== "string" || !Number.isInteger(tokens) || tokens < 1 || tokens > AI_LIMITS.maxTokens) {
    throw new AiProviderError("ai_request_invalid");
  }
  const body = JSON.stringify({ model, max_tokens: tokens, messages: [{ role: "system", content: req.system }, { role: "user", content: req.prompt }] });
  if (new TextEncoder().encode(body).byteLength > AI_LIMITS.requestBytes) throw new AiProviderError("ai_request_too_large");
  return body;
}

function endpoint(base: string, env: NodeJS.ProcessEnv) {
  let url: URL;
  try { url = new URL(base); } catch { throw new AiProviderError("ai_configuration_invalid"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || !(url.protocol === "https:" || (env.NODE_ENV !== "production" && local && url.protocol === "http:"))) {
    throw new AiProviderError("ai_configuration_invalid");
  }
  return `${url.href.replace(/\/$/, "")}/chat/completions`;
}

async function readBoundedJson(response: Response) {
  const length = response.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > AI_LIMITS.responseBytes)) throw new AiProviderError("ai_response_too_large");
  if (!response.body) throw new AiProviderError("ai_response_invalid");
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > AI_LIMITS.responseBytes) { void reader.cancel().catch(() => {}); throw new AiProviderError("ai_response_too_large"); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown; }
  catch { throw new AiProviderError("ai_response_invalid"); }
}

export class DisabledProvider implements AiProvider {
  readonly name = "disabled";
  readonly enabled = false;
  async generate(): Promise<AiGenerateResult> {
    return { provider: this.name, model: null, text: "", generated: false };
  }
}

/** Development adapter. Echoes a deterministic transformation so tests are reproducible. */
export class DeterministicFakeProvider implements AiProvider {
  readonly name = "deterministic-fake";
  readonly enabled = true;
  async generate(req: AiGenerateRequest): Promise<AiGenerateResult> {
    if (process.env.NODE_ENV === "production") throw new AiProviderError("ai_development_provider_forbidden");
    const lines = req.prompt.split("\n").filter(Boolean).slice(0, 12);
    return {
      provider: this.name,
      model: "fake-v1",
      text: `[Development adapter — not a real model]\n${lines.join("\n")}`,
      generated: true,
    };
  }
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = "openai-compatible";
  readonly enabled = true;
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}
  async generate(req: AiGenerateRequest): Promise<AiGenerateResult> {
    const body = requestBody(req, this.model), url = endpoint(this.baseUrl, this.env);
    if (!this.apiKey.trim() || !this.model.trim() || this.model.length > 200) throw new AiProviderError("ai_configuration_invalid");
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => { controller.abort(); reject(new AiProviderError("ai_timeout")); }, AI_LIMITS.timeoutMs);
    });
    try {
      // No automatic retry: private requests have no provider-independent idempotency contract.
      return await Promise.race([deadline, (async () => {
        const res = await fetch(url, { method: "POST", signal: controller.signal, headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` }, body });
        if (!res.ok) { void res.body?.cancel().catch(() => {}); throw new AiProviderError("ai_provider_unavailable"); }
        const value = await readBoundedJson(res);
        if (!value || typeof value !== "object") throw new AiProviderError("ai_response_invalid");
        const json = value as { choices?: Array<{ message?: { content?: unknown } }>; model?: unknown };
        const text = Array.isArray(json.choices) ? json.choices[0]?.message?.content : null;
        if (typeof text !== "string" || !text.trim() || (json.model !== undefined && (typeof json.model !== "string" || json.model.length > 200))) throw new AiProviderError("ai_response_invalid");
        return { provider: this.name, model: typeof json.model === "string" ? json.model : this.model, text, generated: true };
      })()]);
    } catch (error) {
      controller.abort();
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError("ai_provider_unavailable");
    } finally { if (timeout) clearTimeout(timeout); }
  }
}

export function getAiProvider(env: NodeJS.ProcessEnv = process.env): AiProvider {
  const kind = env.AI_PROVIDER ?? "disabled";
  if (kind === "fake") {
    if (env.NODE_ENV === "production") throw new AiProviderError("ai_development_provider_forbidden");
    return new DeterministicFakeProvider();
  }
  if (kind === "openai-compatible") {
    const base = env.AI_API_BASE_URL ?? "https://api.openai.com/v1";
    const key = env.AI_API_KEY;
    const model = env.AI_MODEL ?? "gpt-4o-mini";
    if (!key?.trim() || !model.trim() || model.length > 200) throw new AiProviderError("ai_configuration_invalid");
    endpoint(base, env);
    return new OpenAiCompatibleProvider(base, key, model, env);
  }
  if (kind !== "disabled") throw new AiProviderError("ai_configuration_invalid");
  return new DisabledProvider();
}
