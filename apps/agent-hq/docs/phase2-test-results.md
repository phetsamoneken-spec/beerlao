# Phase 2 validation results

Validated on the feature branch in the managed local workspace. Automated write/authorization tests use isolated fixtures. Read-only management/Auth checks were also performed against the user-designated Supabase project; the explicitly approved schema installation completed on 2026-11-05, while real end-user Auth, Google operations and paid inference were not executed. No deployment command was run. Published `agent-hq/` was unchanged.

| Check | Result | What it establishes |
| --- | --- | --- |
| `npm run test:phase2` | **37 passed, 0 failed** | 13 Edge/provider-contract tests, 16 actual local PostgreSQL tests, 1 public-environment guard test, 6 browser transport-contract tests and 1 local schema-package test |
| `npm run check:edge` | Passed | Deno strict typecheck of Edge entry point and shared modules |
| `npm run build` | Passed | React/TypeScript/Vite production build into ignored local `dist/` only |
| `tests/smoke.py` | Passed, no page errors | Local office/WebGL, editable agents, required-input gates, local task/rejection/approval/export, chat and mobile layout |
| `tests/hq.py` | Passed, no page errors | Original clickable characters, zoom, fourth employee, saved prompts/sources/templates/history, local CEO routing and data preservation |
| `tests/uploads.py` | Passed, no page errors | Picker/drop, IndexedDB persistence, duplicate detection, exact download bytes, safe Lao/image previews, validation, employee assignment, storage errors and no file POSTs |
| `tests/phase2/disabled.py` | Passed, no page errors | Disabled cloud mode, no Supabase requests, unchanged local data, Lao/English preview and mobile layout |
| `tests/phase2/cloud.py` | Passed, no page errors | Intercepted Auth/REST/Edge UI contract: signup confirmation, organization bootstrap without Edge, Admin/Member controls, selectable CEO capability, corrected inputs, expired-run retry, escaped drafts, review/export and memory-only sessions |
| `git diff --check` | Passed | No whitespace errors |

The PostgreSQL suite applies both SQL drafts to an isolated in-memory PGlite PostgreSQL instance, with fixture `auth.users`/`auth.uid()` and anonymous/authenticated/service roles. It covers all twelve RLS flags, organization/department boundaries, own-task scope, source/output/audit isolation, unconfirmed users, anonymous denial, direct mutation/finalization denial, forged cross-tenant references, self-promotion, last-admin protection, immutable revisions, missing inputs, idempotency, rate limits, provider failure state, revoked permissions, exact draft hashes, stale reviews, input invalidation and expired-run recovery. It does not connect to a hosted database.

Provider/Gateway HTTP fixtures exist only under tests. Runtime calls the real OpenAI endpoint and rejects absent credentials. Test assertions verify that no mocked success is substituted for a production AI error. Browser cloud tests intercept every request to a test-only Supabase hostname and do not certify the real hosted Auth/PostgREST/Edge deployment.

Existing regression suites were run against the local feature source on port 5175; the cloud UI suite used a separate local Vite process on port 5176 with public placeholder configuration. Browser state belongs to disposable test contexts. The shared form label fix was followed by another smoke/cloud run. Existing CEO/upload suites passed with the extracted shared builder; no persistence or upload implementation was changed afterward.

Still unverified: actual hosted JWT signing/gateway settings, provider model/account availability, production concurrency/load, Auth email/invite/recovery/MFA setup and every Google OAuth/token/Drive operation. These require a separately approved disposable integration environment and credentials before any production approval. See [setup and approval gates](phase2.md) and [Google OAuth acceptance plan](google-drive-phase2.md).

## Direct-RPC follow-up review

Four additional regression tests failed on the earlier draft and passed after adding SQL-level validation. The prior Edge path already validated these inputs; authorized direct RPC callers could store partial/mistyped agent configuration or task inputs with unsupported keys, and some null arguments raised generic constraint errors. No cross-organization privilege escalation was demonstrated.

The added tests exercise partial/unknown configuration fields, mistyped booleans/arrays, unsupported permissions/languages/portraits/colors, blank prompts/titles, excessive array/text/input sizes, all six valid portraits, normalization of required text, null run/review/membership values and unchanged task/review state after rejection. All 30 tests now pass against the amended drafts in local PostgreSQL. Frontend behavior is unchanged apart from Lao text for `INVALID_INPUT`; the browser results above remain the earlier regression baseline. Hosted service integration is still untested.

## Supabase connection follow-up

The current integration changes passed 37 Node tests, strict Edge checking and a Vite build. Browser cloud tests passed signup/email-confirmation messaging and new-organization bootstrap via direct audited RPCs; AI execution continued to use only Edge. Local smoke and disabled-cloud checks passed. Historical HQ/upload suite results above are the earlier regression baseline; those implementations were not changed.

Real read-only checks: Auth health/settings returned 200; email authentication and signup are enabled. The management API accepted read-only schema metadata queries and reported zero public tables, no private schema and zero Auth users at preflight. PostgREST returned PGRST205 for organizations; agent-api preflight returned NOT_FOUND. No user or organization fixture was inserted remotely.

After the user explicitly approved the exact live Management API installation, the pinned guarded SQL package completed atomically on 2026-11-05. Hosted read-only metadata checks verified twelve RLS tables/policies, SELECT-only authenticated grants, no anonymous access, eleven secured public RPCs, server-only finalization, five immutable triggers and no authenticated access to private tokens. Real anonymous REST and organization-RPC requests both returned 401 / 42501, replacing the previous missing-schema response. Auth health remains 200; the AI Edge endpoint remains 404. A final count confirmed zero Auth users, organizations, tasks and audit events. No hosted accounts, fixtures, paid AI calls, frontend/Edge deployment or merge were performed. Full hosted multi-user workflows still need separate validation. See [installation evidence](verification/supabase-2026-11-05.json).

## Frontend deployment preparation

Rebuilt the production artifact with the actual public project configuration. The Phase 2 suite and strict Edge checking passed again. Chromium smoke passed against the exact staged static files, and an additional no-submit UI check passed cloud registration/sign-in controls, Lao font, no page errors and no failed assets. No account was created and no Supabase requests were made by the browser checks. Secret scans passed. Only generated `agent-hq/` files differ from main on the publishing branch. The public deployment configuration change was rejected before execution; no live frontend verification is claimed. See [deployment review](deployment-review.md).
