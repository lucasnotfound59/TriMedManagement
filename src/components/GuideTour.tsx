"use client";

/*
 * 新手引导：注册后第一次进首页时出现。蒙版压暗全屏，只有当前目标被高亮圈出来，
 * 旁边飘一个气泡写引导语，一步一步走完 pre → post → to do → profile → report → 应急。
 * 走完（或跳过）写入 settings.tourDone，之后不再出现。
 */

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./ui";
import { AiKeyForm } from "./AiKeyForm";
import { L } from "@/lib/lang";

export const TOUR_FLAG = "yiban.tour";

interface GuideStep {
  /** data-guide 的值；没有就是居中的全局卡片 */
  target?: string;
  keySetup?: boolean;
  title: string;
  body: string;
  button: string;
}

/* a function, so the words follow the language the app is in */
const steps = (): GuideStep[] => {
  const next = L("下一步", "Next");
  return [
    { title: L("欢迎使用 问诊奶昔", "Welcome to VisitSmoothie"), body: L("你的私人就诊管家，帮你把看病变简单。", "Your personal visit helper, making doctor's visits simpler."), button: L("开始探索", "Show me around") },
    { keySetup: true, title: L("连接智能助手", "Connect your AI assistant"), body: L("先保存你自己的服务密钥，再继续教程。以后可以在设置中更换。", "Save your own API key to continue. You can change it later in Settings."), button: next },
    { target: "pre", title: L("诊前准备", "Before the visit"), body: L("描述你的不适，一键生成给医生看的「就诊摘要」。", "Describe how you feel, and get a visit summary for the doctor in one tap."), button: next },
    { target: "post", title: L("诊后解析", "After the visit"), body: L("拍处方或传录音，自动翻译成清晰的「医嘱行动」。", "Photograph the prescription or upload a recording, and get clear action items from the doctor's orders."), button: next },
    { target: "todo", title: L("待办与答疑", "To do and questions"), body: L("用药复查自动生成提醒。有疑问随时在底部提问。", "Medicine and check-up reminders are made for you. Ask questions at the bottom any time."), button: next },
    { target: "profile", title: L("个人中心", "Your account"), body: L("管理你的账号信息与个性化就诊偏好。", "Manage your account and your visit preferences."), button: next },
    { target: "report", title: L("健康报告", "Record"), body: L("所有的历史摘要和护理计划都在此安全归档。", "All past summaries and care plans are kept safely here."), button: next },
    { target: "sos", title: L("紧急求助", "Emergency help"), body: L("问诊奶昔不做诊断。突发严重不适，请立刻点击此处寻求人工帮助。", "The AI does not diagnose. If you suddenly feel very unwell, tap here right away to get help from people."), button: L("完成", "Done") },
    { title: L("准备就绪", "All set"), body: L("欢迎使用 问诊奶昔，让每一次就诊都清晰、安心。", "Welcome to VisitSmoothie. Every visit, clear and calm."), button: L("开始使用", "Get started") },
  ];
};

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const MASK = "rgba(18, 59, 49, 0.55)"; // brand-ink 55%，和青瓷主题一致

export function GuideTour({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const STEPS = steps();
  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const total = STEPS.length - 2; // 高亮步骤数（不含首尾两张全局卡片）

  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const measure = useCallback(() => {
    if (!current.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-guide="${current.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [current.target]);

  // 每换一步：把目标滚到屏幕中间再量位置；窗口变化时跟着量
  useLayoutEffect(() => {
    if (!current.target) {
      // a layout effect that measures the DOM sets state on purpose (react.dev: "measuring layout")
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-guide="${current.target}"]`);
    el?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    measure();
    const t = window.setTimeout(measure, 150);
    const again = () => measure();
    window.addEventListener("resize", again);
    window.addEventListener("scroll", again, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", again);
      window.removeEventListener("scroll", again, true);
    };
  }, [step, current.target, measure]);

  // Skipping the tour still requires saving an account key.
  const finishOrSetup = useCallback(() => {
    if (keyConfigured) onFinish();
    else setStep(1);
  }, [keyConfigured, onFinish]);

  // Esc 跳过
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finishOrSetup();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finishOrSetup]);

  const hl = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;

  // 气泡位置：优先放目标下方，放不下就放上方；水平与目标居中并夹进手机那一栏（宽屏上栏居中，不是整个窗口）
  const col = document.querySelector(".phone-col")?.getBoundingClientRect();
  const colLeft = col ? Math.max(0, col.left) : 0;
  const colW = col ? Math.min(col.width, viewport.width) : viewport.width;
  const vh = viewport.height;
  const bw = Math.min(360, colW - 32);
  const EST_H = 280; // a bubble with a two-line body at 17px
  let bubblePos: React.CSSProperties = { width: bw, left: colLeft + colW / 2, top: "50%", transform: "translate(-50%,-50%)" };
  let arrowUp = false; // 气泡在目标下方时，小箭头朝上指
  let arrowX: number | null = null; // 箭头在气泡里的水平位置：始终指着目标正中
  if (hl) {
    const belowY = hl.top + hl.height + 16;
    const room = belowY + EST_H <= vh;
    arrowUp = room;
    const centerX = hl.left + hl.width / 2;
    const left = Math.min(Math.max(colLeft + 16, centerX - bw / 2), colLeft + colW - bw - 16);
    arrowX = Math.min(Math.max(24, centerX - left), bw - 24);
    // above the target: anchored by its bottom edge, so however tall the text makes it, it never covers the target
    bubblePos = room ? { width: bw, top: belowY, left } : { width: bw, bottom: Math.max(16, vh - hl.top + 16), left };
  }

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={L("新手引导", "Getting started")}>
      {/* 透明层吃掉点击；高亮洞由下面那个 div 的巨型 box-shadow 画出来 */}
      <div className="absolute inset-0" />
      {hl ? (
        <div
          className="pointer-events-none absolute rounded-[26px] transition-all duration-300 ease-out"
          style={{ ...hl, boxShadow: `0 0 0 9999px ${MASK}`, outline: "2px solid rgba(255,255,255,0.85)" }}
        />
      ) : (
        <div className="absolute inset-0 transition-all duration-300" style={{ background: MASK }} />
      )}

      <div
        className={`animate-fade-up absolute rounded-3xl border border-line/70 bg-surface p-6 shadow-hero ${current.keySetup ? "max-h-[calc(100dvh-2rem)] overflow-y-auto" : ""}`}
        style={bubblePos}
      >
        {hl && (
          <span
            aria-hidden="true"
            className="absolute h-3.5 w-3.5 rotate-45 border-line/70 bg-surface"
            style={
              arrowUp
                ? { top: -8, left: (arrowX ?? bw / 2) - 7, borderLeftWidth: 1, borderTopWidth: 1 }
                : { bottom: -8, left: (arrowX ?? bw / 2) - 7, borderRightWidth: 1, borderBottomWidth: 1 }
            }
          />
        )}
        {step > 0 && !last && <div className="text-base font-semibold text-brand-700 tabular-nums">{`${step} / ${total}`}</div>}
        <h3 className="t-title mt-1 text-ink">{current.title}</h3>
        <p className="t-body mt-2.5 text-ink-2">{current.body}</p>
        {current.keySetup && <div className="mt-4"><AiKeyForm onConfigured={setKeyConfigured} allowTest /></div>}
        <div className="mt-6 flex items-center gap-4">
          <Button size="lg" className="flex-1" disabled={Boolean(current.keySetup && !keyConfigured)} onClick={() => (last ? finishOrSetup() : setStep(step + 1))}>
            {current.button}
          </Button>
          {!last && !current.keySetup && (
            <button
              type="button"
              onClick={finishOrSetup}
              className="-mr-2 inline-flex min-h-12 shrink-0 items-center rounded-xl px-2 text-base text-ink-2 underline underline-offset-4 transition hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              {L("跳过", "Skip")}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
