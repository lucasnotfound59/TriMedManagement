import { withAiCredentials } from "@/lib/server/ai-context";
import { createHash } from "node:crypto";
import { aiKey } from "@/lib/server/ai-context";
import { NextResponse } from "next/server";
import { glmAsrConfigured, glmTranscribe } from "@/lib/ai/glm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 30 seconds of 16 kHz mono 16-bit audio is about 1 MB.
const MAX_BYTES = 3_000_000;

/** Half a second of very quiet noise as a 16 kHz mono WAV: the smallest thing the speech service will take. */
function tinyClip(): Blob {
  const n = 8000;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(16000, 24);
  buf.writeUInt32LE(32000, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round((Math.random() - 0.5) * 60), 44 + i * 2);
  return new Blob([buf], { type: "audio/wav" });
}

const checks = new Map<string, { ok: boolean; at: number }>();
const credentialId = () => createHash("sha256").update(aiKey("glm") ?? "").digest("hex");
function rememberCheck(ok: boolean) {
  if (checks.size > 100) checks.clear();
  checks.set(credentialId(), { ok, at: Date.now() });
}

/**
 * Whether the speech service works, so the browser knows at the tap whether to listen by itself.
 * Only a refused key, no credit or no answer counts as not working: a complaint about the clip
 * itself means the key was accepted. Kept for ten minutes when it works, one minute when not.
 */
async function handleGET() {
  if (!glmAsrConfigured()) return NextResponse.json({ ok: false });
  const checked = checks.get(credentialId());
  if (checked && Date.now() - checked.at < (checked.ok ? 600_000 : 60_000)) return NextResponse.json({ ok: checked.ok });
  let ok = true;
  try {
    await glmTranscribe(tinyClip(), "check.wav");
  } catch (err) {
    const status = Number(String(err).match(/GLM asr (\d{3})/)?.[1] ?? 0);
    ok = status === 400 || status === 422;
    if (!ok) console.error("[医伴] 语音识别不可用：", String(err).slice(0, 200));
  }
  rememberCheck(ok);
  return NextResponse.json({ ok });
}

/** Speech to text for one short clip. The browser sends 16 kHz mono WAV, at most 30 seconds. */
async function handlePOST(req: Request) {
  if (!glmAsrConfigured()) return NextResponse.json({ error: "语音识别需要先配置 AI" }, { status: 503 });
  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return NextResponse.json({ error: "请求体不是合法的表单" }, { status: 400 });
  }
  if (!file || file.size === 0) return NextResponse.json({ error: "缺少录音" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "录音太长" }, { status: 413 });
  try {
    const text = await glmTranscribe(file, "speech.wav");
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[医伴] 语音识别失败：", err);
    if (/GLM asr (401|403|429)/.test(String(err))) rememberCheck(false);
    return NextResponse.json({ error: "speech_unavailable" }, { status: 502 });
  }
}

export const GET = withAiCredentials(handleGET);

export const POST = withAiCredentials(handlePOST);
