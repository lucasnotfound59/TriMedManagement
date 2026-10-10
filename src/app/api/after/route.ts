import { withAiCredentials } from "@/lib/server/ai-context";
import { NextResponse } from "next/server";
import { setLang } from "@/lib/lang";
import type { AfterRequest, AfterResponse } from "@/lib/types";
import { glmConfigured, glmJSONWithRetry, glmVisionJSON } from "@/lib/ai/glm";
import { AFTER_PHOTO_PROMPT, afterContext, buildAfterTextMessages } from "@/lib/ai/prompts";
import { afterIsEmpty, normalizeAfter } from "@/lib/ai/normalize";
import { fallbackAfter } from "@/lib/ai/fallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGES = 6;
const MAX_IMAGE_CHARS = 4_000_000;

/** "看完医生了": organises what the doctor said, from the user's words or from photos. */
async function handlePOST(req: Request) {
  let body: AfterRequest;
  try {
    body = (await req.json()) as AfterRequest;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  setLang((body as { lang?: unknown } | null)?.lang);
  if (!body?.profile) return NextResponse.json({ error: "缺少 profile" }, { status: 400 });
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
  const images = (Array.isArray(body.images) ? body.images : []).filter(
    (x): x is string => typeof x === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(x) && x.length <= MAX_IMAGE_CHARS,
  );
  if (!text && !images.length) return NextResponse.json({ error: "缺少 text 或 images" }, { status: 400 });
  const request: AfterRequest = { profile: body.profile, episode: body.episode ?? null, text: text || undefined, previous: typeof body.previous === "string" ? body.previous.slice(0, 3000) : undefined };

  if (images.length) {
    if (!glmConfigured()) {
      // A picture cannot be read by rule. Words can, so fall back to those when there are any.
      if (text) return NextResponse.json(fallbackAfter(request));
      return NextResponse.json({ error: "识别照片需要先配置 AI", reason: "unavailable" }, { status: 503 });
    }
    try {
      const prompt = `${AFTER_PHOTO_PROMPT}\n\n---\n背景资料：\n\n${afterContext(request)}${
        text ? `\n\n【患者补充的话】\n${text}` : ""
      }`;
      const raw = await glmVisionJSON<unknown>(prompt, images.slice(0, MAX_IMAGES), { maxTokens: 1400 });
      const result = normalizeAfter(raw, request, true);
      if (afterIsEmpty(result)) {
        return NextResponse.json({ error: "照片里没有读到就诊内容", reason: "unreadable" }, { status: 422 });
      }
      const out: AfterResponse = { mode: "glm", result };
      return NextResponse.json(out);
    } catch (err) {
      console.error("[医伴] 照片识别失败：", err);
      if (text) return NextResponse.json({ ...fallbackAfter(request), error: String(err) });
      return NextResponse.json({ error: String(err), reason: "failed" }, { status: 502 });
    }
  }

  if (!glmConfigured()) return NextResponse.json(fallbackAfter(request));
  try {
    const raw = await glmJSONWithRetry<unknown>(buildAfterTextMessages(request), { maxTokens: 1200, temperature: 0.2 });
    const out: AfterResponse = { mode: "glm", result: normalizeAfter(raw, request) };
    return NextResponse.json(out);
  } catch (err) {
    console.error("[医伴] GLM after 失败，降级为规则引擎：", err);
    return NextResponse.json({ ...fallbackAfter(request), error: String(err) });
  }
}

export const POST = withAiCredentials(handlePOST);
