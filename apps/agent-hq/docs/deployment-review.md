# Frontend deployment review — 2026-11-05

The user explicitly approved switching GitHub Pages source to `pages/agent-hq-phase2`, path `/`, and deploying the prepared frontend. The integration could not change settings (HTTP 403), so the owner selected the prepared branch through GitHub settings. Read-back now confirms that branch is the live Pages source. The initial frontend deployment at `f697fca` completed successfully on 2026-11-05 at 05:59 UTC. Public AGENT HQ returned HTTP 200, and a Chromium no-submit check passed login/signup controls, Lao font and static assets with no page errors. No main merge or account creation was performed.

## Ready frontend

- Public URL: https://phetsamoneken-spec.github.io/beerlao/agent-hq/
- Current Pages source is `pages/agent-hq-phase2` at `/` (legacy branch deployment).
- Initial release: `f697fca92f49ea75f6c6db10992e54b04c00c7b2`; root-404 fix: `b894b07f00466bd0101548ac48a19ead4176431d`, on `pages/agent-hq-phase2`, root `/`.
- Built from feature commit `2bd2ce65a0cc663a59df9812b295c4ce48c40900` with cloud enabled, the designated Supabase URL and publishable key. No service-role, management or provider key is included.
- The deployment branch starts from main `019f3d4609f00ba2d58819102ebaa3f17d1a8f1b` and changes generated `agent-hq/` files, plus adds a lowercase root `index.html` redirect. All preexisting files outside `agent-hq/`, including capitalized `Index.html`, remain byte-for-byte unchanged. Main and Draft PR #1 are unmerged.
- Future GitHub Pages updates would follow this publishing branch, not main. Keep other root pages synchronized intentionally when publishing future releases.
- The owner completed the approved Pages source selection. Future pushes to the publishing branch now trigger Pages deployment normally.
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

Auth Site URL/redirect allowlist and email confirmation/delivery need review for the public app URL. Current permissions prevent reading or changing them. Real account and multi-user hosted workflow verification remains outstanding. Google Drive read-only OAuth/read/disconnect source is now prepared for review and defaults disabled; its migration and backend have not been deployed. See [Drive implementation](google-drive-implementation.md).

## ຂັ້ນຕອນສຳລັບເຈົ້າຂອງ

1. GitHub Pages ຕັ້ງ branch ຖືກຕ້ອງແລ້ວ. ເປີດ https://phetsamoneken-spec.github.io/beerlao/agent-hq/ ເພື່ອໃຊ້ແອັບ.
2. ເພີ່ມສິດ Read/Write ສຳລັບ Edge Functions, Edge Function Secrets ແລະ Auth configuration ໃຫ້ management token ທີ່ຈຳກັດ project ນີ້.
3. ໃນ Environment → HTTP secrets → `SUPABASE_ACCESS_TOKEN`, ອັບເດດຄ່າ token; allowed domain ແມ່ນ `api.supabase.com`. ບັນທຶກ ແລະ Publish environment ຜ່ານໜ້າ UI.
4. ໃນ Supabase → Edge Functions → Secrets, ຕັ້ງ `AI_API_KEY` ແລະ `AI_MODEL` ສຳລັບ provider ທີ່ຈະໃຊ້. ບໍ່ສົ່ງ key ຫຼື token ໃນແຊັດ.

ຖານຂໍ້ມູນ 12 ຕາຕະລາງ ແລະ RLS/RPCs ຕິດຕັ້ງແລ້ວ. ເວັບ AGENT HQ ລຸ້ນໃໝ່ເຜີຍແຜ່ແລ້ວ. ຍັງລໍຖ້າສິດ Supabase ສຳລັບ AI backend ແລະການຕັ້ງຄ່າ Auth.

## Root URL 404 fix

The initial release served `/beerlao/agent-hq/` successfully, while `/beerlao/` returned 404 because the preexisting root entry was named `Index.html`. GitHub Pages paths are case-sensitive. A new lowercase `index.html`, versioned as `deployment/pages-index.html` in the application source, redirects the root to `./agent-hq/` and includes a plain link fallback. The old capitalized dashboard path is retained. The exact root redirect passed the local production Chromium check before publication.

The root fix is now live: Pages run [41977817797](https://github.com/phetsamoneken-spec/beerlao/actions/runs/41977817797) succeeded. Both the root and legacy dashboard return 200, all 25 checked public files match the expected hashes, and live Chromium passed the root-to-cloud-UI flow with no errors. See [publication evidence](verification/published-2026-11-05.json).
