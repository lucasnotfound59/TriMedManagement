import { withAiCredentials } from "@/lib/server/ai-context";
import { NextResponse } from "next/server";
import { setLang } from "@/lib/lang";
import type { ProfileParseResponse } from "@/lib/types";
import { glmConfigured, glmJSONWithRetry } from "@/lib/ai/glm";
import { buildProfileMessages } from "@/lib/ai/prompts";
import { normalizeProfile } from "@/lib/ai/normalize";
import { fallbackProfile } from "@/lib/ai/fallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Splits one free sentence about history, allergies and medicines into profile fields. */
async function handlePOST(req: Request) {
  let text = "";
  try {
    const body = (await req.json()) as { text?: unknown; lang?: unknown };
    setLang(body?.lang);
    text = typeof body?.text === "string" ? body.text.trim().slice(0, 1000) : "";
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "缺少 text" }, { status: 400 });
  if (!glmConfigured()) return NextResponse.json(fallbackProfile(text));
  try {
    const raw = await glmJSONWithRetry<unknown>(buildProfileMessages(text), { maxTokens: 400, temperature: 0.1, timeoutMs: 20_000 });
    const out: ProfileParseResponse = { mode: "glm", ...normalizeProfile(raw) };
    return NextResponse.json(out);
  } catch (err) {
    console.error("[医伴] GLM profile 失败，降级为规则引擎：", err);
    return NextResponse.json({ ...fallbackProfile(text), error: String(err) });
  }
}

export const POST = withAiCredentials(handlePOST);
