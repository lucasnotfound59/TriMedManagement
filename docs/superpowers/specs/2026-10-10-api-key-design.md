# Account AI keys

Approved in chat on 2026-10-10. Add a required key step to the first-use guide and a key editor in settings. Use Chinese/English copy through L, celadon controls, and existing shared UI.

Each signed-in account stores one selected chat/photo provider (Zhipu or Anthropic) and its key in a separate AES-256-GCM encrypted server row. Keys never enter patient state, backups, browser persistence, status responses, or Git. Request-local context selects credentials without changing process environment or sharing clients across accounts. Existing server environment configuration remains a fallback for accounts without a saved key and unauthenticated demo/registration requests. Anthropic does not support the existing Zhipu speech API; never reuse an Anthropic key for speech.

The guide requires a saved account key before completion, including its Skip and Escape paths. Settings permits replacing the provider/key and testing the saved connection. A successful save means stored, not verified by the vendor; connection failures keep the editor usable and show neutral localized errors. Existing account credentials are shown only as configured/unconfigured, never echoed.

Validate encryption, session authorization, account isolation, concurrent provider requests, replacement, and no key in responses/backups. Run npm test, npm run lint, npx tsc --noEmit, npm run build; inspect phone/desktop flows. Fetch main again, integrate it, rerun checks, then push the feature branch and open a PR with integration notes.
