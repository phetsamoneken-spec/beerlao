# AGENT HQ implementation and validation checklist

Current visual update: illustrated chibi studio with individually interactive characters, meeting roster, coffee focus, reusable portraits and preserved state. The original pixel-art implementation remains in `src/PixelOffice.tsx`; the art direction changed in response to the latest visual reference.

## Implemented Phase 1

- [x] Interactive PixiJS isometric chibi office, original illustrated room and separate animated character sprites.
- [x] Glass city-view walls, lavender tiled floor, central meeting table, coffee bar, bookshelves, plants and colored workstation platforms.
- [x] One separate CEO plus the existing three starter employee records; additional saved employees receive desks automatically.
- [x] Canvas character hit targets, highlighted employee selection, accessible keyboard shortcuts and existing React workspaces.
- [x] Mouse/touch dragging, wheel/button zoom, camera reset, expanded view and responsive layout.
- [x] Saved-task-derived states; decorative idle/monitor animation never updates tasks or manufactures progress.
- [x] CEO Command Chat, configurable employee-ID routing, task monitoring, pending reviews and recent drafts.
- [x] Conservative local budget/BAF/sales keyword suggestions; ambiguous/multiple categories ask for clarification, with no task created.
- [x] Explicit delegation opens the existing input form; it does not execute or complete a task.
- [x] Existing builder, dynamic roles, templates/source references, language, permissions, history, review gates and plain-text export retained.
- [x] Lao/English interface and bundled Noto Sans Lao retained.
- [x] Clearly labeled login and sales-analytics previews; neither claims connected authentication/data.
- [x] Production manifest, application icons and app-shell service worker for installable/offline web builds on a supported secure origin.
- [x] Standalone HTML excludes service-worker/manifest registration; all code and fonts remain embedded.
- [x] Lightweight interactive fallback if graphics initialization fails.

## Preservation

Read `preservation.md`. The source backup predates the redesign. Employee IDs `mali`, `kham`, `noy`, local storage key `orbit-office-v1`, and business models remain unchanged. No CEO record is inserted into the employees array. First load of an existing workspace keeps an exact additive snapshot at `agent-hq-preserved-workspace-v1`. Unreadable existing workspace data is not overwritten with demo records. CEO routes/history use new separate keys `agent-hq-routes-v1` and `agent-hq-command-v1`.

Browser storage belongs to the browser origin. A downloaded file opened under another path/browser may have a separate store. Export a local backup before moving origins; do not treat a blank new origin as deletion of the old store. The tests validate seeded saved records, not access to the user's personal browser. Keep using the same origin/file when upgrading.

## Automated validation commands

```sh
npm run build
npm run build:standalone
# Vite running on 5173:
python3 tests/hq.py
# To exercise the self-contained build with existing workflow tests,
# serve /workspace locally and use the standalone URL:
ORBIT_BASE_URL=http://127.0.0.1:8077/orbit-office-preview.html python3 tests/smoke.py
```

`hq.py` tests canvas selection for all four original characters, camera zoom/reset, employee 4, pre-existing configurations/templates/sources/history, clarification, all three route categories, editable routing, missing-input gates, reload persistence, corrupt-data preservation and mobile layout. Each browser page created by the test has isolated test storage. No production or Google data is used.

## Future phases — not connected or implemented

- [ ] Production Auth, Supabase persistence/RLS, signed-in user/department enforcement and server-only credentials.
- [ ] AI inference, semantic CEO routing, permission checks on every server request and real backend progress events.
- [ ] Authorized Google OAuth/Picker, Drive/Sheets access, official BAF/company templates and field mapping.
- [ ] Validated Word/PDF/XLSX generation, source/version provenance, exact sales calculations and real reports.
- [ ] Server-bound review revisions and explicit approved external writes.
- [ ] Authorized end-to-end sample data tests and device installation on a physical Android device.
- [ ] Exact visual comparison with Design #1 (the referenced image was not provided).
- [ ] Public deployment (requires explicit admin approval; not performed).

Phase 1 is usable as a local visual prototype and keeps all execution labeled as a simulation. The preserved prior backend design/schema documents are proposals, not deployed integrations. Current local toggles and Demo Admin are not production security controls.
