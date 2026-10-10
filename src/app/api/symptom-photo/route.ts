import { withAiCredentials } from "@/lib/server/ai-context";
import { NextResponse } from "next/server";
import { glmConfigured, glmVisionJSON } from "@/lib/ai/glm";
import { getLang, setLang } from "@/lib/lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGES = 4;
const MAX_IMAGE_CHARS = 4_000_000;
const MAX_LEN = 80;

/*
 * pre: a photo of what is wrong (a rash, a wound, a swelling). Only what can be seen is put into
 * words: where, what colour, how big, what shape. Nothing is named and no cause is guessed.
 */

const PROMPT = `你在帮患者把一张症状照片写成一句客观描述，给医生看。
只写照片上看得见的：在身体哪个部位（看得出才写，左右看不出就不写左右）、颜色、大概大小（只用照片里能比的东西，如「约硬币大小」「约手掌大小」，比不出就写「一小片」「一大片」）、形状和边界、表面（有没有破皮、水疱、渗液、结痂、肿起）。
不许诊断，不许写任何病名（如湿疹、荨麻疹、皮炎、感染、过敏、疱疹、癣、蜂窝织炎），不许猜原因，不许给建议，不写照片上没有的东西。
一句话，不超过 50 个字，{LANG}。
照片上看不到身体或症状（比如是文字、风景、纸张），visible 填 false。
只输出 JSON：{"visible": true, "description": "右小腿外侧一片红色斑块，约硬币大小，圆形，边界清楚，表面没有破皮"}`;

/** Words that name or explain rather than describe. A clause that has one is dropped. */
const NAMES = /[炎癣疹癌瘤]|病|症|感染|过敏|疱疹|湿疹|荨麻|可能|疑似|考虑|建议|应该|引起|导致|由于|因为/;
/** the same, for a description written in English */
const NAMES_EN = /eczema|hives|urticaria|dermatitis|infect|allerg|herpes|shingles|cellulitis|fungal|ringworm|psoriasis|cancer|tumou?r|disease|possibl|maybe|likely|suspect|suggest|should|caused|due to|because/i;

/** Keeps the clauses that only describe what is seen. */
function cleanDescription(raw: unknown): string {
  const text = typeof raw === "string" ? raw.trim() : "";
  // 皮疹 and 红疹 are what is seen, not a diagnosis: allowed through before the check
  const en = getLang() === "en";
  const kept = text
    .split(/[，,；;。]|\.\s/)
    .map((c) => c.trim().replace(/\.$/, ""))
    .filter((c) => c && !(en ? NAMES_EN.test(c) : NAMES.test(c.replace(/[皮红丘]疹/g, ""))));
  return en ? kept.join(", ").slice(0, MAX_LEN * 2) : kept.join("，").slice(0, MAX_LEN);
}

async function handlePOST(req: Request) {
  let body: { images?: unknown; lang?: unknown };
  try {
    body = (await req.json()) as { images?: unknown; lang?: unknown };
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  setLang(body?.lang);
  const images = (Array.isArray(body?.images) ? body.images : []).filter(
    (x): x is string => typeof x === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(x) && x.length <= MAX_IMAGE_CHARS,
  );
  if (!images.length) return NextResponse.json({ error: "缺少 images" }, { status: 400 });
  if (!glmConfigured()) return NextResponse.json({ error: "认照片需要先配置 AI", reason: "unavailable" }, { status: 503 });
  try {
    const raw = await glmVisionJSON<{ visible?: unknown; description?: unknown }>(PROMPT.replace("{LANG}", getLang() === "en" ? "用英文写（English, at most 30 words）" : "中文"), images.slice(0, MAX_IMAGES), { maxTokens: 400 });
    const description = raw?.visible === false ? "" : cleanDescription(raw?.description);
    if (!description) return NextResponse.json({ error: "照片上没有看到症状", reason: "unreadable" }, { status: 422 });
    return NextResponse.json({ mode: "glm", description });
  } catch (err) {
    console.error("[医伴] 症状照片识别失败：", err);
    return NextResponse.json({ error: String(err), reason: "failed" }, { status: 502 });
  }
}

export const POST = withAiCredentials(handlePOST);
