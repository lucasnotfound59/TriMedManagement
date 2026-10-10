/**
 * Server-side model client. Chat and photos go to the provider set in AI_PROVIDER: "glm" (Zhipu,
 * OpenAI-compatible API) or "claude" (Anthropic API). Left unset, it is Claude when an Anthropic key
 * is configured and GLM otherwise. Speech to text is always Zhipu GLM, which Claude has no counterpart
 * for. The exported names are kept from the GLM days.
 */

import Anthropic from "@anthropic-ai/sdk";
import { aiCredentialsContext, aiKey } from "../server/ai-context";
import { ENGLISH_OUTPUT, getLang } from "../lang";

export interface GlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const has = (v: string | undefined) => Boolean(v && v.trim());

/** Which provider answers chat and reads photos. */
export function aiProvider(): "glm" | "claude" {
  const saved = aiCredentialsContext.getStore();
  if (saved) return saved.provider;
  const set = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (set === "glm" || set === "claude") return set;
  return has(aiKey("claude")) ? "claude" : "glm";
}

function anthropic() {
  return new Anthropic({ apiKey: aiKey("claude"), maxRetries: 1 });
}

function glmBaseUrl() {
  return (process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4").replace(/\/$/, "");
}

/** While the app is in English, the last user turn carries the instruction to answer in English. */
function inLanguage(messages: GlmMessage[]): GlmMessage[] {
  if (getLang() !== "en") return messages;
  const last = messages.map((m) => m.role).lastIndexOf("user");
  if (last < 0) return [...messages, { role: "user", content: ENGLISH_OUTPUT }];
  return messages.map((m, i) => (i === last ? { ...m, content: `${m.content}\n\n${ENGLISH_OUTPUT}` } : m));
}

export function glmModel() {
  return aiProvider() === "glm" ? process.env.GLM_MODEL || "glm-5" : process.env.CLAUDE_MODEL || "claude-opus-5-5";
}

export function glmConfigured() {
  return aiProvider() === "glm" ? has(aiKey("glm")) : has(aiKey("claude"));
}

/** The model answered, but not in JSON. `content` is what it said. */
export class GlmFormatError extends Error {
  readonly content: string;
  constructor(content: string) {
    super("模型返回的不是 JSON");
    this.name = "GlmFormatError";
    this.content = content;
  }
}

export function parseJSONContent<T>(content: string): T {
  let s = content.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s) as T;
}

/**
 * One request to Claude, returning its text. Thinking cannot be turned off on Opus 5.5 and counts
 * against max_tokens, so the callers' small token caps are not passed on; low effort keeps it quick.
 * Sampling parameters (temperature) are not accepted by the model either.
 */
async function claudeText(system: string, messages: Anthropic.Beta.BetaMessageParam[], timeoutMs: number): Promise<string> {
  const res = await anthropic().beta.messages.create(
    {
      model: glmModel(),
      max_tokens: 16000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      ...(system ? { system } : {}),
      messages,
    },
    { timeout: timeoutMs },
  ).catch((err: unknown) => {
    // Provider errors can contain request details. Keep credentials out of callers and logs.
    const status = err instanceof Anthropic.APIError ? err.status : undefined;
    throw new Error(status ? `Claude ${status}` : "Claude connection failed");
  });
  if (res.stop_reason === "refusal") throw new Error(`Claude 拒绝回答: ${res.stop_details?.category ?? ""}`);
  const content = res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!content) throw new Error("Claude 返回为空");
  return content;
}

/** One request to GLM's chat endpoint (also used for photos, with the vision model), returning its text. */
async function glmText(body: Record<string, unknown>, timeoutMs: number, what = "GLM"): Promise<string> {
  const key = aiKey("glm");
  if (!key) throw new Error("GLM_API_KEY 未配置");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${glmBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ thinking: { type: "disabled" }, ...body }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${what} ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data?.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error(`${what} 返回为空`);
    return content;
  } finally {
    clearTimeout(timer);
  }
}

export async function glmJSON<T>(
  messages: GlmMessage[],
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {},
): Promise<T> {
  if (!glmConfigured()) throw new Error(aiProvider() === "glm" ? "GLM_API_KEY 未配置" : "ANTHROPIC_API_KEY 未配置");
  const all = inLanguage(messages);
  const timeoutMs = opts.timeoutMs ?? 90_000;
  let content: string;
  if (aiProvider() === "glm") {
    content = await glmText(
      {
        model: glmModel(),
        messages: all,
        temperature: opts.temperature ?? 0.5,
        max_tokens: opts.maxTokens ?? 800,
        response_format: { type: "json_object" },
      },
      timeoutMs,
    );
  } else {
    const system = all.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const turns = all.filter((m) => m.role !== "system").map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    content = await claudeText(system, turns, timeoutMs);
  }
  try {
    return parseJSONContent<T>(content);
  } catch {
    throw new GlmFormatError(content);
  }
}

/** For documents that must be structured: one more try when the model ignores the format. */
export async function glmJSONWithRetry<T>(
  messages: GlmMessage[],
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {},
): Promise<T> {
  try {
    return await glmJSON<T>(messages, opts);
  } catch (err) {
    if (!(err instanceof GlmFormatError)) throw err;
    return glmJSON<T>(messages, opts);
  }
}

export async function glmPing(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await glmJSON<{ ok: boolean }>(
      [
        { role: "system", content: '只输出 JSON：{"ok": true}' },
        { role: "user", content: "ping" },
      ],
      { maxTokens: 20, timeoutMs: 30_000 },
    );
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error && /\b(401|403|429)\b/.test(err.message) ? "provider_rejected" : "connection_failed" };
  }
}

/* ---------- photos and speech ---------- */

export function glmVisionModel() {
  return aiProvider() === "glm" ? process.env.GLM_VISION_MODEL || "glm-4.6v" : glmModel();
}

export function glmAsrModel() {
  return process.env.GLM_ASR_MODEL || "glm-asr-2512";
}

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function imageBlock(dataUrl: string): Anthropic.Beta.BetaImageBlockParam {
  const m = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
  if (!m) return { type: "image", source: { type: "url", url: dataUrl } };
  const media = m[1].toLowerCase().replace("image/jpg", "image/jpeg") as ImageMediaType;
  return { type: "image", source: { type: "base64", media_type: media, data: m[2] } };
}

/** Reads one or more photos (data URLs) with the vision model and returns its JSON answer. */
export async function glmVisionJSON<T>(prompt: string, images: string[], opts: { maxTokens?: number } = {}): Promise<T> {
  if (!glmConfigured()) throw new Error(aiProvider() === "glm" ? "GLM_API_KEY 未配置" : "ANTHROPIC_API_KEY 未配置");
  const text = getLang() === "en" ? `${prompt}\n\n${ENGLISH_OUTPUT}` : prompt;
  const content =
    aiProvider() === "glm"
      ? await glmText(
          {
            model: glmVisionModel(),
            temperature: 0.1,
            max_tokens: opts.maxTokens ?? 1200,
            messages: [{ role: "user", content: [{ type: "text", text }, ...images.map((url) => ({ type: "image_url", image_url: { url } }))] }],
          },
          90_000,
          "GLM vision",
        )
      : await claudeText("", [{ role: "user", content: [...images.map(imageBlock), { type: "text", text }] }], 90_000);
  try {
    return parseJSONContent<T>(content);
  } catch {
    throw new GlmFormatError(content);
  }
}

export function glmAsrConfigured() {
  return has(aiKey("glm"));
}

/** Speech to text (Zhipu GLM). The service accepts WAV or MP3, at most 30 seconds per request. */
export async function glmTranscribe(file: Blob, filename = "speech.wav"): Promise<string> {
  const key = aiKey("glm");
  if (!key) throw new Error("GLM_API_KEY 未配置");
  const form = new FormData();
  form.append("model", glmAsrModel());
  form.append("stream", "false");
  form.append("file", file, filename);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(`${glmBaseUrl()}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`GLM asr ${res.status}`);
    const data = (await res.json()) as { text?: string };
    return (data.text ?? "").trim();
  } finally {
    clearTimeout(timer);
  }
}
