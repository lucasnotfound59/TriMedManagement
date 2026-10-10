"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Download, Droplets, HardDrive, Info, Play, Sparkles, Timer, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { aiHealth, type AiHealth } from "@/lib/ai/client";
import { cn, fmtISODate } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { Button, Card, IconTile, LinkButton, Modal, PageHeader, SectionTitle, Select, Toggle, type IconTone } from "@/components/ui";
import { AiKeyForm } from "@/components/AiKeyForm";
import { L } from "@/lib/lang";

type Perm = NotificationPermission | "unsupported";
const intervals = () => [
  { hours: 12, get label() { return L("一天两次", "Twice a day"); } },
  { hours: 24, get label() { return L("每天一次", "Once a day"); } },
  { hours: 48, get label() { return L("两天一次", "Every two days"); } },
];
const metricCadence = () => [
  { hours: 24, get label() { return L("每天", "Every day"); } },
  { hours: 48, get label() { return L("两天一次", "Every two days"); } },
  { hours: 72, get label() { return L("三天一次", "Every three days"); } },
  { hours: 168, get label() { return L("每周", "Every week"); } },
  { hours: 0, get label() { return L("不提醒", "Never"); } },
];

/** One row of a settings group, the way iOS Settings lays one out: tile, title, detail, then the control under it. */
function Block({
  title,
  detail,
  icon,
  iconTone = "brand",
  mark,
  children,
}: {
  title: string;
  detail?: React.ReactNode;
  icon: React.ReactNode;
  iconTone?: IconTone;
  /** a small mark beside the title, like a status light */
  mark?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-4">
      <IconTile tone={iconTone} className="mt-0.5">
        {icon}
      </IconTile>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2.5 text-lg font-medium text-ink">
          {title}
          {mark}
        </p>
        {detail && <p className="t-body mt-1 text-ink-2">{detail}</p>}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { state, updateSettings, resetAll, exportJSON } = useStore();
  const router = useRouter();
  const toast = useToast();
  const [perm, setPerm] = useState<Perm>(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission));
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [confirm, setConfirm] = useState<null | "reset">(null);

  useEffect(() => {
    let alive = true;
    aiHealth().then((h) => alive && setHealth(h));
    return () => {
      alive = false;
    };
  }, []);

  const notifyOn = state.settings.notificationsEnabled && perm === "granted";
  const interval = state.settings.checkInIntervalHours;

  const toggleNotify = async (on: boolean) => {
    if (perm === "unsupported") return;
    if (!on) {
      updateSettings({ notificationsEnabled: false });
      toast.show(L("已关掉提醒", "Reminders turned off"));
      return;
    }
    const p = perm === "granted" ? "granted" : await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") {
      updateSettings({ notificationsEnabled: true });
      try {
        new Notification(L("问诊奶昔", "VisitSmoothie"), { body: L("提醒已经打开。到了该问你的时候，我会来提醒。", "Reminders are on. I'll remind you when it's time to check in.") });
      } catch {
        /* ignore */
      }
      toast.show(L("已打开提醒", "Reminders turned on"), "good");
    } else {
      toast.show(L("浏览器没有允许通知。请在地址栏左边的网站设置里允许", "The browser blocked notifications. Allow them in the site settings left of the address bar"), "danger");
    }
  };


  const download = () => {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yiban-backup-${fmtISODate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show(L("备份文件已经下载", "Backup file downloaded"), "good");
  };

  // the AI row glows by its state: checking, connected, not reachable, not set up
  const aiTone: IconTone = !health ? "neutral" : health.configured && health.ok !== false ? "solid" : health.configured ? "warn" : "neutral";
  const aiLight = !health
    ? "bg-line-strong"
    : health.configured && health.ok !== false
      ? "bg-good shadow-[0_0_0_3px_var(--color-good-bg)]"
      : health.configured
        ? "bg-warn shadow-[0_0_0_3px_var(--color-warn-bg)]"
        : "bg-line-strong";

  return (
    <div className="space-y-6 pb-2">
      <PageHeader back={{ href: "/me", label: L("我的档案", "My profile") }} title={L("设置", "Settings")} />

      <section id="ai-key" className="scroll-mt-6">
        <SectionTitle>{L("智能助手", "AI assistant")}</SectionTitle>
        <Card className="overflow-hidden">
          <Block
            icon={<Sparkles />}
            iconTone={aiTone}
            title={L("智能助手密钥", "AI API key")}
            mark={<span aria-hidden="true" className={cn("inline-block h-2.5 w-2.5 rounded-full", aiLight)} />}
          >
            <AiKeyForm allowTest onSaved={() => { void aiHealth().then(setHealth); }} />
          </Block>
        </Card>
      </section>

      <section className="rise-1">
        <SectionTitle>{L("提醒", "Reminders")}</SectionTitle>
        <Card className="divide-y divide-line overflow-hidden">
          <Block
            icon={<Timer />}
            title={L("多久问我一次", "How often to ask me")}
            detail={L(
              "有不舒服在跟踪时，我按这个节奏在首页问你怎么样了。拖了两周以上的，改成每周问一次。",
              "While I'm following something that bothers you, I ask how you are on the home page this often. After two weeks, I ask once a week.",
            )}
          >
            <Select
              value={String(interval)}
              aria-label={L("多久问我一次", "How often to ask me")}
              onChange={(e) => {
                updateSettings({ checkInIntervalHours: Number(e.target.value) });
                toast.show(L("已改好", "Changed"), "good");
              }}
            >
              {intervals().map((i) => (
                <option key={i.hours} value={i.hours}>
                  {i.label}
                </option>
              ))}
            </Select>
          </Block>
          {state.settings.longTerm && (
            <Block
              icon={<Droplets />}
              iconTone="info"
              title={L("多久提醒我记血糖", "How often to remind me about blood sugar")}
              detail={L("血压和体重最多每周提醒一次。", "Blood pressure and weight: at most once a week.")}
            >
              <Select
                value={String(state.settings.metricReminderHours)}
                aria-label={L("多久提醒我记血糖", "How often to remind me about blood sugar")}
                onChange={(e) => {
                  updateSettings({ metricReminderHours: Number(e.target.value) });
                  toast.show(L("已改好", "Changed"), "good");
                }}
              >
                {metricCadence().map((c) => (
                  <option key={c.hours} value={c.hours}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Block>
          )}
          {perm === "unsupported" || perm === "denied" ? (
            <Block
              icon={<BellOff />}
              iconTone="neutral"
              title={L("弹出提醒", "Pop-up reminders")}
              detail={
                perm === "unsupported"
                  ? L("这个浏览器不能弹出提醒。打开问诊奶昔时，首页照样会问你。", "This browser can't show pop-up reminders. The home page still asks you when you open VisitSmoothie.")
                  : L(
                      "浏览器不允许这个网站发通知。请在地址栏左边的网站设置里允许，再回来打开。",
                      "The browser doesn't allow this site to send notifications. Allow them in the site settings left of the address bar, then come back and turn this on.",
                    )
              }
            />
          ) : (
            <Toggle
              checked={notifyOn}
              onChange={(v) => void toggleNotify(v)}
              icon={<Bell />}
              iconTone={notifyOn ? "solid" : "brand"}
              label={L("弹出提醒", "Pop-up reminders")}
              detail={L("网页开着的时候，到时间会弹出一条通知。关掉网页就不会提醒了。", "While this page is open, a notification pops up when it's time. Close the page and the reminders stop.")}
            />
          )}
        </Card>
      </section>

      <section className="rise-2">
        <SectionTitle>{L("我的数据", "My data")}</SectionTitle>
        <Card className="divide-y divide-line overflow-hidden">
          <Block
            icon={<HardDrive />}
            iconTone="neutral"
            title={L("数据存在哪里", "Where your data is kept")}
            detail={L(
              "档案和记录只存在这台设备的浏览器里，每个账号分开存。只有在你和问诊奶昔说话、整理给医生看的内容、认照片和语音的时候，相关内容才会发给人工智能模型。",
              "Your profile and records are kept only in this device's browser, separately for each account. Only when you talk with VisitSmoothie, prepare a page for the doctor, or read a photo or voice note is the related content sent to the AI model.",
            )}
          />
          <Block icon={<Download />} title={L("备份", "Backup")} detail={L("把档案和全部记录存成一个文件。", "Save your profile and all records as one file.")}>
            <Button variant="secondary" className="press" onClick={download}>
              <Download className="h-5 w-5" />
              {L("下载备份", "Download backup")}
            </Button>
          </Block>
          <Block
            icon={<Play />}
            iconTone="info"
            title={L("看看演示", "See a demo")}
            detail={L(
              "林叔是虚构的病人，有一次左膝痛的记录。打开演示会先退出你的账号，你的档案和记录不受影响。",
              "Uncle Lin is a made-up patient with a record of left knee pain. Opening the demo signs you out first; your profile and records are not changed.",
            )}
          >
            <LinkButton href="/demo/lin" variant="secondary" className="press">
              {L("林叔的演示", "Uncle Lin's demo")}
            </LinkButton>
          </Block>
          <Block
            icon={<Trash2 />}
            iconTone="danger"
            title={L("全部清空", "Erase everything")}
            detail={L("删掉这个账号的档案和所有记录，从头开始。账号本身还在。", "Delete this account's profile and all records and start over. The account itself stays.")}
          >
            <Button variant="dangerSoft" className="press" onClick={() => setConfirm("reset")}>
              {L("全部清空", "Erase everything")}
            </Button>
          </Block>
        </Card>
      </section>

      <section className="rise-3">
        <SectionTitle>{L("关于", "About")}</SectionTitle>
        <Card className="divide-y divide-line overflow-hidden">
          <Block
            icon={<Info />}
            iconTone="neutral"
            title={L("使用须知", "Please note")}
            detail={L(
              "问诊奶昔只帮你记录、整理和提醒，不做诊断，不建议用药。指标的范围是一般的标准，你自己的目标听医生的。胸痛、喘不上气、神志不清、大出血这类急事，请立即拨打 120。",
              "VisitSmoothie only helps you record, organize and remember. It does not diagnose or suggest medicines. Ranges for health numbers are general; your own targets come from your doctor. For emergencies like chest pain, trouble breathing, confusion or heavy bleeding, call 120 right away.",
            )}
          />

        </Card>
      </section>

      <Modal
        open={confirm === "reset"}
        title={L("全部清空？", "Erase everything?")}
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              {L("不清了", "Keep it")}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetAll();
                setConfirm(null);
                router.replace("/onboarding");
              }}
            >
              {L("全部清空", "Erase everything")}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3.5">
          <IconTile tone="solidDanger" size="lg">
            <Trash2 />
          </IconTile>
          <p className="t-lead pt-1.5 text-ink">{L("档案、全部记录和对话都会删掉，找不回来。", "Your profile, all records and conversations will be deleted for good.")}</p>
        </div>
      </Modal>
    </div>
  );
}
