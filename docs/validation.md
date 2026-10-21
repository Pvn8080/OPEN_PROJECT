# Validation evidence

Tested in the prepared Linux cloud workspace on October 21, 2026. This report distinguishes the implemented web prototype from live external services and native desktop applications.

## Current evidence

- Domain/API suite: 40 passing tests, including all dependency types, signed lag, calendars/DST, critical path, automatic rescheduling, resource costs/capacity, baselines, templates, authorization, invitations, conflicts, AI lifecycle, persistence/reopening, and consistent backup/restore.
- Browser coverage: the 14-scenario Chromium suite passed. Additional targeted checks passed for the calendar exception form and native row reordering. A combined final run is recorded below when completed.
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
| A13: scale | The 1,000-task / 1,500-dependency / 100-resource fixture passes the Chromium four-times CPU-throttle test; raw measurements are saved with the final run. |

## Performance method and limits

Machine: Linux x64, Intel Xeon Platinum 8573C, five reported logical CPUs, approximately 33 GiB RAM; Node 24.19.0. Browser: system Chromium 154.

The fixture includes a long acyclic dependency chain plus additional edges. Thirty actual domain recalculations vary task duration; p95 must be below 1,000 ms. Thirty task-search input-to-next-frame measurements must be below 100 ms under four-times CPU throttling. Search filters settle after a 150 ms pause; input feedback measurements do not represent completion of filtering, network saves, or every possible drag interaction. Rendering virtualizes rows and culls dependency paths outside the visible row range.

The latest full run before the calendar/reorder form checks measured schedule p95 approximately 430 ms and input feedback p95 approximately 22 ms. These are measurements on this machine, not universal device guarantees.

## Remaining external validation

- No `AI_API_KEY` binding was available. No live provider request or AI-generated-plan quality evaluation is claimed.
- Safari and Microsoft Edge are not installed in this Linux workspace. Actual Safari/Edge and Mac/Windows applications were not validated.
- Outbound email, hosted deployment, production identity controls, scheduled production backups, and fresh-task snapshot restoration are not claimed.
- Code is committed locally; no remote push, merge, or environment publication is performed automatically.
- Offline synchronization, native packaging, live coediting, resource leveling, earned value, portfolio planning, and Microsoft Project compatibility remain outside this prototype.

## Final combined verification

Final test and startup results are appended after execution. Earlier failed development checks were diagnosed and corrected; they are not counted as passing checks until rerun.
