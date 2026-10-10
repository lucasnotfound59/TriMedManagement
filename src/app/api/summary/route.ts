import { withAiCredentials } from "@/lib/server/ai-context";
import { NextResponse } from "next/server";
import { setLang } from "@/lib/lang";
import type { SummaryRequest, SummaryResponse } from "@/lib/types";
import { glmConfigured, glmJSONWithRetry } from "@/lib/ai/glm";
import { buildSummaryMessages } from "@/lib/ai/prompts";
import { normalizeSummary } from "@/lib/ai/normalize";
import { fallbackSummary } from "@/lib/ai/fallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePOST(req: Request) {
  let body: SummaryRequest;
  try {
    body = (await req.json()) as SummaryRequest;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  setLang((body as { lang?: unknown } | null)?.lang);
  if (!body?.profile || !body?.episode) {
    return NextResponse.json({ error: "缺少 profile / episode" }, { status: 400 });
  }
  body.related = Array.isArray(body.related) ? body.related : [];
  if (!glmConfigured()) return NextResponse.json(fallbackSummary(body));
  try {
    const raw = await glmJSONWithRetry<unknown>(buildSummaryMessages(body), { maxTokens: 1600, temperature: 0.3 });
    const out: SummaryResponse = { mode: "glm", summary: normalizeSummary(raw, body) };
    // While developing, ?debug=1 also returns what the model wrote before the filters, to check them against it.
    if (process.env.NODE_ENV !== "production" && new URL(req.url).searchParams.get("debug") === "1") {
      return NextResponse.json({ ...out, raw });
    }
    return NextResponse.json(out);
  } catch (err) {
    console.error("[医伴] GLM summary 失败，降级为规则引擎：", err);
    return NextResponse.json({ ...fallbackSummary(body), error: String(err) });
  }
}

export const POST = withAiCredentials(handlePOST);
