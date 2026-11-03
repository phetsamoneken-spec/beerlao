# AGENT HQ validation results

Current-instance validation used local servers and isolated Chromium browser contexts with fictional data. No public deployment or external API writes occurred.

- Production TypeScript + Vite build: passed.
- Self-contained HTML build with embedded Lao fonts: passed.
- `tests/hq.py`: passed; canvas selection for CEO/Mali/Kham/Noy, camera controls, extra employee, exact fixture preservation, default/edited routing, clarification and input gates, reload persistence, mobile layout and corrupt storage protection.
- Existing `tests/smoke.py` against the standalone HTML: passed; agent creation/configuration/persistence, input gates, local draft generation, rejection/retry, explicit approval, approved `.txt` download, audit history, chat, mobile layout, no runtime errors and no external service requests.

See `agent-hq-checklist.md` for implementation boundaries and tests still needed against real providers, templates, business data and physical devices. Backend login, Google Workspace, AI, Word/PDF/XLSX output and real analytics are not connected by this Phase 1 redesign.

- Production manifest/app-shell precache and complete offline scene reload: passed after correcting static-asset cache lookup for the preview server's Vary header.
- Android-emulated touch dragging followed by tapping the moved CEO sprite: passed. Physical Android hardware/installation remains unrun.
- Explicit lightweight mode and returning to the pixel scene: passed in `hq.py`; per-agent workspaces remain accessible.

A browser run with WebGL disabled selected an alternative graphics renderer rather than entering the manual lightweight UI. The deterministic lightweight-mode check validates the accessible non-scene workflow; it does not claim every device's graphics-failure behavior was tested.

## Illustrated chibi update

- Production and self-contained builds: passed with embedded room artwork, a transparent character atlas and Lao fonts.
- Updated `hq.py`: passed for individually clickable CEO/employees, camera controls, meeting/coffee controls, lightweight mode, extra employee, data preservation, conservative CEO routing and mobile layout.
- Android-emulated touch pan followed by selecting the moved chibi CEO: passed.
- Offline production reload: room, character atlas and Lao UI/font loaded successfully.
- Portrait framing and Escape-close of the meeting roster: verified in Chromium.
- Existing workflow tests additionally exercise changing and persisting a chibi avatar. Local same-origin blob URLs used by the image decoder are allowed by the network assertion; external service requests remain disallowed.

These checks validate interactive UI behavior with test records. They do not connect a real AI, Google service, or production database. Original art assets remain in `src/assets`; the image-generation source files are retained outside the project under `/workspace/generated_images`.
