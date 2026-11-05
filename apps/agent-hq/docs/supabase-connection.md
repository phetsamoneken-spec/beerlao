# Current Supabase connection status

Project: `vhywnalpkahkfqhiqdgd` (Ai team), `https://vhywnalpkahkfqhiqdgd.supabase.co`.

The supplied publishable key is configured only in ignored `.env.local`, with `VITE_PHASE2_ENABLED=true` for local review. No credential values are committed. Public environment templates remain disabled by default. The browser never receives the management token, service-role key or AI key. The management credential is provided through the managed environment proxy only for `api.supabase.com`.

| Verification | Result |
| --- | --- |
| Public Auth health/settings | HTTP 200; email authentication and registration enabled |
| Management read-only query | Authorized; metadata query ran with transaction read-only on |
| Application schema | Installed: twelve public tables with RLS and SELECT policies, plus private schema |
| Application users | Zero Auth users at preflight; none created by this task |
| Anonymous organizations REST / organization RPC | Both HTTP 401 / 42501 (permission denied); schema is recognized |
| `agent-api` Edge Function | 404 / NOT_FOUND, not deployed |
| Live installation | Approved and completed atomically on 2026-11-05; no user/business records inserted |

## What the web app now supports

Cloud account registration/sign-in uses Supabase Auth. Confirm the email and return to the app to sign in. Sessions remain in memory and a reload requires sign-in again. Before public rollout, configure Supabase Auth Site URL, allowed email redirect URLs and email delivery/rate limits for the reviewed frontend. This task does not change those hosted Auth settings or send real signup emails.

Authenticated company setup, agent/membership administration, tasks, reviews and approved plain-text exports use audited SQL RPCs directly under the caller's session. Backend authorization, organization/department isolation, validation and limits are enforced in PostgreSQL; the client cannot assign itself a role. CEO routing and inference stay on the secured Edge Function with no direct browser inference/finalization RPC and no mock fallback.

The first confirmed user can create their own organization and becomes its Admin. Other users are added by an Admin using their confirmed Auth user UUID. No organization or business data is imported automatically. Signup is self-service, not a replacement for a reviewed invitation-only policy if that is required.

## Reviewed installation artifact

```sh
cd apps/agent-hq
npm run prepare:schema
```

This creates `supabase/.local/phase2-schema-review.sql` plus its SHA-256/source manifest. It makes no network/database connection. It combines the two version-controlled migrations into one transaction, takes a transaction lock and refuses existing application tables or a private schema before any DDL. It inserts no users or business records. The original `docs/schema.sql` remains an older design and must not be run alongside these migrations.

The user explicitly approved this exact Management API installation after the earlier approval-review rejection. The pinned package completed on 2026-11-05 at 05:40:54 UTC in project `vhywnalpkahkfqhiqdgd`. Its SHA-256 is `ba8e2c9ae1a349b95bd70ca2c46ac0df80be962db9f9d610276eebf07de81857`. See the [credential-free installation and verification record](verification/supabase-2026-11-05.json). Do not rerun these create-table migrations on this project. They were installed as one Management API transaction, not with the Supabase CLI; CLI migration history must be explicitly reviewed and reconciled before any future `db push`.

## Remaining integration work

Hosted metadata checks passed: all twelve tables have RLS and one SELECT policy; authenticated users have SELECT only, with no direct INSERT/UPDATE/DELETE/TRUNCATE grants; anonymous table/RPC access is denied. All eleven public RPCs use an empty search path and SECURITY DEFINER; AI finalization is executable by service_role, not authenticated/anon. Five immutable-record triggers exist. The private token table is inaccessible to authenticated users. Auth users, organizations, tasks and audit events remain empty.

Real signup/sign-in and multi-user hosted isolation/mutation flows remain untested; those authorization flows passed in local PostgreSQL fixtures only. Account creation is performed by the user through the app. No schema overwrite or existing production-data change is authorized.

Real AI still requires a separately approved `agent-api` deployment and server-side `AI_API_KEY`, `AI_MODEL`, Supabase runtime keys and exact `ALLOWED_ORIGINS`. A cloud proxy secret is not a raw secret to forward to hosted Edge Functions; configure hosted provider secrets through the reviewed Supabase secret-management surface. Google Drive migration 003 and `drive-api` version 1 are installed, and the approved production frontend now enables Drive. Public CORS/auth-denial checks pass; real Google account consent/read/refresh/disconnect remain unverified. See [Lao Google setup](google-drive-setup.lo.md). The explicitly approved frontend is now live on GitHub Pages from the publishing branch. Main and Draft PR remain unmerged; The AI Edge deployment remains outstanding. The new Drive deployment token stayed on the user’s Windows PC.

## Deployment follow-up

The owner selected the explicitly approved `pages/agent-hq-phase2` source after the integration could not write Pages settings. The frontend is now live; the lowercase root redirect fixes the original root 404, and all 25 verified public files return 200 with expected hashes. A live Chromium no-submit check passed cloud signup controls and Lao font with no page errors. No main modification/merge occurred. Management access to functions, Edge secrets and Auth configuration is also denied (403, missing scopes). See [deployment review and required permissions](deployment-review.md) for the concrete publishing target, test evidence and next steps.

## Approved Drive migration installed

The user approved the exact migration/user-local backend deployment/frontend rollout. Migration 003 has completed atomically, and thirteen Drive RPCs are service-only with empty search paths, while browser access to attempt/token records is denied and all twelve public RLS flags remain enabled. Source metadata, refresh leases and the token FK are present. No OAuth attempts/tokens/connections/sources were inserted. The new deployment token remains on the user’s Windows machine. The user-local upload completed, independent public backend checks passed, and Pages release `9788683` succeeded. All 25 public file hashes match the reviewed artifact/root/legacy pages. No main merge occurred. Google consent remains a user-account step; see [release evidence](verification/drive-release-2026-11-05.json). [Evidence](verification/drive-migration-2026-11-05.json).
