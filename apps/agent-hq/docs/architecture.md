# Architecture and phased implementation

## Current frontend

`src/model.ts` defines `Agent`, `Task`, `Message`, status vocabulary, starter records, local persistence and the demo draft formatter. `src/App.tsx` owns the application state and workflow views. `src/Office.tsx` is lazy-loaded and supplies the layered PixiJS chibi scene; `src/chibi.tsx` shares actor placement and portraits; `src/PixelOffice.tsx` retains the former pixel scene; `src/LegacyOffice.tsx` retains the previous 3D scene as source backup; a rendering failure leaves all team cards usable. `src/style.css` contains the responsive visual system, Tailwind import, and component styles. Vite builds the static bundle and a public app-shell service worker. `src/hq.ts` derives visual states and conservative keyword routes; `src/CommandCenter.tsx` provides the CEO interface without inserting a CEO into employee records. Read `agent-hq-checklist.md` for the current implementation boundary.

Agent configuration is the source of truth for role instructions, avatar, input fields, data-source references, output preferences and local capability toggles. No starter-agent ID or role name selects execution logic. The same workflow operates on every configured employee. Starter fields can be replaced by the admin.

Current persistence is `localStorage["orbit-office-v1"]`. No backend exists yet. The proposed SQL and API below are design deliverables, not deployed services. The initial local state contains three employees and one fictional review-ready document. Task logs are useful UI history but are mutable browser data, not production-grade audit records.

## Production system (Phases 2–4)

```text
React UI ── authenticated HTTPS ── Node.js API
                                    ├─ Supabase Auth + Postgres RLS + private Storage
                                    ├─ OAuth broker + encrypted Google token store
                                    ├─ authorized Drive / Sheets adapters
                                    ├─ queue → worker → AI provider (server only)
                                    ├─ schema + template validation / document renderers
                                    └─ revisioned approval gate + append-only audit trail
```

Use Supabase Auth with organization membership and admin assignment managed by trusted server operations. Verify JWT signature, issuer, audience, expiry, organization membership, agent assignment and department scope for every operation. Authorize workers too; never use an agent's browser-supplied permission claim as authority. Keep service-role credentials exclusively on the server and out of Vite-prefixed variables.

Separate human-readable configuration from enforceable structured rules. In Phase 2 migrate comma-separated demo required inputs to JSON Schema definitions with stable field IDs, types, validation and localization. Store versioned agent configurations; tasks reference the exact configuration revision. Persist language codes `lo`, `th`, `en`; localize generated content independently of UI text.

## Proposed API

| Endpoint | Behavior / authorization |
| --- | --- |
| `GET /v1/me` | Authenticated membership and effective capabilities |
| `GET,POST /v1/agents` | Scoped listing; creation requires org admin |
| `GET,PATCH /v1/agents/:id` | Read access; admin writes a new config revision with `If-Match` |
| `POST /v1/agents/:id/deactivate` | Admin-only; keep existing task history |
| `POST /v1/tasks` | Verify assignment, config revision, allowed task category and inputs; idempotency key required |
| `PATCH /v1/tasks/:id/inputs` | Owner/authorized editor; invalidate draft and approvals |
| `POST /v1/tasks/:id/execute` | Authorize; enqueue a job; return 202 |
| `GET /v1/tasks/:id` | Scoped state, progress, revision and audit references |
| `POST /v1/tasks/:id/submit-review` | Validate draft, freeze content hash and revision |
| `POST /v1/tasks/:id/reviews` | Authorized human reviewer, explicit approve/reject + reason and expected content hash |
| `POST /v1/tasks/:id/exports` | Enforce approved exact revision + export capability; create private artifact |
| `POST /v1/tasks/:id/save-to-drive` | Verify write scope, target folder, current approval and explicit action confirmation; idempotent |
| `GET /v1/artifacts/:id/download` | Scoped short-lived private download URL |
| `GET /v1/connections/google/start` | Admin session, OAuth state + PKCE; redirect to Google |
| `GET /v1/connections/google/callback` | Validate state, issuer, PKCE; exchange code server-side |
| `GET /v1/connections/:id/sources` | Read metadata only within granted sources |
| `POST /v1/connections/:id/test` | Non-destructive permission checks |
| `POST /v1/connections/:id/mappings` | Save spreadsheet tab/range + field mapping after validation |
| `POST /v1/connections/:id/revoke` | Revoke tokens and disable affected sources |

Return 400 for schema errors, 401/403 for authentication/authorization failures, 409 for stale revisions or invalid transitions, 422 for missing business data, 429 for throttling. Normalize/redact provider errors; never return tokens. Pagination, rate limits and request IDs apply throughout.

## Google Workspace plan

Use a server-side OAuth authorization-code flow with PKCE, CSRF state tied to the authenticated admin session, restricted redirect URIs and least-privilege consent. Use a Google Picker flow and `drive.file` when feasible. Broader read-only scopes require explicit justification and consent for the intended source selection; never silently expand scopes. Use a server-owned granted-source allowlist, not arbitrary browser file IDs. Google access does not bypass the app’s organization/department restrictions.

Encrypt refresh/access tokens with managed KMS; store ciphertext outside browser-accessible tables. Store expiry, scopes, account reference and revocation status separately. Refresh only server-side. Do not persist credentials in local storage or application logs. Revoke and erase credentials on disconnect.

Preview source metadata and authorized sheet headers, map stable source columns to schema field IDs, validate ranges, and handle missing/renamed columns and rate limits. Record source revision/time and provenance on outputs. Preserve originals; create new draft artifacts. Saving approved output to a specific Drive destination is a distinct confirmed action. No public Apps Script endpoint substitutes for authentication.

## Execution and review

Load a saved config revision → authorize → validate required input → ask for missing fields → read only allowed sources → load approved template → run AI with instruction/data boundaries → validate structured output and provenance → render draft → freeze revision → human review → export/save approved revision → audit every step. Treat source documents as untrusted data, not new instructions. Avoid fabrication: missing budgets, names, sales rows and template fields return validation errors instead of guesses. Restrict tools to declared capabilities.

Transitions: `New → Waiting for information → New → In progress → Draft ready → Awaiting approval → Approved → Completed`. Rejection returns a reviewed draft to revision work; retries create a new revision and require new approval. Failures enter `Failed` with a redacted reason and a retryable/non-retryable classification. Reauthorize when executing queued work and on every external action. Approval binds the draft hash, source/config revision, format, destination and reviewer; any material change invalidates it.

## Document and analysis adapters

Budget/BAF use admin-approved DOCX templates with typed placeholder mappings and missing-field reports. Render PDF in a sandboxed worker with verified fonts supporting Lao/Thai. Generate XLSX from validated numeric sales rows using fixed decimal/currency rules; group by shop ID and month and rank deterministically, without inventing missing amounts. Google Docs/Sheets output is a separate authorized create operation. Antivirus scanning, file-size limits, MIME checking, template sandboxing and private storage apply to uploaded inputs and generated artifacts.

## Next phases

2. Implement schema migrations, Auth, organization/department rules, persistent versioned configuration, API tests and RLS negative tests.
3. Implement OAuth, Picker, read-only source adapters, data preview/mapping, token revocation and permission tests.
4. Add provider abstraction, job queue, typed output validation, DOCX/PDF/XLSX renderers and revision-bound approvals.
5. Validate all starter workflows against authorized sample templates and sales data; test Lao/Thai fonts, real missing inputs, denied access, retries and exact output calculations. Deploy only after explicit admin approval.

## Browser file library

`src/uploads.ts` owns IndexedDB access and `src/FileLibrary.tsx` owns upload/preview UI. The new database is separate from `orbit-office-v1` and never migrates, resets or rewrites existing agent/task data. Stores `metadata` (unique hash index) and `contents` are updated together in read/write transactions for upload and removal; blobs are fetched only when previewing/downloading. Metadata assignment only changes the file record and is not an access-control grant or an AI input pipeline. Storage errors are reported without reporting an uncommitted upload as successful. Browser quota and profile lifetime determine retention. No backend endpoints, credentials or third-party upload packages are involved.
