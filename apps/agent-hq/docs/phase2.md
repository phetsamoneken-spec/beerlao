# AGENT HQ Phase 2 — implementation for review

**Review branch. No deployment or local-data import has been performed. Live schema installation is still blocked by automatic approval review; only read-only project checks have executed.** Source is in `apps/agent-hq/`. Published `agent-hq/` stays unchanged. The cloud feature is disabled by default.

## Existing code inspected

The React/TypeScript/Vite app renders the existing PixiJS chibi office, character portraits, Lao/English controls and self-hosted Noto Sans Lao. `App.tsx` owns the local demo, dynamic task forms and approval workflow; `ceo.tsx` provides the existing local CEO command center; `model.ts` defines agent/task configurations. Browser records use `orbit-office-v1`, the separate CEO routing/history keys and `orbit-language`. Upload contents/metadata live in IndexedDB `agent-hq-files-v1`.

`docs/schema.sql` was reviewed as an earlier unexecuted proposal. It has partial organization policies, a reviewer role and no complete department isolation. It is **not** a migration. The new migrations are a separate design for an empty approved database. Do not execute both or apply these create-table migrations to an existing installation without a reviewed conversion plan.

The local demo keeps its existing characters, editing, upload, task and CEO flows. Shared agent-builder components were extracted without changing local persistence. Cloud office rendering uses the same office and portraits. No local data is copied to Supabase or AI automatically, and no data is deleted. A future import needs its own backup, mapping, preview, deduplication and explicit human approval.

## What is implemented

- Separate **Cloud workspace** navigation with real Supabase password authentication, self-service email registration, confirmed-user checks and organization selection. Sessions/refresh tokens remain in memory; a reload signs the user out. There is no simulated login in cloud mode.
- Admin organization creation, membership management by existing user UUID, versioned agent configuration, active/deactivated employees and full editable prompts. Registration uses the reviewed Supabase Auth service and requires email confirmation. Admin invitation, password recovery and MFA enrollment UI are not implemented.
- Cloud task creation and input correction through audited database RPCs; server-side real AI execution; immutable draft history; review request; manager/admin approval or rejection bound to exact content hash; approved plain-text download. Editing inputs invalidates the current draft/review and preserves history.
- CEO routing is real inference over **RLS-visible active employees**. It proposes a delegate or asks for clarification. The user reviews the suggestion and creates a task; it never dispatches an external write.
- Budget, Sales, Marketing and custom agent execution share the secured orchestrator. Budget requires positive `budget_amount` and uppercase three-letter `currency`; Sales validates supplied `sales_rows` and computes monthly totals/rank with integer cents before inference; Marketing uses only supplied authorized inputs. Existing BAF capability requires `official_template_text` and never assumes an official form.
- Missing business facts produce `Waiting for information`; provider errors produce `Failed`, without fallback to the local simulation. Real execution requires server configuration. Tests contain explicit fixtures; runtime has no mocked inference path.
- Google Drive OAuth is a **design deliverable only** in [google-drive-phase2.md](google-drive-phase2.md). Connection/source metadata and a private ciphertext table are foundations, with no token exchange or external writes wired in this PR.

## Authorization model

| Role | Scope and capabilities |
| --- | --- |
| Admin | Own organization across departments; users, agents and configuration; task assignment, review and exports |
| Manager | Own department only; create tasks, view departmental tasks, CEO suggestions and review authorized drafts |
| Member | Visible departmental employees/source references; own tasks, drafts, runs and approved exports; cannot review or manage membership/agents |

A membership has one department per organization. Department strings are case-sensitive; configure the same value consistently. Admin may access all departments within their own organization. Managers need a CEO agent in their accessible department; they cannot route via a hidden cross-department CEO. Multi-department non-admin membership is a future schema extension.

User UUID/role/department are verified from Auth/memberships, never client-supplied actor claims. Agent free-text `access`, Drive IDs and output-format preferences do not grant permissions. `Generate drafts`, current active state and `Export documents` are enforced server-side. `Save approved documents` is reserved and cannot enable a nonexistent external tool.

### Database

Version-controlled **drafts**, in order:

1. `supabase/migrations/202611040001_phase2_schema.sql`: all twelve requested public tables, tenant composite foreign keys, private token/rate-limit tables, RLS and immutable history.
2. `supabase/migrations/202611040002_phase2_operations.sql`: narrow audited authorization/state-transition RPCs, optimistic agent revisions, idempotent runs, request limits and approval/export gates.

Direct PostgREST RPCs validate complete agent configuration independently of the Edge Function: required fields, types, text limits, supported language/avatar/color, permission names, format arrays and unknown keys. Required identity/prompt text is trimmed before storing revisions. Task RPCs accept JSON objects up to 64 KiB with keys up to 200 characters and reject blank titles. Null execution/review/membership parameters fail with `INVALID_INPUT` before changing state. These checks are included in the approved schema package installed on 2026-11-05; no existing business or local records were converted.

Browser roles receive SELECT with RLS and specific RPC EXECUTE privileges, never table mutations. Anonymous users receive no application access. Every requested public table has an explicit SELECT policy. Private credentials are not selectable by browser roles. SECURITY DEFINER functions pin an empty search path. The service-role client is used solely to finalize an already-authorized AI run, with permission rechecks at completion; members cannot forge completion using direct RPCs.

Each task pins its agent revision. Disabling an agent or revoking its Generate drafts permission takes effect on new/finalizing executions. Current org membership/department/task ownership is checked throughout. All drafts/reviews/artifacts/audits/revisions are immutable. Approvals bind exact draft UUID and SHA-256; export verifies the current draft, current status, approved review and hash. Member approvals, cross-tenant foreign keys, stale reviews and stale config revisions fail.

### Browser requests and inference

Company setup, membership/agent changes, task inputs, reviews and approved exports call the narrow SQL RPCs using the signed-in user session. Database checks remain authoritative for direct requests. These operations no longer depend on an Edge deployment. The browser validates the same strict request contract; malformed inputs and actor fields are rejected, and SQL errors are sanitized. CEO routing/execution always call `agent-api`; the browser cannot begin/finalize inference through this transport. Missing schema and an undeployed AI function produce explicit errors, never local demo results.

### Request handling and inference

`agent-api` verifies Bearer tokens with Supabase `auth.getUser`, requires confirmed email, validates a strict action schema and bounds streamed JSON bodies to 64 KiB. Allowed origins are exact strings, never wildcards. CORS is an extra browser restriction, not authorization. Direct RPC calls remain authorized independently.

Per-user fixed-minute database limits (shared across organizations): create org 2, create task 20, CEO route 10, execution 5, administrative/review/export/input writes 60. Advisory transaction locks make increments atomic. Failed SQL transactions roll back counters; configure Supabase Auth limits and an upstream gateway/WAF for invalid/auth-failure traffic before production. Private request-limit rows need a reviewed retention/cleanup job; no job is installed here.

AI calls use a fixed OpenAI HTTPS endpoint, server-only credentials, an explicit model, structured JSON output, a 25-second timeout and bounded draft bytes. There is no provider-controlled tool dispatch, arbitrary URL fetch, file access or client-selected provider endpoint. Task data is placed separately as untrusted input. CEO can select only eligible UUIDs; it cannot invent a new agent. Source text never receives authority to grant tools or bypass review. Prompt injection can still influence draft prose; humans must inspect outputs. Treat model content as untrusted text (React escapes it, downloads use `text/plain`).

Runs are persisted before inference; duplicate request keys return their original state without another provider call. A second running run for a task is forbidden. Provider failures are finalized as errors, with sanitized codes. A process crash/finalization failure can leave a run `In progress`; after five minutes, an **explicit user retry** expires that run, audits it and may start a new run. Late completion of an expired run cannot create a draft. There is no automatic provider retry, background worker or long-running queue in this version. An explicit retry can incur another provider charge if an earlier response was lost.

Application mutations and AI outcomes produce audit events; logs contain request IDs/error codes rather than tokens or raw business inputs. Supabase Auth is responsible for login/security event logs. Send those logs to approved monitoring and choose business-data retention before production. AI drafts/inputs are organization data stored in Supabase and submitted to the configured provider; approve provider terms, residency and data categories before enabling.

## Environment variables

No actual credentials are included. Frontend `.env.example` defaults to disabled:

| Browser/public | Meaning |
| --- | --- |
| `VITE_PHASE2_ENABLED` | `true` only for an approved configured environment |
| `VITE_SUPABASE_URL` | HTTPS project URL (loopback HTTP allowed for local development) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` key or legacy anon JWT, never a secret/service role |

Server template: `supabase/functions/.env.example`.

| Server only | Meaning |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Project URL and public key for caller-scoped RLS requests |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged finalization RPC client only; never any `VITE_` variable |
| `SUPABASE_ACCESS_TOKEN` | Development management access scoped to `api.supabase.com`, used only for authorized management operations; never frontend or Edge runtime configuration |
| `AI_API_KEY`, `AI_MODEL` | OpenAI credential and a model supporting strict JSON-schema Chat Completions |
| `ALLOWED_ORIGINS` | Exact comma-separated frontend origins; Pages origin excludes its `/beerlao/agent-hq/` path |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_TOKEN_ENCRYPTION_KEY` | Reserved for the separately reviewed OAuth design; not used by current runtime |

The build guard rejects known server-secret variable names under `VITE_`, Supabase secret/management keys and privileged JWT public keys. This complements secret scanning; never assume arbitrary renamed secret values can be identified automatically. `.env` files are ignored; templates are versioned. The offline service worker caches only same-origin application assets, never remote Supabase/Auth/Edge responses.

See [recorded validation results](phase2-test-results.md) for executed checks and their limits.

## Reproduce checks without remote services

```sh
cd apps/agent-hq
npm ci
npm run test:phase2
npm run check:edge
npm run build
VITE_PHASE2_ENABLED=false npm run dev -- --port 5175
# In a second terminal, with Python Playwright and /usr/bin/chromium installed:
ORBIT_BASE_URL=http://127.0.0.1:5175 python3 tests/smoke.py
ORBIT_BASE_URL=http://127.0.0.1:5175 python3 tests/hq.py
ORBIT_BASE_URL=http://127.0.0.1:5175 python3 tests/uploads.py
ORBIT_BASE_URL=http://127.0.0.1:5175 python3 tests/phase2/disabled.py
```

PGlite runs actual isolated PostgreSQL with local test roles and an `auth.uid()`/`auth.users` fixture. The migrations execute **only in that transient local database**. No Supabase URL, SQL command against a remote database, Docker or production credentials are needed. Node tests mock provider HTTP and Gateway only in tests; real requests are mandatory in deployed code. Edge typechecking uses the pinned Deno/npm import map. CI on PRs runs tests/typecheck/build, has read-only repo permissions and contains no deployment/database job.

For intercepted cloud UI tests, start a second local Vite server with **test placeholders** (never real secrets):

```sh
VITE_PHASE2_ENABLED=true \
VITE_SUPABASE_URL=https://phase2-test.supabase.co \
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_browser_test_only \
npm run dev -- --port 5176
# All Supabase requests are intercepted by the test browser:
ORBIT_BASE_URL=http://127.0.0.1:5176 python3 tests/phase2/cloud.py
```

## Remaining integration checks and approval gate

Read-only checks against the designated project verified Auth health/settings and management SQL metadata. Real end-user signup/sign-in, hosted RLS mutation/isolation tests, paid inference and Google OAuth remain unverified. The user subsequently approved the exact Management API schema installation; it completed on 2026-11-05, and hosted RLS/grant metadata and anonymous-access denial checks passed. See [installation status and evidence](supabase-connection.md). PGlite validates SQL/roles/RLS, but is not an end-to-end hosted Supabase certification. Before enabling any remote environment, explicitly approve the target and test migrations, gateway JWT verification/signing-key compatibility, Auth confirmation/invitations/recovery/rate limits, real model support/cost/timeout behavior, revocation, RLS and concurrency against a disposable approved project. Review the default organization self-creation policy if a closed invitation-only company is required.

Google connections/sources are currently read-only foundations with no configuration UI/RPC, token vault implementation, ingestion/parsing or approved Drive write endpoint. PDF/Word/Excel generation, file malware scanning, background execution and large-file handling are outside this PR. Local uploads remain local and never become cloud evidence automatically.

Generate the atomic, guarded review SQL without executing it using `npm run prepare:schema`; output and SHA-256 manifest are under ignored `supabase/.local/`. The package refuses existing app tables/private schema and never inserts sample/local records. See [current connection status](supabase-connection.md).

Required future approvals are separate: merge; any further target-project SQL; Auth/provider/Google secret configuration; data migration/import; frontend/Edge deployment; and each external document write. A review approval alone must not execute these actions. Do not run `publish:files`, `supabase db push`, remote migrations or deploy commands, or merge this branch without the specific operation being authorized and permitted by automatic approval review.

## ສະຫຼຸບພາສາລາວ

Phase 2 ເພີ່ມ Cloud workspace, Supabase Auth, ສິດ Admin/Manager/Member, RLS ແຍກອົງກອນ/ພະແນກ, AI backend ຈິງ ແລະການອະນຸມັດຮ່າງດ້ວຍ hash. ຮັກສາຫ້ອງ Chibi, ພາສາລາວ/ອັງກິດ, Noto Sans Lao ແລະຂໍ້ມູນໃນເຄື່ອງເດີມ. Cloud ປິດໄວ້ກ່ອນ ແລະບໍ່ນຳເຂົ້າຂໍ້ມູນອັດຕະໂນມັດ.

ຍັງຕ້ອງຕັ້ງຄ່າ Supabase/AI ແລະທົດສອບກັບໂຄງການທົດລອງທີ່ອະນຸມັດ. Google Drive ມີພຽງແບບ OAuth ສຳລັບກວດທານ. ຂໍ້ມູນທຸລະກິດທີ່ປ້ອນຈະຖືກສົ່ງໃຫ້ຜູ້ໃຫ້ບໍລິການ AI ເມື່ອກົດດຳເນີນວຽກ; ຕ້ອງທົບທວນນະໂຍບາຍຂໍ້ມູນ ແລະຄົນຕ້ອງກວດຜົນ AI. ຕິດຕັ້ງ SQL schema ຈິງຕາມຄຳອະນຸມັດແລ້ວ ແລະກວດ RLS/ສິດຜ່ານ. ຍັງບໍ່ deploy, merge ຫຼືນຳເຂົ້າຂໍ້ມູນທຸລະກິດ. ຕ້ອງມີຄຳອະນຸມັດຊັດເຈນກ່ອນການປ່ຽນແປງເຫຼົ່ານັ້ນ.
