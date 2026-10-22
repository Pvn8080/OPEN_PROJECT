# Validation evidence

Tested in the prepared Linux cloud workspace on October 21, 2026. This report distinguishes the implemented web prototype from live external services and native desktop applications.

## Current evidence

- Domain/API suite: 41 passing tests, including all dependency types, signed lag, calendars/DST, critical path, automatic rescheduling, resource costs/capacity, baselines, templates, authorization, invitations, conflicts, AI lifecycle, persistence/reopening, and consistent backup/restore.
- Browser coverage after redesign: all 17 functional Chromium scenarios pass. An intermediate combined run passed all 18 scenarios; the last combined run exceeded the large-project input-feedback budget. Scale variability remains a limitation.
- Type checking and a production bundle build passed.
- AI preview/apply/undo passed through the real API using an injected controlled provider. This does not establish live model connectivity or output quality.
- The primary planner passed axe checks for serious/critical WCAG 2/2.1/2.2 A/AA violations. This is targeted automated evidence, not a complete WCAG conformance audit.

## Requirements coverage

| Scenario | Evidence |
| --- | --- |
| A1: templates | All four starter templates pass domain validation; template selection and project creation are exercised in Chromium. |
| A2: task scheduling and interaction | Grid/Gantt persistence, keyboard move/resize, pointer cancellation, dependency controls, indent/outdent, and row dragging have browser checks. All four dependency types and hierarchy invariants have domain checks. |
| A3: calendars | Holiday/custom-hour/DST arithmetic has domain checks; the calendar exception form has a browser check. |
| A4: invalid plans | Cycle/self-link/summary-link rejection, invalid actual dates and invalid batch rollback have tests. |
| A5: capacity | Overload detection, resolution by moving work, fixed-duration behavior and resource UI creation have tests. |
| A6: baselines | Snapshot immutability, added/removed tasks, historical resource values and baseline UI capture have tests. |
| A7: progress and actuals | Completion/work/cost calculations, no inferred actual costs, save/reopen and restart persistence have tests. |
| A8: AI actions | Controlled-provider API and browser checks verify real proposals and application. Live provider access remains unverified without a key. |
| A9: undo | Browser apply/undo and API undo/redo/revision conflict checks pass; reversals conservatively reject intervening edits. |
| A10: sharing | Email-bound invitations, expiry/revocation, wrong-user denial, role checks and the viewer UI have tests. No emails were sent. |
| A11: concurrent edits | API rejects stale revisions; browser preserves the unsaved task draft after another session changes the project. |
| A12: AI unavailable | Missing-provider, timeout, cancellation, malformed commands, fabricated actuals, unauthorized changes, and synchronous-provider failures have tests. Manual editing remains available. |
| A13: scale | The 1,000-task / 1,500-dependency / 100-resource fixture meets recalculation timing, but input-feedback timing varies and exceeded the budget in the last combined run. |

## Performance method and limits

Machine: Linux x64, Intel Xeon Platinum 8573C, five reported logical CPUs, approximately 33 GiB RAM; Node 24.19.0. Browser: system Chromium 154.

The fixture includes a long acyclic dependency chain plus additional edges. Thirty actual domain recalculations vary task duration; p95 must be below 1,000 ms. Thirty task-search input-to-next-frame measurements must be below 100 ms under four-times CPU throttling. Search filters settle after a 150 ms pause; input feedback measurements do not represent completion of filtering, network saves, or every possible drag interaction. Rendering virtualizes rows and culls dependency paths outside the visible row range.

Before redesign, an isolated performance recheck measured schedule p95 249.4 ms and input feedback p95 25.8 ms. After redesign, an intermediate complete run passed all 18 tests, while the last complete run measured schedule p95 265.4 ms and input feedback p95 535.7 ms, exceeding the 100 ms feedback budget. This intermittent scale failure is unresolved. Raw pre-redesign samples are in [performance evidence](evidence/performance.json); the latest redesign samples are in [redesign performance evidence](evidence/performance-redesign.json). These are measurements on this machine, not universal device guarantees.

## Remaining external validation

- No `AI_API_KEY` binding was available. No live provider request or AI-generated-plan quality evaluation is claimed.
- Safari and Microsoft Edge are not installed in this Linux workspace. Actual Safari/Edge and Mac/Windows applications were not validated.
- Outbound email, hosted deployment, production identity controls, scheduled production backups, and fresh-task snapshot restoration are not claimed.
- Code is committed locally; no remote push, merge, or environment publication is performed automatically.
- Offline synchronization, native packaging, live coediting, resource leveling, earned value, portfolio planning, and Microsoft Project compatibility remain outside this prototype.

## Final combined verification

- `npm test`: 41 tests passed.
- `npm run test:e2e`: the last redesign run passed 17 functional scenarios and failed the performance feedback threshold. An earlier redesign run passed all 18 scenarios in 50.2 seconds; the latest full run was not wholly green.
- `npm run typecheck` and `npm run build`: passed.
- `npm ci`: completed from the committed lockfile (239 packages); rebuilt successfully afterward.
- Built application startup: served HTML and five bundled assets, authenticated a demo session, created a software-delivery project, persisted a named baseline, and reloaded revision 1 successfully.
- `npm run db:backup`: created an integrity-checked snapshot; the automated backup test opens the snapshot and verifies preserved data without later source writes.
- Development startup restarted successfully; client and API functional HTTP checks returned 200.
- Reusable `install_script` and `start_skill`, non-secret AI provider defaults, and the `AI_API_KEY` requirement were saved in the environment draft. `api.openai.com` was added for that credential destination. Saving did not apply or publish those settings.

[Current planner screen capture](evidence/open-project-preview.png). Earlier failed development checks were diagnosed, fixed, and rerun; no skipped live service is counted as passing.

Independent review fixes preserve recorded actual-cost rates, retain pending edits through navigation and unrelated edits, and reuse request IDs after uncertain responses. Regression tests passed for all three fixes.

## Professional design refresh

- Installed local copies of UI Skills baseline-ui and the frontend-design skill with their licenses; documented official Fluent/Carbon references in [design language](design-language.md).
- Replaced lavender neutrals, promotional copy and oversized chrome with navy navigation, compact summaries, consistent blue controls, clearer task states and adaptive bar-label contrast for resource colors.
- Production build and TypeScript checks pass. All 41 domain/API tests pass.
- All 17 functional browser scenarios pass after the final styling change. The scale scenario failed the 100 ms input-feedback budget in the last run; no universal responsiveness guarantee is claimed.
- Targeted axe checks on the planner pass; a separate check with the AI panel open found no WCAG A/AA violations. This is not a full conformance audit. Desktop and narrow-screen captures were visually inspected.
- [Full planner](evidence/open-project-redesign.png) and [AI panel](evidence/open-project-redesign-ai.png) show the current app.
- Groq's official cookbook confirms free account-issued keys. No live key was created or available, and current quotas were not verified. The environment tool refused to modify the existing secret destination requirement; no changes were saved by that call. [Setup instructions](free-ai-setup.md) explain the remaining secure configuration.

## Gantt visual refinement

The task pane now defaults to 460 px, leaving more timeline visible. Short bars have external task labels and date/progress tooltips. Milestones have labels, phase tracks are distinct, baseline tracks are thinner, date headers use two-letter weekdays, and the Today marker no longer overlaps phase labels. Grid lines and dependency paths are quieter.

`npm run build` passed, including TypeScript checks. The 14 other planner/interaction browser scenarios passed; the accessibility scenario initially detected low-contrast weekend header text. After darkening that text, its targeted rerun passed. All 15 relevant scenarios have passing evidence. No new scheduling or scale-performance claim is made.

[Updated Gantt capture](evidence/gantt-refined.png).

## Portable interactive preview

`npm run build:portable` generates a self-contained browser app at `portable/Open-Project.html`. The downloadable ZIP includes that HTML and instructions. The original server build continues to use its authenticated HTTP API; only the separate portable build substitutes a browser-local storage adapter.

Three added tests passed for persistence/revision conflicts, baseline retry idempotency/undo, and honest rejection of server-only features. The full domain/API suite now passes 44 tests. The production build and TypeScript checks pass. A browser smoke check loaded the exact HTML as a document with all other requests blocked: task creation survived reload, a baseline was saved and a JSON backup downloaded, with zero additional network requests. The backup contained one project and three history entries. Direct file navigation is blocked by managed Chromium policy, so downloaded-file behavior on a personal computer remains a manual check. No public URL or hosted deployment is claimed.
