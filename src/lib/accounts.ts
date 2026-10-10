/*
 * 注册和登录：账号与患者数据都保存在服务端的加密存储里（见 src/lib/server/secure-db.ts）。
 * 浏览器只保留一个"当前登录的是谁"的标记（账号 id），用来决定界面展示；
 * 真正的凭据是 httpOnly 会话 Cookie，JS 读不到，也不会出现在导出内容里。
 * 演示账号（林叔）是虚构数据，仍只存在这台浏览器里，不写入服务器。
 */

import type { Profile } from "./types";
import { isDev } from "./dev";
import { L } from "./lang";

export interface Account {
  id: string;
  /** the name as typed at registration; also the profile's name */
  name: string;
  /** the name normalised for comparing (case, full-width characters, spaces) */
  key: string;
  /** empty for the demo people, who are entered through their links and have no password */
  salt: string;
  hash: string;
  demo?: boolean;
  createdAt: string;
}

export const ACCOUNTS_KEY = "yiban.accounts";
export const SESSION_KEY = "yiban.session";
/** where the single profile lived before there were accounts */
export const LEGACY_KEY = "yiban.v1";
export const dataKey = (id: string) => `yiban.v1.${id}`;

export const PASSWORD_MIN = 15;
export const PASSWORD_MAX = 128;
const ITERATIONS = 120_000;

export const DEMO_ACCOUNTS: Record<"lin", { id: string; name: string }> = {
  lin: { id: "demo-lin", name: "林叔" },
};

/** 演示账号只存在浏览器里（虚构数据），真实账号走服务端加密存储。 */
export const isDemoAccountId = (id: string | null | undefined): boolean => !!id && id.startsWith("demo-");

/** Two names that differ only in case, full-width characters or spaces are the same name. */
export function nameKey(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** The sentence shown when the password cannot be used, or null when it can. */
export function passwordProblem(password: string, confirm: string): string | null {
  const n = [...password].length;
  // Empty password with empty confirm is fine (will use devPassword approach)
  if (!n && !confirm.length) return null;
  if (!n) return L("还差：密码。", "Still missing: password.");
  if (n < PASSWORD_MIN) return L(`密码至少 ${PASSWORD_MIN} 个字，可以用一句好记的话。`, `The password needs at least ${PASSWORD_MIN} characters. A sentence you can remember works well.`);
  if (n > PASSWORD_MAX) return L(`密码最多 ${PASSWORD_MAX} 个字。`, `The password can have at most ${PASSWORD_MAX} characters.`);
  if (password !== confirm) return L("两次输入的密码不一样，请再输一次。", "The two passwords don't match. Please type them again.");
  return null;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: ITERATIONS },
    base,
    256,
  );
  return hex(bits);
}

const newId = () => crypto.randomUUID();
const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)).buffer);

/** Registration on a list of accounts. Pure apart from the hashing, so it can be tested. */
export async function createAccount(
  list: Account[],
  name: string,
  password: string,
  confirm: string,
): Promise<{ account: Account } | { error: string }> {
  const key = nameKey(name);
  if (!key) return { error: L("还差：姓名。", "Still missing: name.") };
  if (list.some((a) => a.key === key)) return {
      error: L(
        "这个姓名已经注册过了。是你的话请直接登录；不是的话，换一个能区分的姓名。",
        "This name is already signed up. If it's you, please sign in; if not, use a name that tells you apart.",
      ),
    };
  const bad = passwordProblem(password, confirm);
  if (bad) return { error: bad };
  const salt = newSalt();
  return {
    account: { id: newId(), name: name.normalize("NFKC").trim().replace(/\s+/g, " "), key, salt, hash: await hashPassword(password, salt), createdAt: new Date().toISOString() },
  };
}

/** The account this name and password open, or null. One message for both mistakes. */
export async function checkLogin(list: Account[], name: string, password: string): Promise<Account | null> {
  const a = list.find((x) => x.key === nameKey(name));
  if (!a || a.demo || !a.hash) return null;
  return (await hashPassword(password, a.salt)) === a.hash ? a : null;
}

/* ---------- this browser: 只放"登录的是谁"的标记和演示账号 ---------- */

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function listAccounts(): Account[] {
  try {
    const raw = storage()?.getItem(ACCOUNTS_KEY);
    const list = raw ? (JSON.parse(raw) as Account[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveAccounts(list: Account[]) {
  storage()?.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

export function currentAccountId(): string | null {
  try {
    return storage()?.getItem(SESSION_KEY) || null;
  } catch {
    return null;
  }
}

export function currentAccount(): Account | null {
  const id = currentAccountId();
  return id ? (listAccounts().find((a) => a.id === id) ?? null) : null;
}

function setSession(id: string | null) {
  const s = storage();
  if (!s) return;
  if (id) s.setItem(SESSION_KEY, id);
  else s.removeItem(SESSION_KEY);
}

/** The profile kept here from before accounts existed, if any. */
export function legacyProfile(): Profile | null {
  try {
    const raw = storage()?.getItem(LEGACY_KEY);
    if (!raw) return null;
    const p = (JSON.parse(raw) as { profile?: Profile | null }).profile;
    return p && p.name ? p : null;
  } catch {
    return null;
  }
}

/* ---------- 开发者开关：空密码 -> 随机丢弃密码（只存在这台浏览器，仅演示用） ---------- */

const DEV_PW_KEY = "yiban.devpw";

function devPwMap(): Record<string, string> {
  try {
    return JSON.parse(storage()?.getItem(DEV_PW_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/** 开发者模式下的实际密码：注册时生成并记住；登录时取出。真实流程永远不会走到这里。 */
function devPassword(name: string, create: boolean): string | null {
  const key = nameKey(name);
  const map = devPwMap();
  if (map[key]) return map[key];
  if (!create) return null;
  map[key] = crypto.randomUUID() + crypto.randomUUID();
  try {
    storage()?.setItem(DEV_PW_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
  return map[key];
}

/* ---------- 服务端认证 ---------- */

let authError: string | null = null;
/** 最近一次登录/注册失败时服务端给的原因（限流提示等）。 */
export const lastAuthError = () => authError;

async function authFetch(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: { account?: { id: string; name: string }; error?: string } }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { account?: { id: string; name: string }; error?: string };
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: L("连不上本机服务，请确认服务在运行。", "Can't reach the local service. Please make sure it is running.") } };
  }
}

/**
 * 在服务端注册并登录。With `takeLegacy`, the profile and records kept here from before
 * accounts existed move into the new account（上传到服务端加密存储）instead of being left behind.
 */
export async function registerHere(name: string, password: string, confirm: string, takeLegacy: boolean): Promise<string | null> {
  const bad = passwordProblem(password, confirm);
  if (bad) return bad;

  // Use placeholder name if empty
  const actualName = name.trim() ? name : L(`体验用户${(() => {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  })()}`, `Guest ${(() => {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  })()}`);

  // Use devPassword for empty password
  const actual = !password ? devPassword(actualName, true)! : password;
  const res = await authFetch("/api/auth/register", { name: actualName, password: actual });
  if (!res.ok || !res.data.account) {
    authError = res.data.error ?? L("注册失败，请再试一次。", "Sign-up failed. Please try again.");
    return authError;
  }
  authError = null;
  setSession(res.data.account.id);

  const s = storage();
  if (takeLegacy && s) {
    const raw = s.getItem(LEGACY_KEY);
    if (raw) {
      // 旧数据搬进新账号的服务端加密存储，本地明文随即删除
      try {
        await fetch("/api/data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: JSON.parse(raw), baseVersion: 0 }),
        });
      } catch {
        /* 网络失败时旧数据还在本地，下次注册/登录仍可接管 */
        return null;
      }
      s.removeItem(LEGACY_KEY);
    }
  }
  return null;
}

export async function loginHere(name: string, password: string): Promise<boolean> {
  let actual = password;
  if (isDev() && !password) {
    const found = devPassword(name, false);
    if (!found) {
      authError = L("开发者模式：这台浏览器没存这个账号的钥匙，请用密码登录，或重新注册。", "Developer mode: this browser has no key for this account. Sign in with the password, or sign up again.");
      return false;
    }
    actual = found;
  }
  const res = await authFetch("/api/auth/login", { name, password: actual });
  if (!res.ok || !res.data.account) {
    authError = res.data.error ?? L("姓名或密码不对，请再试一次。", "Name or password is wrong. Please try again.");
    return false;
  }
  authError = null;
  setSession(res.data.account.id);
  return true;
}

export function logoutHere() {
  setSession(null);
  authError = null;
  // 撤销服务端会话并清掉 httpOnly Cookie；不等结果，界面先退出
  void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}

/** Opens a demo person's account, creating it the first time. 演示数据不进服务器。 */
export async function enterDemo(persona: "lin") {
  // Finish server sign-out first: a demo must never use or replace a real account's AI key.
  const res = await fetch("/api/auth/logout", { method: "POST" });
  if (!res.ok) throw new Error("demo_logout_failed");
  const d = DEMO_ACCOUNTS[persona];
  const list = listAccounts();
  if (!list.some((a) => a.id === d.id)) {
    saveAccounts([...list, { id: d.id, name: d.name, key: `demo:${persona}`, salt: "", hash: "", demo: true, createdAt: new Date().toISOString() }]);
  }
  setSession(d.id);
}
