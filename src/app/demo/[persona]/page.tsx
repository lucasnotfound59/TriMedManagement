"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SearchX } from "lucide-react";
import { reloadAccount, useStore, type DemoPersona } from "@/lib/store";
import { enterDemo } from "@/lib/accounts";
import { LogoMark } from "@/components/Logo";
import { Card, IconTile, LinkButton, Skeleton, Spinner } from "@/components/ui";
import { L } from "@/lib/lang";

const PERSONAS: Record<DemoPersona, { name: () => string }> = {
  lin: { name: () => L("林叔", "Uncle Lin") },
};

/**
 * /demo/lin: the demo person (林叔, fictional) has their own account, entered by the link
 * without a password. Opening the link logs out whoever was logged in (their records stay
 * in their account) and loads the demo fresh. Nobody's own records are touched.
 */
export default function DemoLinkPage() {
  const params = useParams<{ persona: string }>();
  const { ready, loadDemo } = useStore();
  const router = useRouter();
  const persona = (params.persona in PERSONAS ? params.persona : null) as DemoPersona | null;
  const decided = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready || decided.current || !persona) return;
    decided.current = true;
    void enterDemo(persona).then(() => {
      reloadAccount();
      loadDemo(persona);
      router.replace("/");
    }).catch(() => setFailed(true));
  }, [ready, persona, loadDemo, router]);

  if (!persona) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 py-10">
        <Card tone="raised" className="w-full animate-pop rounded-[20px] px-5 py-12 text-center">
          <IconTile tone="neutral" size="xl" className="mx-auto mb-5">
            <SearchX />
          </IconTile>
          <h1 className="t-title text-ink">{L("没有这个演示", "No such demo")}</h1>
          <p className="t-body mx-auto mt-2 max-w-sm text-ink-2">{L("可以打开的演示只有林叔的。", "The demo you can open is /demo/lin.")}</p>
          <div className="mt-8 flex justify-center">
            <LinkButton href="/welcome" size="lg">
              {L("回到登录", "Back to sign in")}
            </LinkButton>
          </div>
        </Card>
      </div>
    );
  }

  if (failed) return (
    <Card className="m-4 space-y-4 p-5">
      <p role="alert">{L("未能安全退出当前账号，请返回首页后重试打开演示。", "Could not sign out safely. Return home and try opening the demo again.")}</p>
      <LinkButton href="/">{L("返回首页", "Return home")}</LinkButton>
    </Card>
  );

  /* the demo is being opened: the app icon inside a turning ring, above the shape of the home page */
  return (
    <div className="flex min-h-dvh flex-col justify-center px-4 py-10">
      <div className="w-full animate-fade-up">
        <div className="flex flex-col items-center gap-5 text-center text-ink-2">
          <span className="relative flex h-28 w-28 items-center justify-center">
            <Spinner className="absolute inset-0 h-28 w-28 border-[3px]" />
            <LogoMark className="h-[4.5rem] w-[4.5rem]" />
          </span>
          <span className="text-xl font-semibold tracking-tight text-brand-ink">{L("问诊奶昔", "VisitSmoothie")}</span>
          <span className="t-lead font-medium text-ink">{L(`正在打开${PERSONAS[persona].name()}的演示`, `Opening ${PERSONAS[persona].name()}'s demo`)}</span>
        </div>
        {/* the two halves of the home page, still empty */}
        <div className="mt-10 space-y-3" aria-hidden="true">
          <Card className="space-y-4 rounded-[1.1rem] p-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-9 max-w-9 shrink-0 rounded-[11px]" />
              <Skeleton className="h-5 max-w-[40%]" />
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3 border-t border-line pt-4">
                <Skeleton className="h-7 max-w-7 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 max-w-[55%]" />
                  <Skeleton className="h-5 max-w-[75%]" />
                </div>
              </div>
            ))}
          </Card>
          <Card className="space-y-4 rounded-[1.1rem] p-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-9 max-w-9 shrink-0 rounded-[11px]" />
              <Skeleton className="h-5 max-w-[25%]" />
            </div>
            <Skeleton className="h-14 w-full rounded-2xl" />
          </Card>
        </div>
      </div>
    </div>
  );
}
