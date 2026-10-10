import { withAiCredentials } from "@/lib/server/ai-context";
import { NextResponse } from "next/server";
import { setLang } from "@/lib/lang";
import type { AskRecord, AskRequest, AskResponse, Profile } from "@/lib/types";
import { GlmFormatError, glmConfigured, glmJSON } from "@/lib/ai/glm";
import { buildAskMessages, guardAnswer, normalizeAsk } from "@/lib/ai/askAI";
import { askAlert, fallbackAsk, quickAnswer } from "@/lib/ai/askRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: AskRecord["kind"][] = ["visit", "followup", "episode", "checkup", "profile", "metrics", "reminder"];
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Whatever was sent, the rules below get a profile whose lists are lists. */
function cleanProfile(p: Profile): Profile {
  return {
    ...p,
    conditions: list(p.conditions),
    allergies: list(p.allergies),
    medications: list(p.medications),
    surgeries: list(p.surgeries),
    familyHistory: list(p.familyHistory),
  };
}

function cleanRecord(r: AskRecord): AskRecord {
  const f = r.fields && typeof r.fields === "object" ? r.fields : undefined;
  return {
    id: r.id.slice(0, 8),
    kind: KINDS.includes(r.kind) ? r.kind : "episode",
    label: text(r.label, 80),
    href: text(r.href, 200),
    // long enough for a visit with its archive paragraph, or a complaint with a dozen entries
    text: r.text.slice(0, 1600),
    date: text(r.date, 40),
    fields: f && {
      reason: text(f.reason, 200) || undefined,
      where: text(f.where, 200) || undefined,
      diagnosis: text(f.diagnosis, 400) || undefined,
      treatment: text(f.treatment, 800) || undefined,
      advice: text(f.advice, 800) || undefined,
      followUp: text(f.followUp, 400) || undefined,
      findings: text(f.findings, 800) || undefined,
      ago: text(f.ago, 20) || undefined,
    },
  };
}

/** 问医伴: a question about the person's own health, answered from their records. */
async function handlePOST(req: Request) {
  let body: AskRequest;
  try {
    body = (await req.json()) as AskRequest;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  setLang((body as { lang?: unknown } | null)?.lang);
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 500) : "";
  if (!body?.profile || typeof body.profile !== "object" || !question) return NextResponse.json({ error: "缺少 profile / question" }, { status: 400 });
  const request: AskRequest = {
    profile: cleanProfile(body.profile),
    question,
    history: (Array.isArray(body.history) ? body.history : [])
      .filter((t) => t && typeof t.question === "string" && typeof t.answer === "string")
      .slice(-3)
      .map((t) => ({ question: t.question.slice(0, 500), answer: t.answer.slice(0, 700) })),
    records: (Array.isArray(body.records) ? body.records : [])
      .filter((r): r is AskRecord => Boolean(r) && typeof r.id === "string" && typeof r.text === "string")
      .slice(0, 40)
      .map(cleanRecord),
    localTime: typeof body.localTime === "string" ? body.localTime.slice(0, 60) : undefined,
  };

  // Development only: lets a probe script see what the model said before the filters touched it.
  const debug = process.env.NODE_ENV !== "production" && req.headers.get("x-ask-debug") === "1";

  // Whether the question describes an emergency is decided by rule, whatever the model says.
  const hint = askAlert(question);
  // A question that only asks for something on file is answered by quoting the record.
  const quick = quickAnswer(request);
  if (quick) return NextResponse.json({ mode: "fallback", hint, ...quick } satisfies AskResponse);
  if (!glmConfigured()) return NextResponse.json(fallbackAsk(request));

  try {
    const raw = await glmJSON<unknown>(buildAskMessages(request), { maxTokens: 700, temperature: 0.3, timeoutMs: 45_000 });
    const out: AskResponse = { mode: "glm", hint, ...normalizeAsk(raw, request) };
    return NextResponse.json(debug ? { ...out, raw } : out);
  } catch (err) {
    if (err instanceof GlmFormatError && err.content.trim()) {
      // answered in plain words instead of JSON: the answer itself is usually fine, so keep it
      const answer = guardAnswer(err.content.trim().slice(0, 700), request);
      if (answer) {
        const out: AskResponse = { mode: "glm", hint, answer, sources: [] };
        return NextResponse.json(debug ? { ...out, raw: err.content } : out);
      }
    }
    console.error("[医伴] GLM ask 失败，降级为规则引擎：", err);
    return NextResponse.json({ ...fallbackAsk(request), error: String(err) });
  }
}

export const POST = withAiCredentials(handlePOST);
