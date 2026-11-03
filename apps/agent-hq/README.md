# GitHub Pages publication

This app is published at **https://phetsamoneken-spec.github.io/beerlao/agent-hq/**.

From this repository root:

```sh
cd apps/agent-hq
npm ci
npm run dev
# Rebuild and refresh the committed website files:
npm run publish:files
```

Review and commit changes in both `apps/agent-hq/` and `agent-hq/`, then push to `main`. The existing GitHub Pages configuration publishes `main` at `/`; the new app is in `/agent-hq/`. Relative asset/manifest URLs and a scoped service worker support this subpath. The generated-site marker prevents the refresh script from replacing an unrelated directory. The original `Index.html` remains at `/beerlao/Index.html`.

This is a static prototype. Agent/task data is local to each browser and origin; it is not shared between users or synchronized with the downloaded HTML file. Real AI, login, Google Drive, and production document integrations are not connected.

---

# AGENT HQ — Isometric Chibi AI Studio

An upgrade of the existing Orbit workspace into an interactive **PixiJS illustrated chibi office**. A separate CEO coordinates the existing editable employees. All existing roles, source/template references, task history and review controls are preserved. The default language remains Lao, with Noto Sans Lao and an English toggle.

This is the requested **Phase 1 visual prototype**. No real AI, Google account, backend, or production database is connected. CEO routing is explicitly labeled conservative local keyword matching; it opens existing task forms and never claims work executed. Login and analytics screens are honest integration previews. No public deployment was performed.

See the [preservation checklist](docs/preservation.md) and [implementation checklist](docs/agent-hq-checklist.md). Source before the redesign was preserved at `/workspace/orbit-before-agent-hq.zip`.

## Illustrated room and faces

The current scene follows the user's chibi-studio reference: a glass-walled city-view office, central meeting table, coffee bar, plants, bookshelves and four neon-edged workstations. Original generated room artwork (`src/assets/chibi-room.png`) is a background layer. CEO and employee faces are separate cropped textures from the transparent sprite atlas (`src/assets/chibi-team.png`), with independent hit regions, idle motion, monitor overlays, foreground desk occlusion, hover highlights and labels derived from the actual saved records. It is not a flattened office screenshot.

`src/chibi.tsx` defines stable portrait selection and room actor positions. Existing `robot`, `orb`, and `capsule` avatar values continue to render without migration; new optional chibi choices are available in Agent Builder. Cards, the CEO panel and employee dialogs use the same portraits. Additional saved employees receive supplementary desks below the main room instead of being dropped. `src/PixelOffice.tsx` retains the previous scene source.

**Team Meeting** opens a roster of existing employees with workspace links. It does not simulate an AI meeting or complete tasks. **Coffee Corner** focuses the camera on the lounge; it has no task side effects. Both areas are also clickable in the room. No provider logos or “100% synced” claims from the reference were copied into this unconnected prototype.

## New office and CEO

Click the CEO to open Command Chat, Agent Assignment, Task Monitoring, Pending Approvals and Recent Reports. Budget, BAF and sales commands propose the mapped active employee; unknown/multiple categories request clarification. Review delegation, then provide the normal required fields before creating a task. Change mappings using saved employee IDs in Agent Assignment. Existing names/configurations are not rewritten to AI 1/2/3.

Click any employee's chibi character to open their existing workspace. Drag to pan, use the wheel or +/− buttons to zoom, and reset the camera as needed. The ≡ camera button switches to a lightweight workspace list. Additional employees receive desks automatically. Monitor glows and idle motion are decoration; status indicators and delegation activity use saved task states. All execution remains the existing explicitly labeled local simulation.

## Web installation and offline use

`npm run build` produces a manifest, icons and a service worker that caches only public app-shell files. Serve `dist/` on localhost or a trusted HTTPS origin and use a supporting browser's install action. The service worker does not cache APIs, credentials or user records. Offline behavior can be tested after the first successful load. Physical Android installation still requires device validation. The downloaded single HTML is a separate portable preview and does not register a service worker or offer PWA installation.

## Run locally

Requires Node.js 22.12+ (validated with Node 24.22.1), npm, and a browser supporting WebGL.

```sh
cd /workspace/orbit-office
npm ci
npm run dev -- --port 5173
```

Open the local server on port 5173 in your development browser. `npm run build` type-checks and creates `dist/`; `npm run preview -- --port 4173` serves that build. Nothing is deployed publicly. Vite binds all interfaces for development; use `--host 127.0.0.1` to restrict access on a personal machine.

There are no API keys or environment variables for Phase 1. All assets and libraries are installed locally; there are no runtime CDN or external API dependencies. Do not add sensitive or production data. Browser local storage is readable and editable by the local user and is not a secure database.

## Open without installing Node.js

A self-contained browser file is available at `/workspace/orbit-office-preview.html`. Download it and open it in Chrome or Edge. The workspace file viewer may not run HTML or preview ZIP archives; download/open the HTML in an actual browser. All JavaScript and styles are embedded. Browser policies may restrict opening local files or saving local data.

Rebuild it with `npm run build:standalone`. This writes `../orbit-office-preview.html`. No service is required for its bundled application code; an HTTP server remains an alternative where a browser restricts local files. The single-file application was browser-tested over local HTTP; direct `file://` testing is blocked by managed Chromium policy in this environment.

## Interface language and font

The interface defaults to Lao. Use **ພາສາ / Language** in the header to switch between Lao and English. The selection persists independently under `orbit-language`; switching languages preserves all existing agent/task records and stable status/permission identifiers. Custom names, instructions and business inputs remain user-authored data. Default role labels, required-field labels, task statuses and controls have Lao translations. Agents configured for Lao also produce Lao local demo draft headings; this does not add a real AI translation service.

Noto Sans Lao Variable is self-hosted from `@fontsource-variable/noto-sans-lao`. Font files are embedded as data URLs in the standalone HTML, so no Google Fonts connection is needed. The font license is included at `docs/Noto-Sans-Lao-LICENSE.txt`.

## Explore

- **Office overview:** pan, zoom or expand the pixel office; click an avatar or open its accessible team card.
- **AI employees:** create employees; change identity, avatar, role, instructions, required inputs, language, data references, preferred formats and permissions. Activate/deactivate or remove employees without task history.
- **Agent workspace:** scripted local chat, per-agent task history, and output library.
- **Task center:** enter dynamic required fields, save missing information, start/complete a local simulation, edit a draft, request review, reject/retry, approve, and export an approved plain-text document. Enable an agent’s `Export documents` permission first. Approved drafts are immutable. Editing pre-approval inputs invalidates prior drafts/reviews.
- **Documents:** inspect available task drafts and approvals.
- **Connections:** an explicit preview of planned Google Drive, Sheets, and Supabase connections. Buttons explain the implementation status; they do not connect accounts.
- **Settings:** review storage limitations and download a local JSON backup.

Refresh the same browser origin to retain your workspace. Different ports/origins have separate data. Clear the `orbit-office-v1` local-storage key to reset the demo. All sample records are fictional. No Google files, production databases, existing repositories or live deployments were modified.

## Scope and boundaries

This is Phase 1, not a production AI system. Demo Admin is a simulated role. Chat and drafts are explicitly labeled local simulations; they do not perform inference, business calculations, template mapping, or external reads. Drafts reproduce only user-supplied information and configured instructions. Missing fields block simulation. Word/PDF/Excel/Google formats are configuration preferences for later phases; only approved `.txt` export is implemented. Department/user access configuration is stored for future enforcement, not treated as secure browser authorization.

Authentication, Supabase persistence/RLS, Google OAuth, source previews/column mapping, real AI execution, binary document generation, production hosting remain future work; installed web builds have an offline app shell. No real OAuth tokens should be entered in the prototype. Human approval gates local export; production requires server-enforced authorization and immutable review revisions.

## Validation

```sh
npm run build
# With the dev server running, and Python Playwright + Chromium installed:
python3 tests/smoke.py
```

The smoke test uses `/usr/bin/chromium`, launches its own browser context, and clears only that context’s local demo state. It checks WebGL, agent editing/persistence, dynamic input gates, draft/rejection/approval/export, activity history, chat, mobile navigation, horizontal overflow and absence of runtime errors/external requests. Artifacts are saved under `tests/artifacts/`. It does not validate any future integration.

See [architecture and API design](docs/architecture.md), [proposed database schema](docs/schema.sql), and [testing checklist](docs/testing.md).
