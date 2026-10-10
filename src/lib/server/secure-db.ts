/*
 * 服务端安全存储：账号、会话、以及每个患者一份的加密数据。
 *
 * - 密码用 scrypt 加盐哈希，数据库和日志里都不出现明文密码。
 * - 患者的档案与就诊记录整体作为一个 JSON，用 AES-256-GCM 加密后落盘；
 *   密钥只来自环境变量 DATA_ENCRYPTION_KEY（.env.local，已被 gitignore）。
 *   数据库文件被拿走而没有密钥，读不出任何内容。
 * - 每一行患者数据都以账号 id 为主键互相隔开；所有读取都经过会话 Cookie
 *   解析出的账号，代码层面不存在"指定别人的 id 查数据"的入口。
 * - 数据库放在 .data/ 目录，已被 gitignore，永远不会进入 GitHub。
 */

import { DatabaseSync } from "node:sqlite";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/* ---------- 数据库文件 ---------- */

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "visitsmoothie.sqlite");

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS accounts (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      name_key   TEXT NOT NULL UNIQUE,
      salt       TEXT NOT NULL,
      hash       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS patient_data (
      account_id TEXT PRIMARY KEY REFERENCES accounts(id),
      version    INTEGER NOT NULL DEFAULT 0,
      iv         TEXT NOT NULL,
      blob       TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_credentials (
      account_id TEXT PRIMARY KEY REFERENCES accounts(id),
      iv         TEXT NOT NULL,
      blob       TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
  `);
  return db;
}

/* ---------- 主密钥（只存在于环境变量 / .env.local） ---------- */

let masterKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (masterKey) return masterKey;
  let hexKey = process.env.DATA_ENCRYPTION_KEY?.trim() ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    // 本地开发零配置：自动生成一把新密钥并写进 .env.local（该文件已被 gitignore）。
    hexKey = randomBytes(32).toString("hex");
    const envPath = path.join(process.cwd(), ".env.local");
    const line = `\n# 患者数据加密主密钥（自动生成，勿提交、勿外泄；丢失则已有数据无法解密）\nDATA_ENCRYPTION_KEY=${hexKey}\n`;
    try {
      fs.appendFileSync(envPath, line, "utf8");
      console.info("[secure-db] 已生成新的 DATA_ENCRYPTION_KEY 并写入 .env.local");
    } catch (err) {
      console.warn("[secure-db] 无法写入 .env.local，本次运行的密钥只保存在内存中", err);
    }
    process.env.DATA_ENCRYPTION_KEY = hexKey;
  }
  masterKey = Buffer.from(hexKey, "hex");
  return masterKey;
}

/* ---------- AES-256-GCM ---------- */

function encryptText(plain: string): { iv: string; blob: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getMasterKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // blob = authTag(16B) || ciphertext
  return { iv: iv.toString("hex"), blob: Buffer.concat([tag, body]).toString("base64") };
}

function decryptText(ivHex: string, blobB64: string): string {
  const raw = Buffer.from(blobB64, "base64");
  const tag = raw.subarray(0, 16);
  const body = raw.subarray(16);
  const decipher = createDecipheriv("aes-256-gcm", getMasterKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

/* ---------- 密码 ---------- */

const newSalt = () => randomBytes(16).toString("hex");

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString("hex");
}

/* ---------- 姓名规范化（与前端 accounts.ts 同一套规则） ---------- */

export function nameKeyServer(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function displayName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ");
}

/* ---------- 登录限流：同一姓名连错 5 次，锁 60 秒 ---------- */

const attempts = new Map<string, { fails: number; until: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 60_000;

function loginLocked(nameKey: string): number {
  const rec = attempts.get(nameKey);
  if (rec && rec.until > Date.now()) return rec.until - Date.now();
  return 0;
}

function recordFail(nameKey: string) {
  const rec = attempts.get(nameKey) ?? { fails: 0, until: 0 };
  rec.fails += 1;
  if (rec.fails >= MAX_FAILS) {
    rec.until = Date.now() + LOCK_MS;
    rec.fails = 0;
  }
  attempts.set(nameKey, rec);
}

/* ---------- 账号 ---------- */

export interface ServerAccount {
  id: string;
  name: string;
}

export function createAccountServer(
  name: string,
  password: string,
): { account: ServerAccount } | { error: string } | { conflict: true } {
  const key = nameKeyServer(name);
  if (!key) return { error: "还差：姓名。" };
  const d = getDb();
  const dup = d.prepare("SELECT id FROM accounts WHERE name_key = ?").get(key);
  if (dup) return { conflict: true };
  const salt = newSalt();
  const id = crypto.randomUUID();
  d.prepare(
    "INSERT INTO accounts (id, name, name_key, salt, hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, displayName(name), key, salt, hashPassword(password, salt), new Date().toISOString());
  return { account: { id, name: displayName(name) } };
}

export function verifyLogin(
  name: string,
  password: string,
): { account: ServerAccount } | { lockedForMs: number } | null {
  const key = nameKeyServer(name);
  const lockedForMs = loginLocked(key);
  if (lockedForMs) return { lockedForMs };
  const row = getDb().prepare("SELECT id, name, salt, hash FROM accounts WHERE name_key = ?").get(key) as
    | { id: string; name: string; salt: string; hash: string }
    | undefined;
  const candidate = hashPassword(password, row?.salt ?? newSalt());
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(row?.hash ?? "00".repeat(32), "hex");
  if (!row || !timingSafeEqual(a, b)) {
    recordFail(key);
    return null;
  }
  attempts.delete(key);
  return { account: { id: row.id, name: row.name } };
}

/* ---------- 会话 ---------- */

const SESSION_DAYS = 7;
export const SESSION_COOKIE = "yiban_sid";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export function createSession(accountId: string): { token: string; expires: Date } {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 3600 * 1000);
  getDb()
    .prepare("INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(tokenHash(token), accountId, now.toISOString(), expires.toISOString());
  return { token, expires };
}

export function accountBySession(token: string | undefined): ServerAccount | null {
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT a.id AS id, a.name AS name, s.expires_at AS exp FROM sessions s
       JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?`,
    )
    .get(tokenHash(token)) as { id: string; name: string; exp: string } | undefined;
  if (!row) return null;
  if (new Date(row.exp).getTime() <= Date.now()) {
    getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
    return null;
  }
  return { id: row.id, name: row.name };
}

export function revokeSession(token: string | undefined) {
  if (!token) return;
  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
}

/* ---------- 患者数据（加密落盘） ---------- */

export function readPatientData(accountId: string): { state: unknown; version: number } {
  const row = getDb()
    .prepare("SELECT version, iv, blob FROM patient_data WHERE account_id = ?")
    .get(accountId) as { version: number; iv: string; blob: string } | undefined;
  if (!row) return { state: null, version: 0 };
  try {
    return { state: JSON.parse(decryptText(row.iv, row.blob)), version: row.version };
  } catch (err) {
    console.error("[secure-db] 解密失败（密钥不对或数据损坏）", err);
    return { state: null, version: row.version };
  }
}

/** 乐观并发：只有基于最新版本的写入才生效，避免另一个标签页/设备的内容被旧草稿覆盖。 */
export function writePatientData(
  accountId: string,
  state: unknown,
  baseVersion: number,
): { ok: true; version: number } | { ok: false; version: number } {
  const d = getDb();
  const { iv, blob } = encryptText(JSON.stringify(state ?? null));
  const now = new Date().toISOString();
  let res;
  if (baseVersion === 0) {
    res = d
      .prepare(
        `INSERT INTO patient_data (account_id, version, iv, blob, updated_at)
         VALUES (?, 1, ?, ?, ?)
         ON CONFLICT(account_id) DO NOTHING`,
      )
      .run(accountId, iv, blob, now);
    if (res.changes > 0) return { ok: true, version: 1 };
    // 已有数据：退回普通路径报冲突
    const cur = readPatientData(accountId);
    return { ok: false, version: cur.version };
  }
  res = d
    .prepare(
      `UPDATE patient_data SET version = version + 1, iv = ?, blob = ?, updated_at = ?
       WHERE account_id = ? AND version = ?`,
    )
    .run(iv, blob, now, accountId, baseVersion);
  if (res.changes > 0) return { ok: true, version: baseVersion + 1 };
  const cur = readPatientData(accountId);
  return { ok: false, version: cur.version };
}

/* AI credentials live outside patient state: never included in data responses or backups. */
export interface AiCredentials {
  provider: "glm" | "claude";
  apiKey: string;
}

export function accountByRequest(req: Request): ServerAccount | null {
  const token = req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))?.[1];
  return accountBySession(token);
}

export function readAiCredentials(accountId: string): AiCredentials | null {
  const row = getDb().prepare("SELECT iv, blob FROM ai_credentials WHERE account_id = ?").get(accountId) as
    { iv: string; blob: string } | undefined;
  return row ? JSON.parse(decryptText(row.iv, row.blob)) as AiCredentials : null;
}

export function writeAiCredentials(accountId: string, credentials: AiCredentials): void {
  const { iv, blob } = encryptText(JSON.stringify(credentials));
  getDb().prepare(`INSERT INTO ai_credentials (account_id, iv, blob) VALUES (?, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET iv = excluded.iv, blob = excluded.blob`).run(accountId, iv, blob);
}
