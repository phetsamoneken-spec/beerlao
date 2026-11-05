# Phase 2 validation results

Validated on the feature branch in the managed local workspace. Automated write/authorization tests use isolated fixtures. Read-only management/Auth checks were also performed against the user-designated Supabase project; the explicitly approved schema installation completed on 2026-11-05, while real end-user Auth, Google operations and paid inference were not executed. The subsequently approved frontend deployment is live from a separate publishing branch, with a verified root-404 fix. No Edge deployment or merge occurred.

| Check | Result | What it establishes |
| --- | --- | --- |
| `npm run test:phase2` | **56 test definitions passed, 0 failures** | 13 AI Edge/provider tests, 16 core PostgreSQL tests, 1 environment guard, 6 transport tests, 1 schema-package test, 10 Drive API/crypto tests and 9 Drive PostgreSQL tests across seven files |
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

Rebuilt the production artifact with the actual public project configuration. The Phase 2 suite and strict Edge checking passed again. Chromium smoke passed against the exact staged static files, and an additional no-submit UI check passed cloud registration/sign-in controls, Lao font, no page errors and no failed assets. No account was created and no Supabase requests were made by the browser checks. Secret scans passed. Only generated `agent-hq/` files differ from main on the publishing branch. The public deployment configuration change was subsequently explicitly approved. The actual GitHub API request returned 403 / Resource not accessible by integration; read-back confirmed source remains main. No live frontend verification is claimed. See [deployment review](deployment-review.md).

## Live frontend publication and root-404 fix

The owner selected the approved publishing branch; the initial frontend deployment succeeded. The app path returned 200 while the repository root returned 404 because only capitalized `Index.html` existed there. Publishing commit `b894b07` adds lowercase `index.html`, redirects to `./agent-hq/` and retains the original dashboard path. Pages run [41977817797](https://github.com/phetsamoneken-spec/beerlao/actions/runs/41977817797) passed. Live checks verified HTTP 200 and exact SHA-256 hashes for the root, legacy dashboard and all 23 application files. Chromium started at the public root and passed the redirect/cloud login/registration/Lao-font check with no page/static-asset errors or Supabase requests. No signup/login was submitted. See [published evidence](verification/published-2026-11-05.json). Historical blocked-deployment statements above describe earlier stages; frontend publication is now complete, while real hosted Auth workflows, AI deployment and Google operations remain unverified.

## Prepared Google Drive implementation

The full 56-definition Node suite passed after adding Drive OAuth/read/disconnect (seven isolated test files). Both Edge entry points pass strict typecheck and the React/TypeScript production build passes. The new `tests/phase2/drive.py` Chromium suite passed Admin/Manager/Member access, explicit scope consent, backend-unavailable errors, account confirmation, exact-file approval, escaped hostile source text, Lao/mobile and disconnect/local-data preservation. Existing `tests/phase2/cloud.py` and `tests/smoke.py` also passed against the updated source. All service/provider traffic in these new tests is intercepted or in-process; SQL runs only in isolated PGlite.

Read-only Functions/Secrets management requests still return 403 for missing `edge_functions_read` / `edge_functions_secrets_read`. The user has no Google Cloud/OAuth client and requested code/setup preparation. No Google OAuth consent, real token exchange, external file read/write, account creation, live migration 003, Drive Edge deployment or frontend publication was performed during this Drive change. The existing published website/main remain unchanged. See [Drive implementation limits](google-drive-implementation.md) and [Lao setup](google-drive-setup.lo.md).

## Windows Drive deployment preparation

Added six offline PowerShell guard/multipart checks for the Windows handoff. The test uses an official SHA-256-verified PowerShell 7.6.9 portable runtime, mock HTTP metadata/source functions and synthetic credentials only. Default mode performs only reads; missing secret names, wrong token type, existing-function overwrite and cancelled live confirmation stop before upload; multipart preserves all relative source paths and rejects checksum tampering. Added this check to the isolated review CI. A Drive-enabled frontend production build passed and was scanned for management/provider secrets. No live upload, SQL migration 003, secret mutation, frontend publication or Google operation was performed. The user-reported `functions : PASS` / `secrets : PASS` apply to their local credential, not the cloud binding. See [rollout plan](verification/drive-rollout-plan-2026-11-05.json).

## Approved Drive migration rollout

The user explicitly approved the three-step Drive rollout. Migration 003 was installed atomically through the Management API with a pinned source checksum and existing-schema guard. Read-only hosted checks passed: thirteen service-only Drive RPCs, empty search paths, no anonymous/authenticated execution, no browser attempt/token access, two source metadata columns, two refresh lease fields, token FK, all twelve public RLS flags preserved and zero inserted attempts/tokens/connections/sources. No 001/002 rerun or Google operation occurred. The Windows deployment helper now passes seven offline checks, including optional deployment-response fields; actual function upload/frontend publication remain pending. See [migration evidence](verification/drive-migration-2026-11-05.json).

## Windows upload failure diagnosis

The user-reported first real upload returned HTTP 400; the initial helper discarded the API error message, so its cause remains unconfirmed. A public OPTIONS check still returns 404. Pinned Supabase/Zod npm versions both exist (public registry HTTP 200), ruling out missing releases. The helper now matches conventional FormData wire fields (quoted names, plain metadata, no filename* duplicate, explicit empty static patterns), and reports only bounded structured API error messages with token/control-character redaction. Eight offline PowerShell guard/multipart/response/redaction checks pass. This is not a verified hosted-deployment fix. No automatic retry, SQL rerun, frontend change or Google operation occurred.

## Confirmed hosted dependency-resolution failure

The user supplied the second upload’s structured error: the hosted bundler could not resolve the pinned npm Supabase client because `nodeModulesDir` was manual. `npm run check:edge:clean` reproduces that exact failure using copied source/config, no package.json/node_modules and a fresh Deno cache. Changing the Edge config to auto resolves dependencies and typechecks both entry points successfully in that isolated condition. Added this meaningful check to review CI; ordinary checking in a populated npm checkout had hidden the deployment problem. Updated the Windows release source pin and deno.json checksum. No hosted retry or SQL/frontend change was performed by the agent.

## Completed Drive deployment and public checks

The user deployed `drive-api` version 1 from pinned source `74766e9` through Windows helper release `ecf0037`, keeping their new token local. Independent live checks returned allowed OPTIONS 204 with the exact origin, anonymous POST 401 UNAUTHENTICATED, empty callback 400 OAUTH_STATE_INVALID and hostile-origin OPTIONS 403 without CORS permission. This verifies remote bundling/boot and denial behavior, not Google consent or secret correctness.

The reviewed Drive-enabled frontend was published to the approved Pages branch at `9788683`; Pages run 42061379256 succeeded. HTTP 200 and exact hashes passed for all 23 app files plus root and legacy pages. Live Chromium root redirect/cloud signup controls/Lao font/static assets passed without page errors, HTTP errors or submitted Auth requests. No SQL rerun, main merge, hosted fixtures, real account creation or Google file operations occurred. Historical pending/failure statements above describe earlier stages. [Release evidence](verification/drive-release-2026-11-05.json).

The same published artifact also passed the intercepted Drive browser suite for Admin, Manager and Member: consent/unavailable errors, Google handoff and original-session account confirmation, exact-file approval, escaped hostile content, Lao/mobile layout, disconnect and unchanged local browser data. Every Supabase/Google call in that suite was intercepted or aborted; it proves published UI behavior rather than real OAuth/provider behavior.
