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
  ) {}
  async generate(req: AiGenerateRequest): Promise<AiGenerateResult> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        max_tokens: req.maxTokens ?? 600,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI provider error ${res.status}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; model?: string };
    return {
      provider: this.name,
      model: json.model ?? this.model,
      text: json.choices?.[0]?.message?.content ?? "",
      generated: true,
    };
  }
}

export function getAiProvider(): AiProvider {
  const kind = process.env.AI_PROVIDER ?? "disabled";
  if (kind === "fake") return new DeterministicFakeProvider();
  if (kind === "openai-compatible") {
    const base = process.env.AI_API_BASE_URL ?? "https://api.openai.com/v1";
    const key = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL ?? "gpt-4o-mini";
    if (!key) return new DisabledProvider();
    return new OpenAiCompatibleProvider(base, key, model);
  }
  return new DisabledProvider();
}
