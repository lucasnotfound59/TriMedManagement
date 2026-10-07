<div align="center">

# VisitSmoothie

**An agentic outpatient companion.**
**Prepare the story before the visit. Follow the plan after it.**

*Make care make sense.*

**English** · [Read in Chinese](README.zh-CN.md)

[Pitch deck (PDF)](docs/VisitSmoothie_Pitch_Final.pdf) · [Developer guide](#developer-guide)

</div>

---

## The problem

**The visit is short. The information isn't.**

| | |
|---|---|
| **10.15 billion** | healthcare visits in China in 2024 (National Health Commission, 2024 Statistical Bulletin) |
| **~3 minutes** | average consultation, after about 40 minutes of waiting, in one large tertiary hospital (JMIR, PMC12396732) |
| **11,959 outpatients** | surveyed; communication and time with doctors both shaped their satisfaction |

Interviews with our own families showed the gap from both sides:

- **Before the visit**, the full story is hard to pass on. Symptom progression, medicines, exposure and family history are easy to miss during a short history-taking.
- **After the visit**, the plan is hard to understand. Patients leave with a prescription but still want to know why this drug, for how long, and what to watch for.

## How VisitSmoothie helps

Two jobs, one record.

| Stage | What happens |
|---|---|
| **Before the doctor** | The patient describes the problem by voice, typing, a body map or a photo. The agent compares the profile, similar past visits and what it already knows, then asks **one missing item at a time**. The result is a patient-reviewed page for the doctor, with a rule-based urgency and department hint. |
| **In the room** | **No AI in the room.** The patient shows the page. The doctor decides. |
| **After the doctor** | The patient records the visit, with the doctor's consent, or photographs the record or prescription. VisitSmoothie builds a **Clinical Plan**: diagnosis, medicines, to-dos, cautions and follow-up. Tap any line to ask about it. |
| **At home** | Reminders from the lines the patient chose, "better / same / worse" check-ins, and answers grounded in the patient's own record. |

Every saved visit becomes memory. At the next visit, the agent starts from the last saved plan, the medicines and the profile.

## Features

- **Guided intake.** One question at a time, covering location, character, duration, triggers, associated symptoms, medicines, history and severity.
- **Body map.** Tap where it hurts, with close-ups for the knee, shoulder, back and abdomen.
- **Plain-language confirmation.** Colloquial words are confirmed before they are rewritten in clinical terms, and the patient's own words are kept.
- **Links to past visits.** When the current problem resembles an earlier one, the agent asks what is the same and what is different. It never draws the conclusion itself.
- **Page for the doctor.** A large-print summary first, details folded below. It can be printed, saved as PDF or copied.
- **Clinical Plan.** Built from a photo or a recording, with an explanation and follow-up questions under every line.
- **Reminders and check-ins.** Medicines, follow-up visits and things to prepare.
- **Ask about your record.** For example, "What did the doctor say last time?" Every answer names its source.
- **Emergency card.** Who I am, my conditions, my allergies, my emergency contact, and what to do if I faint.
- **Long-term tracking.** Blood pressure, blood glucose and weight trends, plus a yearly summary.
- **Bilingual.** Chinese and English interface.

## Safety principles

- The AI organises and reminds. **It does not diagnose**, and it never sets or changes doses.
- **Red flags are decided by fixed rules**, not by the model, and trigger an immediate "seek care now" alert.
- The page for the doctor is generated from what the patient actually said. Model output is filtered so it cannot invent facts, guess causes or name diseases.
- Patient data is stored per account, encrypted with AES-256-GCM.
- **All patients in this repository are fictional.**

## How we measure better care

| Dimension | Question |
|---|---|
| Communication and satisfaction | Do patients feel better able to communicate their concerns, and more satisfied with the visit? |
| Understanding and confidence | Do patients understand their treatment plan and feel confident about what to do next? |
| Adherence and follow-through | Do patients follow medicines, tests and follow-up plans more consistently? |
| Patient outcomes | Over time, do patients report better symptom and health outcomes? |

## Demo patient

**Uncle Lin** is a fictional 46-year-old man with hypertension, a shrimp allergy and recurring left-knee pain. His profile holds twelve history entries and ten past visits from November 2025 to October 2026. Open `/demo/lin` to see a patient who has used the app for almost a year, no password needed.

## Run it

Requires Node.js 24 or later.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000, or http://localhost:3000/demo/lin for the demo patient.

### API keys are not included

**This repository contains no API keys.** Before running any version, add your own keys to `.env.local`. That file is git-ignored and must never be committed.

| Variable | What to put |
|---|---|
| `GLM_API_KEY` | Your Zhipu GLM key. Also set `GLM_MODEL=glm-5`. |
| `AI_PROVIDER`, `ANTHROPIC_API_KEY` | Optional. Set `AI_PROVIDER=claude` and your Anthropic key to use Claude instead. |
| `DATA_ENCRYPTION_KEY` | Leave empty. It is generated on first run. |

Without a key the app still runs. Conversations fall back to built-in rules, and photo reading is unavailable.


## How it is built

| Layer | What it does | Built with |
|---|---|---|
| Interface | Capture, review, reminders | Next.js 16, React 19, Tailwind CSS 4 |
| Workflow | Routing, episode state, actions | TypeScript rules |
| Language | Intake, extraction, explanations | Zhipu GLM or Claude, with rule-based fallback |
| Storage | Isolated accounts, encrypted records | SQLite, AES-256-GCM |

## Not ready yet

- Reminders only work while the app is open.
- Voice and photo reading need a configured model key.
- English-mode safety filters are a first version.
- No clinical, usage or revenue results yet.

---

## Developer guide

### Pages

| Page | What it does | Path |
|---|---|---|
| Welcome | "Start my health journey" or "Have an account? Sign in" | `/welcome` |
| Sign up | Name, date of birth, sex and education, plus optional conditions, family history and allergies. A check-up report photo can fill them in. Fields can be left empty for demos. | `/onboarding` |
| Sign in | Name and password | `/login` |
| Home | To-dos and reminders, plus the question box. The tab bar opens Before, After, Records and Settings. Emergency is at the top. | `/` |
| Before the doctor | Guided intake, one question at a time, ending with the page for the doctor and a care hint | `/pre` |
| After the doctor | Record the visit or photograph the record or prescription, then review, explain and save the Clinical Plan | `/post` |
| Page for the doctor | Large-print summary first, details folded below. Print or copy. | `/doctor/[id]` |
| Records | Past visits, summaries and follow-up notes | `/report` |
| Settings | Profile, settings, developer switch and sign out | `/set` |

### Configuration

| Variable | Purpose | Default |
|---|---|---|
| `AI_PROVIDER` | Which provider handles chat, extraction and photo reading: `glm` or `claude` | `claude` when `ANTHROPIC_API_KEY` is set, otherwise `glm` |
| `GLM_API_KEY` | Zhipu GLM key. Used for everything when the provider is `glm`, and always for speech to text | empty |
| `GLM_MODEL` | Chat and extraction model for `glm` | `glm-5` |
| `GLM_VISION_MODEL` | Photo reading model for `glm` | `glm-4.6v` |
| `GLM_ASR_MODEL` | Speech-to-text model | `glm-asr-2512` |
| `GLM_BASE_URL` | OpenAI-compatible endpoint | `https://open.bigmodel.cn/api/paas/v4` |
| `ANTHROPIC_API_KEY` | Anthropic key, used when the provider is `claude` | empty |
| `CLAUDE_MODEL` | Model for `claude` | `claude-opus-5-5` |
| `DATA_ENCRYPTION_KEY` | Master key for patient data. Generated on first run. If it is lost, existing data cannot be decrypted. | generated |

Keys are read only by the server routes under `/api` and never reach the browser.

### Accounts and storage

- Accounts, profiles and visit records live in a server-side SQLite file, `.data/visitsmoothie.sqlite`, encrypted with AES-256-GCM. The demo patient stays in the browser only.
- Each patient's row is keyed by account ID. Every read resolves the user from an httpOnly session cookie, and there is no endpoint that takes another user's ID.
- Passwords are hashed with scrypt. Five failed sign-ins lock the account for 60 seconds. Sessions last seven days and end immediately on sign-out.
- `.env*` and `.data/` are git-ignored. Back up `.env.local` together with `.data/`.
- Before running on a public network, add HTTPS, an encrypted volume or a managed database, and a key management service.

### Developer switch

In Settings, tap "Developer" to turn it on or off. It is off by default and remembered only in this browser. While it is on, sign-up and sign-in fields can be left empty.

### Double-click launch on macOS

Double-click the `VisitSmoothie.command` launcher in the project root (its file name starts with a Chinese word meaning "Start"). It finds Node.js 24 or later, installs dependencies if needed, starts the app on a free port between 3000 and 3020, and opens the browser. Press Ctrl+C in its terminal window to stop.

### Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run test:rules` exercises the no-key rule flow over HTTP. Start a server without `GLM_API_KEY` and `ANTHROPIC_API_KEY`, then run `BASE=http://127.0.0.1:<port> npm run test:rules`.

### Versioning

The current release is in [VERSION](VERSION), in the format `YYYY-MM-DD-HH.mm` (Los Angeles time). Each release has an annotated tag `v<version>`. List them with `git tag --list 'v20*' --sort=-refname`.

### Standalone modules

- [visit-smoothie/](visit-smoothie/README.md): a standalone account and profile prototype on port 4190, with its own database.
- [patient-dictation/](patient-dictation/README.md): a reusable speech-to-text function and command-line tool.

### Documentation

`docs/` holds the handover notes, plans, feature descriptions, workflow diagrams, screenshots and the pitch deck. Most documents are in Chinese; see the [Chinese README](README.zh-CN.md) for the full developer notes.

## Team

**Tri Team**: Joanna (team lead & product lead), Ronnie, Nancy, Robin and Lucas (engineers).
