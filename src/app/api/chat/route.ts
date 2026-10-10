import { withAiCredentials } from "@/lib/server/ai-context";
import { NextResponse } from "next/server";
import { setLang } from "@/lib/lang";
import type { ChatRequest, ChatResponse } from "@/lib/types";
import { GlmFormatError, glmConfigured, glmJSON } from "@/lib/ai/glm";
import { buildChatMessages } from "@/lib/ai/prompts";
import { normalizeChat, repeatedQuestion, salvageChat, withoutQuestion } from "@/lib/ai/normalize";
import { fallbackChat } from "@/lib/ai/fallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPTS = { maxTokens: 700, temperature: 0.5 };

/** One model call, with a plain-text answer kept rather than thrown away. */
async function ask(body: ChatRequest, avoid?: string): Promise<ChatResponse> {
  try {
    // the second attempt runs a little warmer, so it does not land on the same wording again
    const opts = avoid ? { ...OPTS, temperature: 0.8 } : OPTS;
    return normalizeChat(await glmJSON<unknown>(buildChatMessages(body, { avoid }), opts), body);
  } catch (err) {
    if (err instanceof GlmFormatError && err.content.trim()) {
      console.warn("[医伴] GLM chat 没有按 JSON 返回，保留它的回答并用规则补全结构");
      return salvageChat(err.content, body);
    }
    throw err;
  }
}

async function handlePOST(req: Request) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  setLang((body as { lang?: unknown } | null)?.lang);
  if (!body?.profile || !body?.episode || !Array.isArray(body?.messages)) {
    return NextResponse.json({ error: "缺少 profile / episode / messages" }, { status: 400 });
  }
  if (!glmConfigured()) return NextResponse.json(fallbackChat(body));
  try {
    let out = await ask(body);
    // The model sometimes asks again what it has just asked, when the answer was off the point.
    // Tell it so once; if it still insists, keep its acknowledgement and drop the question.
    const repeated = repeatedQuestion(out.reply, body.messages);
    if (repeated) {
      console.warn(`[医伴] GLM 重复了问题「${repeated}」，要求它换一个`);
      try {
        const second = await ask(body, repeated);
        out = repeatedQuestion(second.reply, body.messages) ? withoutQuestion(out) : second;
      } catch {
        out = withoutQuestion(out);
      }
    }
    return NextResponse.json(out);
  } catch (err) {
    console.error("[医伴] GLM chat 失败，降级为规则引擎：", err);
    return NextResponse.json({ ...fallbackChat(body), error: String(err) });
  }
}

export const POST = withAiCredentials(handlePOST);
