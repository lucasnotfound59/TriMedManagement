import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

async function main() {
  const cwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "visitsmoothie-key-test-"));
  process.chdir(dir);
  process.env.DATA_ENCRYPTION_KEY = "17".repeat(32);
  const db = await import("../../src/lib/server/secure-db");
  const { GET, PUT } = await import("../../src/app/api/ai-key/route");
  const { withAiCredentials, aiKey } = await import("../../src/lib/server/ai-context");
  const glm = await import("../../src/lib/ai/glm");
  try {
    const a = db.createAccountServer("Key Test A", "test-only password 123");
    const b = db.createAccountServer("Key Test B", "test-only password 456");
    assert.ok("account" in a && "account" in b);
    const sidA = db.createSession(a.account.id).token;
    const sidB = db.createSession(b.account.id).token;
    const request = (sid?: string, body?: unknown, origin?: string) => new Request("http://localhost/api/ai-key", {
      method: body === undefined ? "GET" : "PUT",
      headers: { ...(sid ? { cookie: `other=value; ${db.SESSION_COOKIE}=${sid}` } : {}), "Content-Type": "application/json", ...(origin ? { origin } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const keyA = "test-only-zhipu-secret-A";
    const keyB = "test-only-anthropic-secret-B";
    assert.equal((await GET(request())).status, 401);
    assert.equal((await PUT(request(undefined, { provider: "glm", apiKey: keyA }))).status, 401);
    assert.deepEqual(await (await GET(request(sidA))).json(), { configured: false, provider: null });
    assert.equal((await PUT(request(sidA, null))).status, 400);
    for (const body of [{ provider: "bad", apiKey: keyA }, { provider: "glm", apiKey: " " }, { provider: "glm", apiKey: "a b" }, { provider: "glm", apiKey: "x".repeat(4097) }]) {
      assert.equal((await PUT(request(sidA, body))).status, 400);
    }
    assert.equal((await PUT(request(sidA, { provider: "glm", apiKey: keyA }, "http://other.test"))).status, 403);
    const browserFacing = new Request("http://localhost/api/ai-key", {
      method: "PUT", headers: { cookie: `${db.SESSION_COOKIE}=${sidA}`, host: "127.0.0.1:4318", origin: "http://127.0.0.1:4318", "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "glm", apiKey: keyA }),
    });
    assert.equal((await PUT(browserFacing)).status, 200);
    const save = await PUT(request(sidA, { provider: "glm", apiKey: keyA, accountId: b.account.id }));
    assert.equal(save.status, 200);
    assert.ok(!(await save.text()).includes(keyA));
    assert.deepEqual(db.readAiCredentials(a.account.id), { provider: "glm", apiKey: keyA });
    assert.equal(db.readAiCredentials(b.account.id), null);
    await PUT(request(sidB, { provider: "claude", apiKey: keyB }));
    const status = await GET(request(sidA));
    assert.equal(status.headers.get("cache-control"), "no-store");
    assert.deepEqual(await status.json(), { configured: true, provider: "glm" });
    assert.equal(db.readPatientData(a.account.id).state, null);
    const inspection = new DatabaseSync(path.join(dir, ".data/visitsmoothie.sqlite"));
    const rows = JSON.stringify(inspection.prepare("SELECT * FROM ai_credentials").all());
    assert.ok(!rows.includes(keyA) && !rows.includes(keyB));
    inspection.close();

    // A deliberately interleaved pair of requests retains its own credentials after awaits.
    const observed: string[] = [];
    const handler = withAiCredentials(async () => {
      const provider = glm.aiProvider();
      const before = aiKey(provider);
      await new Promise((resolve) => setTimeout(resolve, provider === "glm" ? 15 : 2));
      assert.equal(glm.aiProvider(), provider);
      assert.equal(aiKey(provider), before);
      assert.equal(glm.glmAsrConfigured(), provider === "glm");
      observed.push(before!);
      return Response.json({ configured: glm.glmConfigured() });
    });
    await Promise.all([handler(request(sidA)), handler(request(sidB))]);
    assert.deepEqual(observed.sort(), [keyA, keyB].sort());
    const replacement = "test-only-replacement-key";
    await PUT(request(sidA, { provider: "glm", apiKey: replacement }));
    await withAiCredentials(async () => {
      assert.equal(aiKey("glm"), replacement);
      assert.equal(aiKey("claude"), undefined);
      return Response.json({ ok: true });
    })(request(sidA));

    // Inspect real provider HTTP headers without sending secrets to an external service.
    const originalFetch = globalThis.fetch;
    const sent: string[] = [];
    globalThis.fetch = async (_url, init) => {
      sent.push(new Headers(init?.headers).get("authorization")!);
      return Response.json({ choices: [{ message: { content: '{"ok":true}' } }] });
    };
    try {
      await withAiCredentials(async () => {
        assert.deepEqual(await glm.glmJSON([{ role: "user", content: "test" }]), { ok: true });
        return Response.json({ ok: true });
      })(request(sidA));
      assert.deepEqual(sent, [`Bearer ${replacement}`]);
    } finally { globalThis.fetch = originalFetch; }
    const claudeA = "test-only-anthropic-secret-A";
    await PUT(request(sidA, { provider: "claude", apiKey: claudeA }));
    const anthropicSent: string[] = [];
    globalThis.fetch = async (_url, init) => {
      anthropicSent.push(new Headers(init?.headers).get("x-api-key")!);
      return Response.json({ id: "test-msg", type: "message", role: "assistant", content: [{ type: "text", text: '{"ok":true}' }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } });
    };
    try {
      const invoke = withAiCredentials(async () => {
        assert.deepEqual(await glm.glmJSON([{ role: "user", content: "test" }]), { ok: true });
        return Response.json({ ok: true });
      });
      await Promise.all([invoke(request(sidA)), invoke(request(sidB))]);
      assert.deepEqual(anthropicSent.sort(), [claudeA, keyB].sort());
    } finally { globalThis.fetch = originalFetch; }
    // Demo identity must not become visible until the real server session is revoked.
    const { enterDemo, SESSION_KEY } = await import("../../src/lib/accounts");
    const { POST: logout } = await import("../../src/app/api/auth/logout/route");
    const priorStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const local = new Map<string, string>([[SESSION_KEY, b.account.id]]);
    const storage: Storage = {
      getItem: (key) => local.get(key) ?? null, setItem: (key, value) => { local.set(key, value); },
      removeItem: (key) => { local.delete(key); }, clear: () => local.clear(),
      key: (index) => [...local.keys()][index] ?? null, get length() { return local.size; },
    };
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    let releaseLogout!: () => void;
    globalThis.fetch = async () => {
      await new Promise<void>((resolve) => { releaseLogout = resolve; });
      return logout(request(sidB));
    };
    try {
      const entering = enterDemo("lin");
      assert.equal(local.get(SESSION_KEY), b.account.id);
      releaseLogout();
      await entering;
      assert.equal(local.get(SESSION_KEY), "demo-lin");
      assert.equal((await GET(request(sidB))).status, 401);
      assert.equal((await PUT(request(sidB, { provider: "glm", apiKey: "test-only-demo-overwrite" }))).status, 401);
      assert.equal(db.readAiCredentials(b.account.id)?.apiKey, keyB);
      local.set(SESSION_KEY, a.account.id);
      globalThis.fetch = async () => new Response(null, { status: 500 });
      await assert.rejects(enterDemo("lin"));
      assert.equal(local.get(SESSION_KEY), a.account.id);
    } finally {
      globalThis.fetch = originalFetch;
      if (priorStorage) Object.defineProperty(globalThis, "localStorage", priorStorage);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
    db.revokeSession(sidA);
    assert.equal((await GET(request(sidA))).status, 401);
    console.log("Account AI keys: authorization, validation, encrypted storage, replacement, request isolation and provider routing passed.");
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
void main();
