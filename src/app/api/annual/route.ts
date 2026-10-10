import { withAiCredentials } from "@/lib/server/ai-context";
import { NextResponse } from "next/server";
import { setLang } from "@/lib/lang";
import type { AnnualRequest, AnnualResponse } from "@/lib/types";
import { glmConfigured, glmJSONWithRetry } from "@/lib/ai/glm";
import { buildAnnualMessages } from "@/lib/ai/prompts";
import { normalizeAnnual } from "@/lib/ai/normalize";
import { fallbackAnnual } from "@/lib/ai/fallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePOST(req: Request) {
  let body: AnnualRequest;
  try {
    body = (await req.json()) as AnnualRequest;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  setLang((body as { lang?: unknown } | null)?.lang);
  if (!body?.profile || !body?.facts || !Array.isArray(body.facts.episodes)) {
    return NextResponse.json({ error: "缺少 profile / facts" }, { status: 400 });
  }
  if (!glmConfigured()) return NextResponse.json(fallbackAnnual(body));
  try {
    const raw = await glmJSONWithRetry<unknown>(buildAnnualMessages(body), { maxTokens: 2200, temperature: 0.3 });
    const out: AnnualResponse = { mode: "glm", summary: normalizeAnnual(raw, body) };
    return NextResponse.json(out);
  } catch (err) {
    console.error("[医伴] GLM annual 失败，降级为规则引擎：", err);
    return NextResponse.json({ ...fallbackAnnual(body), error: String(err) });
  }
}

export const POST = withAiCredentials(handlePOST);
