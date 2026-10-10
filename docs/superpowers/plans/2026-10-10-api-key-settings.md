# Account AI Keys Implementation Plan

> Execute inline in this session; the user has approved implementation.

**Goal:** Require a saved account AI key during the guide and let users replace it in settings.
**Architecture:** Separate encrypted credentials table; session-derived account; AsyncLocalStorage for credentials used by existing AI routes. Reuse one localized password-input editor.
**Tech Stack:** Next.js 16.3.8 route handlers, React 19, Node 24 SQLite/crypto/AsyncLocalStorage.

## Constraints

Use L for Chinese/English, #007866 controls, never commit secrets, retain existing clinical rules and teammate features. Use codex/api-key-onboarding-settings from latest origin/main.

- [x] Add encrypted read/write credentials to secure-db, separate from patient_data.
- [x] Add authenticated GET/PUT /api/ai-key: status only, validate provider and nonblank key, reject malformed/cross-origin writes.
- [x] Add request-local credentials context and wrap every AI route. Read keys/provider through context; create Anthropic clients per call; scope speech availability cache by credentials.
- [x] Add shared AiKeyForm: provider selection, password field, save, localized errors/status, optional test saved connection. Never return or persist raw keys in browser storage.
- [x] Insert required key step in GuideTour. Skip/Escape lead to this step until a saved account key is confirmed; only then finish. Reuse editor in /me/settings and link directly from /set.
- [x] Add isolated temporary-database tests for encryption, authenticated status/save, invalid inputs, replacement, account isolation and concurrent provider routing.
- [x] Run all four repository checks and inspect guide/settings at phone/desktop sizes. Document actual validation and limitations in docs/MAIN-INTEGRATION.md.
- [x] Fetch main, merge if needed, rerun checks, commit only related files, push own branch and create/attach PR.
