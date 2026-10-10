import { withAiCredentials } from "@/lib/server/ai-context";
import { NextResponse } from "next/server";
import { setLang } from "@/lib/lang";
import type { CheckupResponse } from "@/lib/types";
import { glmConfigured, glmVisionJSON } from "@/lib/ai/glm";
import { CHECKUP_PROMPT, checkupIsEmpty, normalizeCheckup, notACheckup } from "@/lib/ai/checkupAI";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// reading a page takes ten to thirty seconds
export const maxDuration = 120;

const MAX_IMAGES = 6;
const MAX_IMAGE_CHARS = 4_000_000;

/** One page, with a second try: the vision model now and then answers in something other than JSON. */
async function readPage(image: string, prompt: string): Promise<unknown | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await glmVisionJSON<unknown>(prompt, [image], { maxTokens: 3000 });
    } catch (err) {
      console.error(`[医伴] 体检报告识别失败（第 ${attempt + 1} 次）：`, err);
    }
  }
  return null;
}

/**
 * 体检报告建档: reads photos of a check-up report into profile fields.
 * Each photo is read on its own and the pages are put together afterwards: a page copied by
 * itself comes out more accurately than six at once, and the pages are read side by side.
 */
async function handlePOST(req: Request) {
  let body: { images?: unknown; prompt?: unknown };
  try {
    body = (await req.json()) as { images?: unknown; prompt?: unknown };
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  setLang((body as { lang?: unknown } | null)?.lang);
  const images = (Array.isArray(body?.images) ? body.images : [])
    .filter((x): x is string => typeof x === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(x) && x.length <= MAX_IMAGE_CHARS)
    .slice(0, MAX_IMAGES);
  if (!images.length) return NextResponse.json({ error: "缺少 images" }, { status: 400 });
  // A picture cannot be read by rule: without the vision model there is nothing to fall back to.
  if (!glmConfigured()) return NextResponse.json({ error: "识别照片需要先配置 AI", reason: "unavailable" }, { status: 503 });
  // TEMP-DEBUG(w1): remove before hand-off
  const debug = process.env.NODE_ENV !== "production" && new URL(req.url).searchParams.get("debug") === "1";
  const prompt = debug && typeof body.prompt === "string" ? body.prompt : CHECKUP_PROMPT;

  const answers = await Promise.all(images.map((image) => readPage(image, prompt)));
  if (debug && typeof body.prompt === "string") return NextResponse.json({ raw: answers });
  if (answers.every((a) => a == null)) {
    return NextResponse.json({ error: "体检报告识别失败", reason: "failed" }, { status: 502 });
  }
  // photos that could not be read or are something else are named in the result's own notes
  const result = normalizeCheckup(answers);
  if (answers.every((a) => a == null || notACheckup(a)) || checkupIsEmpty(result)) {
    return NextResponse.json({ error: "照片里没有读到体检内容", reason: "unreadable", ...(debug ? { raw: answers } : {}) }, { status: 422 });
  }
  const out: CheckupResponse = { mode: "glm", result };
  return NextResponse.json(debug ? { ...out, raw: answers } : out);
}

export const POST = withAiCredentials(handlePOST);
