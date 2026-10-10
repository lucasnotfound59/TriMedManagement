"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, KeyRound, Languages, Settings } from "lucide-react";
import { reloadAccount, useStore } from "@/lib/store";
import { logoutHere } from "@/lib/accounts";
import { ageOf, cn } from "@/lib/utils";
import { ageFromBirthDate, ageLabel, genderLabel } from "@/app/me/profile-data";
import { DevSwitch } from "@/components/DevSwitch";
import { LangToggle } from "@/components/LangToggle";
import { Card, IconTile, PageHeader, RowLink, focusRing } from "@/components/ui";
import { L } from "@/lib/lang";

/**
 * set, laid out like iOS Settings: who I am (the way into 我的档案) on top, then the settings,
 * the developer switch, and the way out in red at the foot.
 */
export default function SetPage() {
  const { state } = useStore();
  const router = useRouter();
  const profile = state.profile;
  if (!profile) return null;
  const age = (profile.birthDate ? ageFromBirthDate(profile.birthDate) : null) ?? ageOf(profile.birthYear);

  return (
    <div className="space-y-6 pb-2">
      <PageHeader title={L("设置", "set")} />

      {/* the person: one tap opens the whole 我的档案 */}
      <Card tone="raised" className="animate-pop overflow-hidden">
        <Link href="/me" className={cn("lift flex min-h-22 items-center gap-4 px-4 py-3.5", focusRing)}>
          <span
            aria-hidden="true"
            className="flex h-15 w-15 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[1.6rem] leading-none font-semibold text-white"
          >
            {Array.from(profile.name.trim())[0] ?? ""}
          </span>
          <span className="min-w-0 flex-1">
            <span className="name-title block text-ink">{profile.name}</span>
            <span className="t-body mt-0.5 block text-ink-2">
              {/* each part stays whole; a zero-width space before each lets the line break between them */}
              {[genderLabel(profile.gender), ageLabel(age)].filter(Boolean).map((part, i) => (
                <span key={i}>
                  {i > 0 && "\u200b"}
                  <span className="whitespace-nowrap">{i > 0 ? ` · ${part}` : part}</span>
                </span>
              ))}
              {"\u200b"}
              <span className="whitespace-nowrap">
                <span className="mx-1.5 text-ink-3">·</span>
                {L("我的档案", "My profile")}
              </span>
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink-3" aria-hidden="true" />
        </Link>
      </Card>

      <Card tone="raised" className="rise-1 overflow-hidden">
        <RowLink href="/me/settings" title={L("设置", "Settings")} icon={<Settings />} iconTone="neutral" className="press" />
        <RowLink href="/me/settings#ai-key" title={L("智能助手密钥", "AI API key")} icon={<KeyRound />} className="border-t border-line" />
        {/* the language: a settings row of its own, the two choices side by side at the end of it */}
        <div className="flex min-h-14 items-center gap-3 border-t border-line px-4 py-2">
          <IconTile tone="neutral">
            <Languages />
          </IconTile>
          <span className="min-w-0 flex-1 text-lg font-medium text-ink">{L("语言", "Language")}</span>
          <LangToggle segmented />
        </div>
      </Card>

      {/* 开发者开关: the same switch as before, now a settings row of its own */}
      <Card tone="raised" className="rise-2 overflow-hidden">
        <DevSwitch />
      </Card>

      <Card tone="raised" className="rise-3 overflow-hidden">
        <button
          type="button"
          onClick={() => {
            logoutHere();
            reloadAccount();
            router.replace("/welcome");
          }}
          className={cn(
            "press flex min-h-14 w-full items-center justify-center px-4 py-3 text-center text-lg font-semibold text-danger transition hover:bg-danger-bg/60",
            focusRing,
          )}
        >
          {L("退出登录", "Sign out")}
        </button>
      </Card>
    </div>
  );
}
