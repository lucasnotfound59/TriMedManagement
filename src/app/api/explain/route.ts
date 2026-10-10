import { withAiCredentials } from "@/lib/server/ai-context";
import { NextResponse } from "next/server";
import { setLang } from "@/lib/lang";
import type { AfterResult, Profile } from "@/lib/types";
import { GlmFormatError, glmConfigured, glmJSON } from "@/lib/ai/glm";
import { buildExplainMessages, fallbackExplain, guardExplain, type ExplainTurn } from "@/lib/ai/ordersAI";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** 医嘱 b: explains one part of the doctor's orders in plain words. */
async function handlePOST(req: Request) {
  let body: { profile?: Profile; result?: AfterResult; part?: string; history?: unknown; previous?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  // the explanation is in the language of the interface
  setLang(body?.lang);
  const part = typeof body?.part === "string" ? body.part.trim().slice(0, 200) : "";
  if (!body?.profile || !body.result || !part) return NextResponse.json({ error: "缺少 profile / result / part" }, { status: 400 });
  const p = body.profile;
  const profile: Profile = { ...p, conditions: list(p.conditions), allergies: list(p.allergies), medications: list(p.medications), surgeries: list(p.surgeries), familyHistory: list(p.familyHistory) };
  const r = body.result;
  const result: AfterResult = {
    ...r,
    findings: list(r.findings),
    procedures: list(r.procedures),
    medications: Array.isArray(r.medications) ? r.medications.filter((m) => m && typeof m.name === "string").map((m) => ({ ...m, usage: String(m.usage ?? "") })) : [],
    unclear: list(r.unclear),
    readings: [],
  };

  // earlier questions and answers about the same line, for a follow-up asked in the same place
  const history: ExplainTurn[] = Array.isArray(body.history)
    ? body.history
        .filter((t): t is ExplainTurn => Boolean(t) && typeof (t as ExplainTurn).q === "string" && typeof (t as ExplainTurn).a === "string")
        .slice(-6)
        .map((t) => ({ q: t.q.slice(0, 200), a: t.a.slice(0, 1200) }))
    : [];

  if (!glmConfigured()) return NextResponse.json({ mode: "fallback", answer: fallbackExplain(result, part) });
  try {
    const raw = await glmJSON<{ answer?: unknown }>(buildExplainMessages(profile, result, part, history, typeof body.previous === "string" ? body.previous.slice(0, 3000) : undefined), { maxTokens: 700, temperature: 0.3, timeoutMs: 45_000 });
    const answer = guardExplain(typeof raw?.answer === "string" ? raw.answer : "", profile, result, part);
    return NextResponse.json({ mode: "glm", answer: answer || fallbackExplain(result, part) });
  } catch (err) {
    if (err instanceof GlmFormatError && err.content.trim()) {
      const answer = guardExplain(err.content.trim(), profile, result, part);
      if (answer) return NextResponse.json({ mode: "glm", answer });
    }
    console.error("[医伴] 解释医嘱失败，降级为规则：", err);
    return NextResponse.json({ mode: "fallback", answer: fallbackExplain(result, part), error: String(err) });
  }
}

export const POST = withAiCredentials(handlePOST);
