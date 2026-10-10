# main 整合说明

本次将所有本地功能分支及已拉取的远端最新功能分支合入 `main`，保留各分支历史。项目根目录运行最新版 Next.js 患者应用。

## 来源

| 来源分支 | 合入的提交 | 内容 |
| --- | --- | --- |
| `codex/yiban-integrated` | `15dd497` | 既有集成结果、主应用、账号和语音模块 |
| `origin/yiban-patient` | `686fdf0` | 患者流程、加密存储、Claude 客户端 |
| `origin/codex/yiban-celadon-ui` | `c194b3c` | 最新手机 UI、身体图、描述修订、Clinical Plan、逐条追问、GLM/Claude 切换 |
| `origin/yiban-mobile` | `ad717c2` | 最新 pre → post 入口、引导箭头定位 |
| `origin/codex/visit-smoothie-onboarding` | `2c1423b` | 独立账号模块、可编辑昵称、资料和会话 |
| `origin/codex/patient-audio-transcription` | `9d8507a` | 独立语音转写模块、CLI、输入及配置校验 |
| `origin/codex/afterdoc-prototype` | `55a95c1` | 项目历史、文档与虚构病人材料 |

已使用 `git merge-base --is-ancestor <分支> main` 核对全部本地及远端分支，均已包含。来源工作树中的未提交草稿继续保留在原处；本次以已提交的最新版本为依据。

## 冲突处理

- `.env.example`、`README.md`、`src/lib/ai/glm.ts` 使用最新 UI 分支的提供商切换版本，保留 `AI_PROVIDER`、GLM 和 Claude 配置以及空的加密密钥配置项。
- `src/components/GuideTour.tsx` 使用最新手机布局版本，再合入 `ad717c2` 的箭头定位修正。首次使用完成状态继续保存在账号设置中。
- 已在较新历史中删除的旧原型沿用删除决定。
- HTTP 规则测试的三个旧预期与最新版问诊规则冲突，已更新为：保留患者明确否认的回答、补足所需信息后结束、超过四问仍继续逐项询问。增加了不确定回答能结束且没有重复追问的接口验收。

## 运行与模块边界

| 入口 | 用法 | 数据与接口 |
| --- | --- | --- |
| 根目录患者主应用 | `npm run dev`；默认 3000 | 最新患者 UI、诊前/诊后、待办、历史、资料；服务端加密账号存储 |
| `visit-smoothie/` | `./visit-smoothie/start.sh`；默认 4190 | 独立昵称/资料账号原型，保留自己的数据库和会话 |
| `patient-dictation/` | 按模块 README 调用函数或 CLI | 可复用音频转文字模块，凭证由调用方配置 |

`npm test` 在根目录统一运行三个组件的既有检查。主应用的语音 HTTP 接口继续采用最新版的 GLM ASR 配置。

## 验证

运行环境：Node.js 24.14.0，npm 11.9.0。

| 检查 | 本次结果 |
| --- | --- |
| `npm test` | 患者应用 1500 项断言、账号模块 25 个测试、语音模块 19 个测试通过 |
| `npm run lint` | 通过，无错误或警告 |
| `npm run typecheck` | 通过 |
| `npm run build` | 生产构建通过 |
| `BASE=http://127.0.0.1:4307 npm run test:rules` | 本地无 Key 生产服务，63 项接口断言通过 |
| Playwright 手机与桌面检查 | 新手引导完成/刷新、pre → post、Clinical Plan 勾选/解释/追问/保存/刷新、report/set 导航通过；没有浏览器运行时异常，桌面没有横向溢出 |
| `git diff --check` | 通过 |

TypeScript 的输入范围收紧至主应用、脚本、Next.js 配置和语音类型声明；ESLint 排除独立 PhysicianBench 检出目录与旧实现快照。原先全目录扫描会将独立研究网站的别名按主应用解释，导致错误。

浏览器 Clinical Plan 检查将照片整理接口替换为虚构响应，解释接口则实际调用本地无 Key 规则；验证的是页面与待办持久化流程。接口测试和模块测试也使用虚构数据。真实供应商账号、实际语音准确率、照片识别质量及公网部署不属于本次验证。

## 2026-10-04 整合：手机版美化、绿色、logo 名、中英双语、登录页（integrate-into-main）

从当时的 `origin/main`（394a16f）开分支 `integrate-into-main`，合入主管会话在 `yiban-mobile` 上的本地提交：蓝改青瓷绿和 logo 配名字（65b870e）、界面中英双语和林叔英文版、欢迎登录页换回网页版的样子（f689927）、合入 Nancy 的 ad717c2（b078f94）。

冲突只有两个文件，一律以 main 的功能为准，只带过去样子和英文：

- `src/app/post/page.tsx`：保留 main 的 Clinical Plan 结果页，标题和说明加英文。
- `src/components/chat/BodyMap.tsx`：保留 main 的多选身体图（aria-pressed、可选几块、`prompt` 参数），提示、选中条和按钮加英文；存下和发出去的仍是中文部位名。

合并后补的英文：Clinical Plan 页（`src/components/post/ClinicalPlan.tsx`）的固定文字、对话里「描述改过了」卡片和身体图提示。发给 AI 的问题、存进待办的「问/答」仍是中文。AI 一侧（回答、追问、规则生成的文字）按 CLAUDE.md 仍是中文，英文界面注明「AI replies are in Chinese for now.」。

| 检查 | 本次结果 |
| --- | --- |
| `npm test` | 患者应用 1530 项断言、账号模块、语音模块 19 个测试全部通过 |
| `npm run lint`、`npx tsc --noEmit` | 通过 |
| 生产构建 | 通过（在临时副本里构建） |
| `BASE=http://127.0.0.1:4310 npm run test:rules` | 本地无 Key 生产服务，63 项通过 |
| 浏览器（390 像素手机宽度，中英文各一遍） | 欢迎、登录、注册（服务端账号、错密码、开发者开关下空表单）、林叔中英文、首页 to do、问 AI 展开收起、pre（身体图多选、next·post）、post、report、给医生看、set、我的资料、设置、应急；截图在 `docs/手机版截图/` 和 `docs/手机版截图-英文/` |

没验证到的：真实的照片整理和 Clinical Plan 实际结果（AI Key 现在被拒，照片整理走不通）；真实麦克风。

## 2026-10-04 改动：pre 的 next·post 挪到页面底部、引导文案「就诊计划」改「医嘱行动」（Nancy，直接推 main）

- `src/components/chat/ChatScreen.tsx`：删掉标题行右侧的 next·post 按钮；改为只在「给医生看的话」生成之后（对话里出现描述卡，或就诊事项已完成/已有摘要）在页面最底部（输入栏下方、底栏上方）出现的主色大按钮，文案沿用中英双语 `下一步：看病后 / next · post`。回主页入口不变（底栏中间 logo、左上角品牌标）。
- `src/components/GuideTour.tsx`：新手引导 post 一步的正文「就诊计划」改为「医嘱行动」（英文同步改为 action items）。

验证：`npm test`（三个组件全部通过）、`npm run lint`、`npx tsc --noEmit` 通过；生产构建用 `npx next build --webpack` 通过（本机沙箱拦住 Turbopack 构建时 PostCSS 子进程绑端口，与代码无关）。浏览器验证：新账号空对话时按钮不出现；林叔（问诊已完成）pre 页底部出现按钮并跳转 /post。


## 2026-10-04 改动：健康记录改名、post 关联 pre、保留未完成的页面、英文模式全英文、按学历讲解（Yueran，合进最新 main 后推 main）

- **名字**：底栏「记录 / report」改为「健康记录 / Health Record」，页面标题同步。中文界面里 App 名字叫「问诊奶昔」（logo、欢迎页标题、浏览器标签、提示），英文界面仍是 VisitSmoothie；原来中文里的「医伴」也统一成「问诊奶昔」。AGENTS.md 第 3 条按此修改。
- **中文界面不出现英文**：AI、post、PDF、cm、kg、mmol/L、AED、GLM、.env.local 等都换成中文（智能助手、看病后、厘米、公斤、毫摩尔/升、自动体外除颤器等）；单位按语言显示（`unitWord`，`MetricDef.symbol` 是交给模型的固定符号）。
- **pre**：去掉 next·post 按钮（包括 Nancy 刚挪到页面底部的那一版，按产品要求去掉）；标题旁加「开新的」，确认后放弃这一轮未完成的问诊（未保存的记录一起去掉，已保存的不动）。问诊进行到一半（还在问、选了部位还没说怎么不舒服、描述没保存、正在「改一下」）时离开再回来，页面原样保留，不再追加开场问题或每日追问。
- **post**：Clinical Plan 存进 store（`postDraft`），整理中、解释中离开再回来都还在，直到保存或点「放弃这次，开新的」。保存处新增「关联看病前的记录」下拉框，可选关联哪一次 pre 记录或不关联。
- **英文模式全英文**：请求按界面语言发给服务端（`client.ts` 的 `serverLang`）。英文时由模型自己按清单问诊（中文规则读不懂英文回答），口语确认成英文医学术语（Doctors call this "throbbing pain"）；描述、医嘱整理、解释、照片描述都是英文。固定文字（开场、身体图部位、快捷回答、收尾两问、草稿保存/放弃、分诊建议和科室、每日追问、待办时间、提醒、用药时间解析）都有英文。危险信号新增英文规则（`src/lib/ai/fallbackEn.ts`），没有 Key 时英文模式也能按清单问诊、生成英文描述。去掉了「AI replies are in Chinese for now.」。英文描述只保留记录里有的内容（`onlyStatedEn` 去掉编出来的「没有用药」「没有别的症状」）。
- **post 的解答按学历和年龄**：`explainStyle`：高中/中专及以下通俗、用生活里的比方；大专平实、关键名词解释一次；本科及以上用医学名词并讲机制；70 岁以上句子更短、结尾重复要点。中文解答里夹的英文单词会被去掉。

验证（Windows 本机）：

| 检查 | 本次结果 |
| --- | --- |
| `npm run test:unit`（逐个文件跑，脚本里的 bash 循环在 Windows 上跑不了） | 16 个文件 1541 项全部通过 |
| `npm run test:dictation` | 18 项通过，1 项跳过 |
| `npm run test:accounts` | 16 过 9 不过；干净的 origin/main（6f57a1c）在这台机器上也是同样 9 项不过，和本次改动无关 |
| `npm run lint`、`npx tsc --noEmit` | 通过 |
| `npm run build` | 通过 |

另外用智谱实测英文问诊（口语确认、术语记录）、英文描述、英文医嘱整理、中英文按学历的讲解。旧测试里写着「英文模式下生成的内容仍是中文」「AED」「单位不随语言变」的断言，按新要求改了。

没做到的：英文模式下「给医生看」页面里由规则生成的首屏摘要和时间线仍是中文；以前用中文记的内容切到英文后仍是中文（是数据，不翻译）；中文的安全过滤规则读不懂英文，英文回答靠提示词约束；浏览器里没有逐页点过。

## 2026-10-04 改动：「给医生看」加回患者自述、病史一条一条、英文页面全英文、Record / 健康报告（Yueran，推 main）

- `src/components/DoctorSheet.tsx`：首屏加「患者自述 / In the patient's words」（pre 里生成的那段第一人称描述），打印、导出 PDF、复制文字都带上；「既往：A、B、C…」改成「既往病史」一条一行（手术单独一行），补充以往病史也在里面、会打印进 PDF。
- `src/app/doctor/[id]/page.tsx`：现病史按句拆成要点列表。
- 英文模式下「给医生看」整页英文：没有模型时由 `summaryByRuleEn`（`src/lib/ai/fallbackEn.ts`）写首屏、时间线、当前状态、病史、以前类似、提示、问题；有模型时规则部分也用英文版。复制文字英文版（`summaryToText`）、以前类似记录的日期和结果（`toRelatedContext`）、「还想补充？」里医生会问的问题（`missingBasics`）、点选的每日回答（Much better 等）都是英文。对话里规则判断的「今天去看医生」和危险读数警报在英文模式下用英文说。
- 底栏和页面：英文 Record，中文「健康报告」；新手引导同步。
- 测试：`rules-en.test.ts` 里「英文页面和中文一样」的断言改成「英文页面是英文、中文版不变」。

验证（Windows 本机）：`npx tsc --noEmit`、`npm run lint` 通过；单元测试 16 个文件 1544 项全部通过；`npm run build` 通过；听写测试 18 项通过；用智谱实测生成英文「给医生看」，10 个字段都没有中文。

## 2026-10-04 改动：pre 随时开新的、post 关联 pre 存成一条记录、问过的解释记进记录（Yueran，推 main）

- `src/components/chat/ChatScreen.tsx`：「开新的」只要说过话就在标题旁边：这一轮没完成就连同未保存的记录一起放弃；已经完成的只是清空对话、从「今天哪里不舒服」重来，已保存的记录不动。
- `src/lib/after.ts` / `src/app/post/page.tsx`：post 选了关联的 pre，就存进那条 pre 记录（健康报告里是一条「问诊 + 医嘱」），不再多一条；不关联才单独存一条医嘱记录。
- 在 Clinical Plan 里让 AI 解释过、追问过的内容（`learnedOf`），保存时作为 `VisitRecord.learned`（不关联时存在 `FollowUp.learned`）记进同一条记录；记录详情页多一块「看完医生后了解到的」，一条一条可以展开。没问过的照旧只存记录、加待办和提醒。
- 新测试 `scripts/tests/post-link.test.ts`：关联时不多出记录、医嘱进 pre 记录、了解到的内容在同一条记录里、不关联时单独一条。

验证（Windows 本机）：`npx tsc --noEmit`、`npm run lint` 通过；单元测试 17 个文件 1550 项全部通过；`npm run build` 通过。

## 2026-10-04 改动：Clinical Plan 按意思分条、「开新的」常驻底栏、病史有关的写正文无关的放括号（Yueran，推 main）

- 医嘱分条（`src/lib/reminders.ts`、`src/lib/ai/prompts.ts`、`normalizeAfter`）：整理医嘱时模型直接给 `adviceItems`（按意思分好的叮嘱，一个意思一条）；没有时规则也按意思分：顿号不拆，逗号后面是新的一件事（少吃…、按时…、冰敷…）才拆，「嗯」「那个」这类停顿去掉。
- pre（`src/components/chat/ChatScreen.tsx`）：「开新的」放进底部常驻的输入栏，和「给医生看的报告」同一行，滚动时也一直在；确认也在底栏里。
- 病情描述：和这次同一部位的旧病写进正文，无关的病史、长期用药和过敏放在必要信息最后的「（补充：…）」括号里（提示词、规则版 `splitHistory`、英文版）。修了三处：模型照抄示例的「没有明确外伤」「没有为膝痛用药」等会被去掉；括号被过滤截断时补回；患者自己的「想请医生…要不要做检查」不会被当成建议检查删掉（`repairNarrative`）。
- 测试：`reminders.test.ts` 加按意思分条的检查，`consult.test.ts` 加病史放正文还是括号的检查。

验证（Windows 本机）：`npx tsc --noEmit`、`npm run lint` 通过；单元测试 17 个文件 1557 项全部通过；`npm run build` 通过；用智谱实测医生说话卡壳时的分条和膝痛描述的病史放法。

## 2026-10-04 改动：post 存进 Record 的治疗计划和状态、复诊关联之前的记录、语言只在登录和设置里选（Yueran，推 main）

- 存进 Record 的 post 只放三样：Clinical Plan 每一条和它的状态（正在进行·第 N 天 / 已结束 N 天，按疗程和复诊日期自动算，也可以手动「结束」）、下次复诊和要做要带的东西、问过的问题（按针对的那一项整理）。新文件 `src/lib/records.ts`（`planFrom`、`planStatus`、`nextVisitFrom`、`previousContext` 等）、`src/components/VisitPlanView.tsx`；类型 `PlanItem`、`NextVisitPlan`，`VisitRecord` / `FollowUp` 多 `planItems`、`next`。
- 只用 post 的记录在 Record 里点进去是新页面 `/report/visit/[id]`，只有上面这些；pre + post 关联的记录详情页只留三块：给医生看的单子（和 PDF 一样，`src/components/EpisodeSheet.tsx`，医生页也改用它）、pre 的对话过程、post 的那三样。
- 复诊：pre 输入框上方、post 录音/上传上方各一个「复诊 / 关联之前的记录」按钮（`src/components/RecordLinkPicker.tsx`），post 里同时选这次的 pre（原来保存时的下拉框合并进来了）。复诊新建一条记录并标注 `followUpOf`；上一次的诊断、计划和状态、下次复诊、问过的内容作为 `previous` 传给 chat / summary / after / explain，pre 提醒该说什么，post 的解释不重复上次讲过的。
- 语言：顶栏的「中 / EN」去掉；登录、注册页选的语言登录后就是整个应用的语言（`reloadAccount`），之后只在「设置」里改。
- 测试：`post-link.test.ts` 加疗程识别、状态、下次复诊、复诊关联保存、手动结束、给 AI 的上一次记录。

验证（Windows 本机）：`npx tsc --noEmit`、`npm run lint` 通过；单元测试 17 个文件 1570 项全部通过；`npm run build` 通过；各页面在本地都能打开。

## 2026-10-04 改动：pre 底栏去掉「给医生看的报告」长条，post 直接问是不是复诊、用没用过 pre（Yueran，推 main）

- `src/components/chat/ChatScreen.tsx`：底栏只留「开新的」、复诊选择和输入框，去掉「给医生看的报告（…）」按钮。
- `src/components/RecordLinkPicker.tsx`：post 不再折叠，录音/上传上方直接两个问题——「这次是复诊吗？」（是 → 选关联哪条看过医生的记录）、「这次看医生之前，用过『看医生之前』吗？」（用过 → 选哪条 pre，和这次存成一条）；都可以选否。pre 的折叠复诊选择不变。
- `src/app/post/page.tsx`：不再自动预选最近的 pre，按用户的回答关联。

验证（Windows 本机）：`npx tsc --noEmit`、`npm run lint` 通过；单元测试 17 个文件 1570 项全部通过；`npm run build` 通过；/pre、/post 本地能打开。

## 2026-10-04 改动：身体图正面、背面的细分对应上，人体图变矮（Yueran，推 main）

- `src/components/chat/BodyMap.tsx`：膝、肩的细分图跟着点的那一面走——正面点膝是膝盖骨、外侧、正中、内侧，背面点膝是腘窝和内外侧（从背后看）；正面点肩是肩的前面，背面点肩是肩的后面；左右和外侧位置按那一面的朝向排。正面胸部、肚子，背面上背、腰、臀部不变。
- 人体图所有部位都保留，高度压到原来的 0.78，最高不超过屏幕高度的 46%，手机上一屏能看到整个人。

验证（Windows 本机）：`npx tsc --noEmit`、`npm run lint` 通过；单元测试 17 个文件 1570 项全部通过；`npm run build` 通过。

## 2026-10-04 改动：Record 标题是主要症状、复诊加「复诊 · 」并能跳到上一次和上上次，记录里 pre / post 分块更简明（Yueran，推 main）

- `src/lib/records.ts`：`allRecords` 的标题是主要症状一个短语（pre 记录的标题；只用 post 的复诊沿用上一次的症状，否则用诊断），复诊前面加「复诊 · 」；`followUpChain` 给出上一次、上上次；`recordNarrative` 去掉描述里档案已有的（开头年龄、结尾「（补充：…）」/「(Also: …)」）。
- `src/components/VisitPlanView.tsx`：复诊记录顶部「上一次：…」「上上次：…」两个跳转按钮，被复诊的记录显示「它的复诊：…」。
- `src/app/episodes/[id]/detail/page.tsx`：分成「看医生之前存的」（我的描述、可能有关的病史、给医生看的完整页 · 导出 PDF、折叠的对话过程）和「看医生之后存的」（治疗计划和状态、下次复诊、问过的问题）。给医生看的页面和 PDF 本身不变。
- `src/app/report/page.tsx`、`src/app/report/visit/[id]/page.tsx`：列表和只用 post 的记录页用新标题，加「看医生之后存的」小标题。
- 测试：`post-link.test.ts` 加复诊标题、两级跳转、描述去掉档案信息。

验证（Windows 本机）：`npx tsc --noEmit`、`npm run lint` 通过；单元测试 17 个文件 1573 项全部通过；`npm run build` 通过。

## 2026-10-04 改动：post 先问用没用过 pre，再问复诊；答完显示关联了哪条，Clinical Plan 页不再有关联选项（Yueran，推 main）

- `src/components/RecordLinkPicker.tsx`：post 先问「这次看医生之前，用过『看医生之前』吗？」——用过就选哪条 pre，和这次存成一条，复诊设置跟着那条 pre；没有用过才问「这次是复诊吗？」并选关联哪条。答完收成一张「这次关联的记录」卡片（写明哪条 pre、复诊关联哪条），可以「改一下」。
- `src/app/post/page.tsx`：整理出 Clinical Plan 之后不再显示关联选项，直接是 Clinical Plan 和解释；存储照旧按选的关联保存。

验证（Windows 本机）：`npx tsc --noEmit`、`npm run lint` 通过；单元测试 17 个文件 1573 项全部通过；`npm run build` 通过。

## 2026-10-04 改动：给医生看只一种语言、是 pre 的存档并收进详情；身体图每个部位都能细选；一直追问到具体；林叔数据改成现在的格式（Yueran，推 main）

- `src/lib/summaries.ts`、`src/lib/types.ts`：给医生看记下生成时的语言（`DoctorSummary.lang`，旧的按内容判断），界面换语言就按新语言重写，英文里不留中文、中文里不留英文；写的时候不带 post 存进来的就诊内容，记录里有了 post 之后这份就是当时的存档、不再改（只有换语言会重写）。顺手修了「最近血压 / 血糖」那一行把中英文名拼在一起的问题。
- `src/app/episodes/[id]/detail/page.tsx`、`src/app/report/page.tsx`：健康报告列表去掉「给医生看」入口；详情里只显示当时的病情描述，「更详细（给医生看的完整页 · PDF）」和「对话过程」都要点开。post 的存储不变。
- `src/components/chat/BodyMap.tsx`：每个部位点进去都有细分（头：前额、太阳穴、头顶、眼眶周围；四肢：前/后面、外侧、内侧；手、脚、脖子、胸、后脑、后颈、臀部、小腿肚、脚跟等），按点的那一面排。
- `src/lib/ai/prompts.ts`：一项没说具体就接着追问这一项，每次更具体一层、选项也更具体；身体图点过的位置不再问。
- `src/lib/demo-lin.ts`：十条记录按现在的格式：标题是主要症状短语（去掉「· 科室」）；复诊关联 R001 → R006 → R004（高血压随访）、R002 → R010（左膝）；看过医生的存下治疗计划（疗程、到哪天，药名剂量只照病历）和下次复诊、要带的东西。测试 `demo-lin-en.test.ts` 跟着改标题，药名剂量检查把照病历存下的计划也算作病历。

验证（Windows 本机）：`npx tsc --noEmit`、`npm run lint` 通过；单元测试 17 个文件 1573 项全部通过；`npm run build` 通过；中英两套林叔数据逐条核对标题、复诊链和计划状态。

## 2026-10-10 改动：新手教程填写密钥、设置更换密钥（codex/api-key-onboarding-settings）

从最新 `origin/main`（092a065）开分支。新手引导增加必填密钥步骤，未保存时「下一步」禁用，「跳过」和 Escape 也不能完成教程。设置首个分组提供服务商选择、密码输入、替换保存、测试已保存密钥，set 页有直接入口；中英文分别显示。

密钥与服务商按账号单独存进服务端 AES-256-GCM 加密表，不放进患者资料、浏览器持久存储或备份，状态接口只返回是否配置和服务商。所有 AI 接口以会话解析出的账号建立请求局部凭证上下文；不改全局环境变量、不跨账号复用客户端。语音连接缓存按凭证隔离。保存后下一次请求立即使用新配置；没有账号配置时保留已有环境默认配置。克劳德账号使用浏览器听写回退，不将克劳德密钥发给智谱。连接测试失败仅显示脱敏提示。

独立代码审查发现原演示入口保留了真实账号服务端会话；已改为先等待服务端退出成功，再进入林叔演示，失败时保留原账号并显示恢复入口。回归测试验证演示不能覆盖原账号密钥。

验证：`npm test` 在只含正式代码和本次改动的临时副本中通过；`npm run lint`、`npx tsc --noEmit` 在工作区和该副本均通过，`npm run build` 在实际工作区通过（临时副本的依赖符号链接被 Turbopack 拒绝，因此改在实际工作区构建）；新增测试覆盖未登录、非法输入、跨站写入、浏览器地址与 Next 内部地址不同的保存、加密存储、账号隔离、替换、并发智谱/克劳德凭证选择、模拟服务请求头及演示会话退出。390 像素手机与桌面浏览器验证教程必填、跳过/Escape、保存解锁、设置替换、刷新保留、中英文文案及进入演示后密钥表单禁用；浏览器没有运行时错误。再次 fetch 确认 main 无新增提交，独立审查无剩余重要问题。

工作区原有未跟踪 `scripts/tests/dictation-integration.test.ts` 会被根目录通配测试脚本扫到；它要求尚未进入 main 的独立听写接口，在干净 092a065 上也有 8 项失败，本次保留原样且不提交。完整测试使用干净临时副本以排除这份草稿；其余检查保留工作区结果。浏览器和测试使用虚构账号/密钥；真实服务商密钥、余额、模型可用性和实际语音/照片效果未验证。
