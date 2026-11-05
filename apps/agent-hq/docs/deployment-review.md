# Frontend deployment review — 2026-11-05

The user explicitly approved switching GitHub Pages source to `pages/agent-hq-phase2`, path `/`, and deploying the prepared frontend. Automatic approval review accepted this fresh approval. The authorized GitHub API request then returned HTTP 403, `Resource not accessible by integration`: the current GitHub integration cannot write Pages settings. Read-back confirms the live source remains main. The user does not need to approve this operation again; repository-owner action or a GitHub integration with Pages write permission is required. No alternate credential or write route was attempted.

## Ready frontend

- Public URL: https://phetsamoneken-spec.github.io/beerlao/agent-hq/
- Current Pages source remains `main` at `/` (legacy branch deployment).
- Prepared source: `pages/agent-hq-phase2` at `f697fca92f49ea75f6c6db10992e54b04c00c7b2`, root `/`.
- Built from feature commit `2bd2ce65a0cc663a59df9812b295c4ce48c40900` with cloud enabled, the designated Supabase URL and publishable key. No service-role, management or provider key is included.
- The deployment branch starts from main `019f3d4609f00ba2d58819102ebaa3f17d1a8f1b` and changes only generated `agent-hq/` files. All other existing pages/source remain byte-for-byte unchanged. Main and Draft PR #1 are unmerged.
- Future GitHub Pages updates would follow this publishing branch, not main. Keep other root pages synchronized intentionally when publishing future releases.
- Proposed live change: set repository Pages source to branch `pages/agent-hq-phase2`, path `/`, using the normal GitHub Pages API. This publishes the prepared app at the existing URL. The exact change is now explicitly approved, but GitHub integration permissions block it.
- To restore the prior site after an approved rollout if required, restore Pages source to `main`, path `/`; this does not undo the separate database schema installation.

## Validation

The exact production artifact passed the existing Chromium smoke suite (office/WebGL, saved agents, local approval/export and mobile layout) and a separate cloud login/registration/Lao-font check. No signup or sign-in was submitted. No Supabase API requests were made by these browser tests. There were no page or static-asset errors. Build, Phase 2 tests and strict Edge typechecking passed. The artifact includes a file hash manifest in the [review record](verification/frontend-deployment-review-2026-11-05.json). Secret-pattern and exact management-binding scans passed.

## Backend/configuration blockers

Read-only management API requests return HTTP 403:

| Resource | Missing permission reported by Supabase |
| --- | --- |
| `/functions` | `edge_functions_read` |
| `/secrets` | `edge_functions_secrets_read` |
| `/config/auth` | `auth_config_read` |

The existing token can manage the database but cannot inspect these resources. No Edge deployment, secret write or Auth configuration mutation was attempted. Do not work around these scope denials by fetching other privileged credentials or weakening authorization.

For the next backend step, provide project-scoped Read/Write access for Edge Functions, Edge Function Secrets and Auth configuration in a Supabase management token for `vhywnalpkahkfqhiqdgd`; update the existing `SUPABASE_ACCESS_TOKEN` HTTP secret through Environment settings with allowed hostname `api.supabase.com`. Keep the token out of chat and repository files. Publish the environment change through the user-reviewed environment UI so the running session receives it.

Before deployment, verify hosted `AI_API_KEY` and `AI_MODEL`, exact `ALLOWED_ORIGINS=https://phetsamoneken-spec.github.io`, built-in Supabase runtime credentials and current JWT gateway/signing-key compatibility. Provider secret values must be configured directly in hosted Supabase Edge Function secrets, not forwarded from proxy-bound credential placeholders. No paid inference has been run.

Auth Site URL/redirect allowlist and email confirmation/delivery need review for the public app URL. Current permissions prevent reading or changing them. Real account and multi-user hosted workflow verification remains outstanding. Google Drive remains design-only.

## ຂັ້ນຕອນສຳລັບເຈົ້າຂອງ

1. ອະນຸມັດ deploy ແລ້ວ. ເປີດ [GitHub Pages settings](https://github.com/phetsamoneken-spec/beerlao/settings/pages), ເລືອກ Source → Deploy from a branch, Branch → `pages/agent-hq-phase2`, folder → `/ (root)`, ແລ້ວກົດ Save. GitHub integration ປັດຈຸບັນບໍ່ມີສິດປ່ຽນ setting ນີ້ໃຫ້.
2. ເພີ່ມສິດ Read/Write ສຳລັບ Edge Functions, Edge Function Secrets ແລະ Auth configuration ໃຫ້ management token ທີ່ຈຳກັດ project ນີ້.
3. ໃນ Environment → HTTP secrets → `SUPABASE_ACCESS_TOKEN`, ອັບເດດຄ່າ token; allowed domain ແມ່ນ `api.supabase.com`. ບັນທຶກ ແລະ Publish environment ຜ່ານໜ້າ UI.
4. ໃນ Supabase → Edge Functions → Secrets, ຕັ້ງ `AI_API_KEY` ແລະ `AI_MODEL` ສຳລັບ provider ທີ່ຈະໃຊ້. ບໍ່ສົ່ງ key ຫຼື token ໃນແຊັດ.

ຖານຂໍ້ມູນ 12 ຕາຕະລາງ ແລະ RLS/RPCs ຕິດຕັ້ງແລ້ວ. ເວັບຈິງຍັງເປັນລຸ້ນເດີມ ຈົນກວ່າຈະປ່ຽນ Pages source ໃນ GitHub settings. ບໍ່ຕ້ອງອະນຸມັດຊ້ຳອີກ.
