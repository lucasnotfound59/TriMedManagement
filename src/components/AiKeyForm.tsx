"use client";

import { useEffect, useId, useState } from "react";
import { Button, Field, Input, Select, Spinner } from "./ui";
import { L } from "@/lib/lang";
import { aiHealth } from "@/lib/ai/client";

type Provider = "glm" | "claude";
interface KeyStatus { configured: boolean; provider: Provider | null }

/** Shared by the first-use guide and settings. A secret exists only in this input until saved. */
export function AiKeyForm({ onConfigured, onSaved, allowTest = false }: {
  onConfigured?: (configured: boolean) => void;
  onSaved?: () => void;
  allowTest?: boolean;
}) {
  const id = useId();
  const [provider, setProvider] = useState<Provider>("glm");
  const [saved, setSaved] = useState<KeyStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/ai-key", { cache: "no-store" }).then(async (res) => {
      if (!res.ok) throw new Error(res.status === 401 ? "unauthorized" : "load");
      const status = await res.json() as KeyStatus;
      if (!alive) return;
      setSaved(status);
      setProvider(status.provider ?? "glm");
      onConfigured?.(status.configured);
    }).catch((err: unknown) => {
      if (alive) setError(err instanceof Error && err.message === "unauthorized"
        ? L("请先登录自己的账号再保存密钥。演示账号不能保存密钥。", "Sign in to your own account to save a key. Demo accounts cannot save keys.")
        : L("未能读取密钥状态，请重新打开此页面。", "Could not load key status. Please reopen this page."));
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [onConfigured]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/ai-key", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey.trim() }),
      });
      if (!res.ok) throw new Error(res.status === 401 ? "unauthorized" : "save");
      const status = await res.json() as KeyStatus;
      setSaved(status);
      setApiKey("");
      setMessage(L("密钥已保存。可测试连接，确认能否使用。", "Key saved. Test the connection to check whether it works."));
      onConfigured?.(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error && err.message === "unauthorized"
        ? L("登录已过期，请重新登录后保存。", "Your session expired. Sign in again to save.")
        : L("未能保存，请检查密钥中是否有空格，并重试。", "Could not save. Check for spaces in the key and try again."));
    } finally { setSaving(false); }
  };

  if (loading) return <p className="flex items-center gap-2 text-ink-2"><Spinner />{L("正在读取密钥状态…", "Loading key status…")}</p>;

  return (
    <form onSubmit={save} className="space-y-4">
      <p className="t-body text-ink-2">{saved?.configured
        ? L("已保存密钥。填写新密钥并保存即可更换，原密钥不会显示。", "A key is saved. Enter and save a new key to replace it. The existing key is never displayed.")
        : L("请填写你自己的智能助手服务密钥。密钥由服务商提供，用于连接智能助手。", "Enter your own AI service API key, supplied by your AI provider.")}</p>
      <Field label={L("服务商", "Provider")}>
        <Select aria-label={L("服务商", "Provider")} id={`${id}-provider`} value={provider} onChange={(e) => { setProvider(e.target.value as Provider); setMessage(""); }} disabled={saving || testing || !saved}>
          <option value="glm">{L("智谱", "Zhipu GLM")}</option>
          <option value="claude">{L("克劳德", "Anthropic Claude")}</option>
        </Select>
      </Field>
      <Field label={L("服务密钥", "API key")}>
        <Input aria-label={L("服务密钥", "API key")} id={`${id}-key`} type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={4096}
          value={apiKey} onChange={(e) => { setApiKey(e.target.value); setMessage(""); }}
          disabled={saving || testing || !saved} placeholder={L("粘贴服务商提供的密钥", "Paste your provider's API key")} />
      </Field>
      <p className="text-base text-ink-2">{L("密钥按账号加密保存，不会放进资料备份。服务商可能按使用量收费。", "Keys are encrypted per account and excluded from profile backups. Your provider may charge for usage.")}</p>
      {provider === "claude" && <p className="text-base text-ink-2">{L("此服务用于对话和照片；语音转写暂不支持此服务，会尝试浏览器听写。", "This provider supports chat and photos. Voice transcription uses browser dictation when available.")}</p>}
      {error && <p role="alert" className="text-danger">{error}</p>}
      {message && <p role="status" className="text-brand-700">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={saving} disabled={!saved || !apiKey.trim() || testing}>{L("保存密钥", "Save key")}</Button>
        {allowTest && <Button type="button" variant="secondary" disabled={!saved?.configured || saving || Boolean(apiKey) || provider !== saved.provider} loading={testing} onClick={async () => {
          setTesting(true); setError(""); setMessage("");
          const health = await aiHealth(true);
          if (health.ok) setMessage(L("连接成功。", "Connected successfully."));
          else setError(L("连接失败，请检查密钥、服务商余额及网络后重试。", "Connection failed. Check your key, provider credits and network, then try again."));
          setTesting(false);
        }}>{L("测试已保存的密钥", "Test saved key")}</Button>}
      </div>
    </form>
  );
}
