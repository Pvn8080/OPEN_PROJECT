# Open Project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user selects delegation. Track work with the checkboxes below.

**Goal:** Build the approved shared web planner with professional scheduling, resources, baselines, templates, and validated AI analysis and edits.

**Architecture:** A React client consumes a same-origin Node API backed by SQLite. A pure TypeScript domain package calculates schedules and validates every manual or AI change; the server owns authorization, atomic persistence, revision checks, and history. The client uses that same domain package for previews.

**Tech Stack:** TypeScript, React, Vite, Express, SQLite via better-sqlite3, Zod, Luxon, TanStack Virtual, Lucide icons, Vitest, Supertest, Playwright. Use npm with a committed lockfile and Node 22 LTS or newer supported LTS. Direct dependencies are MIT licensed except Luxon (MIT) and SQLite (public domain); verify transitive licenses and exact versions at installation. A server-only OpenAI-compatible adapter supplies optional live AI; do not add a fake assistant as a substitute.

**Spec:** `docs/superpowers/specs/2026-10-21-open-project-design.md`

## Global Constraints

- The first product is a web prototype. Mac and Windows applications are the intended destination; desktop packaging is a later phase.
- Microsoft Project import, export, and file compatibility are out of scope.
- The default calendar is Monday through Friday, eight working hours per day.
- Use fixed-duration scheduling in the first build.
- The first build links leaf tasks and milestones; links to summary tasks are excluded.
- Baselines are immutable snapshots.
- The first build always requires the user to apply a proposed mutation through the preview.
- Invitations expire after seven days and can be revoked.
- The service uses a configurable timeout, initially 60 seconds, with no partial project mutation on timeout.
- Meet WCAG 2.2 AA for the primary planning workflows, including non-drag alternatives.
- Use the existing isolated checkout; do not create a worktree unless explicitly requested.
- Do not claim live AI, email delivery, cross-browser compatibility, production readiness, or performance acceptance without the corresponding evidence.

## Review Focus

1. DST changes and non-eight-hour calendar exceptions must not corrupt working-hour arithmetic; covered by Task 1 calendar tests.
2. Duplicate command submissions and stale revisions must not double-apply changes or overwrite newer edits; covered by Task 3 integration tests.
3. Malformed AI commands and instructions embedded in task descriptions must not bypass the command allowlist or permissions; covered by Task 7 adapter tests.
4. Deleted tasks and resources must remain identifiable in baselines/history without leaking across projects; covered by Tasks 2 and 3 tests.
5. Pointer cancellation, network loss, and concurrent updates must preserve drafts and leave persisted data unchanged until a successful commit; covered by Tasks 5 and 8 browser tests.

## File and interface map

- `shared/model.ts`: Zod schemas and inferred domain types, including ProjectDocument, Task, Dependency, Resource, Assignment, Baseline, Command, ChangePreview.
- `shared/calendar.ts`: timezone-aware working-hour arithmetic.
- `shared/schedule.ts`: dependency scheduling, summaries, critical path, violations.
- `shared/metrics.ts`: resource demand, costs, completion, and baseline variance.
- `shared/commands.ts`: pure validated command application and reverse changes.
- `shared/templates.ts`: four starter definitions and privacy-safe conversion.
- `server/db.ts`, `server/migrations/001.sql`: relational persistence and migrations.
- `server/auth.ts`, `server/members.ts`: accounts, sessions, invitations, permissions.
- `server/projects.ts`, `server/history.ts`: project API, revisions, atomic changes, undo/redo.
- `server/ai/provider.ts`, `server/ai/service.ts`: provider contract, structured proposals, request lifecycle.
- `server/index.ts`: app composition, production static serving, development entrypoint.
- `client/api.ts`, `client/state.ts`: typed requests and draft/revision state.
- `client/components/`: ProjectShell, TaskGrid, Gantt, TaskInspector, ResourceView, HealthView, Templates, ShareDialog, HistoryPanel, AIPanel, ProjectSettings.
- `client/styles.css`: shared visual tokens, layouts, interaction and accessibility states.
- `tests/domain/`, `tests/server/`, `tests/browser/`: domain, API, browser acceptance tests.
- `README.md`, `.env.example`, `docs/validation.md`: setup, secure configuration names, measured results and limitations.

Use separate focused modules when a component grows; do not collect unrelated application logic in a single component.

## Task 1: Calendar and scheduling foundation

**Files:** Create package/tool configuration, `shared/model.ts`, `shared/calendar.ts`, `shared/schedule.ts`, `tests/domain/schedule.test.ts`, `tests/domain/calendar.test.ts`.

**Interfaces:** `addWorkingHours(date: string, hours: number, calendar: Calendar): string`; `workingHoursBetween(start: string, finish: string, calendar: Calendar): number`; `schedule(project: ProjectDocument): ScheduleResult`. ScheduleResult contains calculated task dates, summaries, total float, critical task IDs, and manual-task violations. Store instants as ISO strings; render in the project timezone. Calendar shifts initially start at 09:00 local time and expose configurable start/hour/day exceptions.

- [ ] Write tests asserting an eight-hour Friday task finishes Friday at 17:00, its FS successor starts Monday at 09:00, and a holiday moves it to Tuesday; add DST and custom-hour exception cases.
- [ ] Write tests for FS/SS/FF/SF, signed lag, zero-duration milestones, disconnected tasks, nested summaries, manual violations, cycle/self-link rejection, and summary-link rejection. Assert a two-task sequential chain is critical and a shorter parallel branch has positive float.
- [ ] Run `npm test -- tests/domain` and confirm the new tests fail before implementing domain behavior.
- [ ] Implement schemas and topological forward/backward scheduling with validation bounds on dates, duration, and graph size; detect hierarchy cycles separately from dependency cycles.
- [ ] Run domain tests and `npm run typecheck`; commit the passing scheduling foundation.

## Task 2: Resources, tracking, baselines, and templates

**Files:** Create `shared/metrics.ts`, `shared/templates.ts`, `shared/commands.ts`, associated domain tests.

**Interfaces:** `calculateMetrics(project: ProjectDocument, schedule: ScheduleResult): ProjectMetrics`; `previewCommands(project: ProjectDocument, commands: Command[]): ChangePreview`; `instantiateTemplate(template: Template, options: ProjectOptions): ProjectDocument`; `toTemplate(project: ProjectDocument): Template`. Preview includes candidate document, field changes, schedule impacts, workload conflicts, and validation errors. Baseline snapshots copy values rather than references.

- [ ] Write failing tests for duration-weighted completion, milestone-only summaries, no double-counting, explicit actual work/rates, capacity overlap, rate change cost impact, and contradictory actual dates.
- [ ] Write tests proving baseline immutability, added/removed task reporting, working-time variance, and preserved historical resource identities after deletion.
- [ ] Write tests for all four starter templates, alternate project starts/calendars, valid dependencies, and removal of actuals, invitations, baseline history, and private member data from saved templates.
- [ ] Implement typed commands for task creation/update/deletion/reordering/hierarchy, dependency editing, calendar/settings, resource/assignment editing, progress, baseline creation, and template instantiation. Return deletion impact before applying; reject orphan assignments, invalid numbers, and summary field edits.
- [ ] Run domain tests/typecheck and commit. Confirm resource edits never silently change fixed task duration.

## Task 3: Persistent projects and command history

**Files:** Create `server/db.ts`, migration SQL, `server/projects.ts`, `server/history.ts`, and `tests/server/projects.test.ts`.

**Interfaces:** `commitChange(actor: Actor, projectId: string, expectedRevision: number, requestId: string, commands: Command[]): CommitResult`; `previewChange(...)` uses the same validators without persistence. API responses use 401/403 for access failures, 409 for stale revisions, and 422 for domain validation errors. History reversals are new validated changes, not unguarded snapshot replacement.

- [ ] Write failing API tests for project persistence/reopen, rollback of invalid batches, duplicate request IDs, simultaneous revision submissions, and history preservation of deleted entities.
- [ ] Create normalized tables for users/sessions, projects/memberships/invitations, tasks/dependencies/resources/assignments/calendars, baselines/snapshots, templates, changes, and AI proposals. Use foreign keys, schema migrations, WAL, bound SQL, and transactions.
- [ ] Implement preview/apply endpoints and optimistic revision updates inside the transaction. Persist reverse commands with preconditions; stale undo/redo fails with reviewable conflicts.
- [ ] Test apply/undo/redo, conflicting later edits, restart persistence, and project isolation using two users and projects.
- [ ] Run server/domain suites and commit the persistence layer. Put local databases in an ignored data directory.

## Task 4: Authentication and project sharing

**Files:** Create `server/auth.ts`, `server/members.ts`, `client/components/Auth.tsx`, `ShareDialog.tsx`, auth/membership tests.

**Interfaces:** `authorize(userId: string, projectId: string, action: ProjectAction): Role`; signed-in sessions use opaque random IDs stored hashed, HttpOnly SameSite cookies, origin checks for mutations, expiry, and scrypt password hashes. Invitation tokens are random, stored hashed, bound to email/project/role, and expire after exactly seven days.

- [ ] Write failing tests for owner/editor/viewer access on every project route, unrelated-user reads, expired/revoked invitations, wrong-account acceptance, role escalation, and owner-only access management.
- [ ] Implement registration/login/logout/session and invitation create/revoke/accept. Rate-limit authentication. Keep the last owner invariant on transfer/deletion operations.
- [ ] Implement share dialog with role controls and copyable invitation links. State clearly that delivery was not sent when email is not configured; SMTP delivery is optional and must not block copy-link sharing.
- [ ] Verify invitation acceptance in a separate signed-in session; test direct API bypass attempts, not only disabled buttons.
- [ ] Run auth/server tests and commit. Document prototype account limitations and HTTPS requirements for hosted use.

## Task 5: Interactive planning workspace

**Files:** Create React/Vite entrypoints, `client/api.ts`, `client/state.ts`, ProjectShell, TaskGrid, Gantt, TaskInspector, ProjectSettings, styles, and browser tests.

**Interfaces:** UI edits generate Command[] and call preview/apply with the loaded revision; no component writes raw documents. Shared draft state retains unsaved commands on failure/conflict. Gantt pointer previews call `previewCommands`; only explicit commit sends mutations.

- [ ] Write failing browser tests for blank/template project creation, inline editing, indent/outdent/reorder, dependency editing, synchronized Gantt dates, and persistence after reload.
- [ ] Build a polished desktop workspace with restrained navigation, toolbar, synchronized virtualized grid/timeline, contextual inspector, status bar, and optional AI side panel. Use consistent type/spacing/color tokens, local assets, and Lucide icons.
- [ ] Implement pointer move/resize and dependency handles with affected-task previews, Escape/pointer-cancel rollback, invalid-action messages, and keyboard/inspector alternatives. Test each path against authoritative saved dates.
- [ ] Add split resizing, column selection, phase collapse, filtering, timeline zoom, status/owner/risk color modes with legends, and accessible focus/selection behavior.
- [ ] Implement calendar/timezone/currency/status-date settings and project navigation. Preserve resource duration rules and show dependency violations for manual tasks.
- [ ] Run browser tests including canceled drags, failed saves, revision conflicts, and narrow-screen editing; run typecheck/build and commit.

## Task 6: Tracking, resources, templates, and history UI

**Files:** Create ResourceView, HealthView, Templates, HistoryPanel; extend Gantt/TaskInspector; add browser tests.

**Interfaces:** Views consume `calculateMetrics` and server data; baseline selector controls display only, not snapshot mutation. User templates persist through an authorized API.

- [ ] Write failing browser tests for resource creation/assignment, overload detection/resolution, actual work/cost, completion, baseline capture/selection/overlay, and added/removed tasks.
- [ ] Implement daily/weekly workload views with task drill-down, planned/actual cost distinctions, and rate-impact previews.
- [ ] Implement baseline comparisons and health summaries with critical tasks, overdue work, milestone shifts, and labeled variance. Add explicit actual-date and remaining-work controls.
- [ ] Implement previewable starter/user templates and save-as-template with privacy exclusions. Implement history entries and validated undo/redo with conflict review.
- [ ] Run browser/domain/API suites and commit the tracking and template workflow.

## Task 7: AI analysis and validated editing

**Files:** Create AI provider/service modules, AI routes, AIPanel, proposal preview components, `tests/server/ai.test.ts`, AI browser tests.

**Interfaces:** `AIProvider.respond(input: AuthorizedProjectContext, request: string, signal: AbortSignal): Promise<AIResponse>`; AIResponse is a Zod-discriminated analysis/clarification/proposal object. Proposals contain allowlisted Command[] and assumptions. Store proposals with project revision, requesting user, status, and unique apply ID. The server recalculates every claimed schedule impact.

- [ ] Write failing tests with an injected fake provider for plan/template generation, analysis, valid edits, infeasible dates, malformed commands, unauthorized writes, hidden project IDs, baseline side effects, and prompt injection embedded in task text.
- [ ] Implement server-only HTTPS provider calls with `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, configurable 60-second timeout, bounded context, schema validation, cancellation, and no raw provider errors or credentials in responses/logs. No key means an honest unavailable state.
- [ ] Implement asynchronous request status and revision-bound preview generation. Disallow AI membership changes and actual-progress fabrication; baseline commands require explicit user intent. Treat project descriptions as untrusted data.
- [ ] Implement AI panel with selected-task/project context, analysis source references, assumptions, before/after field diff, calculated finish/workload/cost effects, Apply/Cancel, and history-linked undo.
- [ ] Test timeouts, cancellation, stale proposal apply, duplicate apply, provider failures, and manual editing while AI is unavailable. Run fake-provider browser flow and separately attempt live-provider smoke only when securely configured.
- [ ] Run suites/typecheck/build and commit; document live-provider verification status truthfully.

## Task 8: Integrated verification and reproducible development

**Files:** Create `README.md`, `.env.example`, `docs/validation.md`, performance fixture/test, accessibility/browser test configuration, and setup scripts.

**Interfaces:** `npm run dev` starts API/client; `npm run build` generates production assets; `npm start` serves the built app/API; `npm test`, `npm run test:e2e`, and `npm run typecheck` are reproducible checks. Configuration examples contain names and non-secret defaults only.

- [ ] Run acceptance scenarios A1–A12 using current-run test results. Check failed requests never erase drafts; verify permission checks and AI apply through the API as well as UI.
- [ ] Generate 1,000 leaf tasks, 1,500 acyclic dependencies, and 100 resources. Measure 30 representative edits under Chrome four-times CPU throttling; report machine, p95 feedback, and p95 recalculation against 100 ms/one-second targets.
- [ ] Run Chromium browser tests and available WebKit/Edge coverage; distinguish browser-engine checks from actual Safari/Edge validation. Test keyboard alternatives, contrast, screen-reader labels, reduced motion, and responsive editing. Record unverified coverage explicitly.
- [ ] Inspect rendered screenshots and refine spacing, typography, task movement feedback, colors, and empty/error/loading states without weakening behavior tests.
- [ ] Test frozen installation and production startup with functional requests. Document database backup/restore commands, test restoring a temporary database, and keep production launch outside scope.
- [ ] Save necessary tested environment install/start instructions through the available environment configuration tool, preserving unrelated settings. Do not expose localhost previews in onboarding UI.
- [ ] Run final domain/API/browser suites, typecheck, build, and Git whitespace/status checks. Commit completed work and publish a concise A1–A13 evidence matrix, remaining blockers, and reproducible startup instructions.

## External services and costs

Local development uses SQLite and copy-link invitations, so no paid database or email service is required. Hosting and live model usage may incur provider costs; no paid resources are provisioned by this plan. Inspect existing bindings before requesting credentials, and never put secret values in chat, tracked files, or client bundles. If live AI access is missing, finish all independent implementation and validation, then report exactly which live checks remain blocked.

## Plan self-review

All included requirements map to Tasks 1–8; deferred desktop, live coediting, integrations, portfolios, leveling, and enterprise features remain deferred. Review Focus conditions have explicit owning tests. All mutation paths share Command, ChangePreview, revision, and permission contracts. Production launch and confirmed WCAG/cross-browser/performance acceptance require their own evidence and are not inferred from a passing build.
