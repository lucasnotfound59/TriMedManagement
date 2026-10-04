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

## 2026-10-04 · 最新 main 功能审计

检查分支 `codex/function-audit-20261004` 从当时最新 `origin/main`（`c1ca47c`）建立，随后同步 `fc3896a` 的版本标记、`b11d53b` 的协作规范和 `6f57a1c` 的诊前入口调整；保留双方的整合记录。新增 [功能审计报告](audits/2026-10-04-function-audit.md) 及仅含虚构数据的截图、请求证据，没有修改产品功能。

验证了 22 个页面路由模板、林叔 R001–R010 全部记录入口、12 条新增病史、注册登录/引导、诊前定位与描述保存、诊后计划/追问/待办、指标 CRUD、年度报告、应急、备份和独立账号模块。浏览器日志记录超过 500 次成功点击；中英文在六种尺寸下共检查 156 次页面布局。发现 2 个 P1（慢网连续保存丢失第二次修改、未填写病史被写成阴性结论）和 3 个 P2（问答快捷问题被输入栏遮挡、AI 供应商与语音能力状态混淆、存储说明过时），复现及代码位置见报告。

`npm test`（1539 条应用断言、25 条独立账号测试、19 条独立转写测试）、`npm run lint`、`npx tsc --noEmit`、`npm run build` 全部通过；实际无密钥 HTTP 规则检查 63 项通过。Clinical Plan 成功路径使用受控识图响应，解释仍走实际无密钥接口；真实模型识图/语音质量、原生系统通知及实际拨号未验证。上述检查通过不代表报告中的五个缺陷已修复。
