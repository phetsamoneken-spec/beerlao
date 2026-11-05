# Current Supabase connection status

Project: `vhywnalpkahkfqhiqdgd` (Ai team), `https://vhywnalpkahkfqhiqdgd.supabase.co`.

The supplied publishable key is configured only in ignored `.env.local`, with `VITE_PHASE2_ENABLED=true` for local review. No credential values are committed. Public environment templates remain disabled by default. The browser never receives the management token, service-role key or AI key. The management credential is provided through the managed environment proxy only for `api.supabase.com`.

| Verification | Result |
| --- | --- |
| Public Auth health/settings | HTTP 200; email authentication and registration enabled |
| Management read-only query | Authorized; metadata query ran with transaction read-only on |
| Application schema | Zero public tables and no private schema at preflight |
| Application users | Zero Auth users at preflight; none created by this task |
| Organizations REST endpoint | 404 / PGRST205, schema not initialized |
| `agent-api` Edge Function | 404 / NOT_FOUND, not deployed |
| Live migration attempt | Rejected before execution by automatic approval review |

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

The user previously approved installation, but automatic approval review did not accept the earlier consent as unambiguous permission for this live management-API operation. The migration remains unexecuted. A fresh explicit approval of the exact target and persistent schema/RLS/RPC creation is required before retrying; do not bypass the rejection with another tool or route.

## Remaining integration work

After the approved schema is installed, verify all twelve RLS flags/policies, anonymous/direct-mutation denials and server-only finalization privileges. No schema overwrite or existing production-data change is authorized. Real account creation is performed by the user through the app, not by automated production test fixtures.

Real AI still requires a separately approved `agent-api` deployment and server-side `AI_API_KEY`, `AI_MODEL`, Supabase runtime keys and exact `ALLOWED_ORIGINS`. A cloud proxy secret is not a raw secret to forward to hosted Edge Functions; configure hosted provider secrets through the reviewed Supabase secret-management surface. Google Drive remains design-only. Main, the published `agent-hq/` directory and the live GitHub Pages site remain unchanged until deployment/merge is explicitly approved.
