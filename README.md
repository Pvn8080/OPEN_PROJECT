# Open Project

A shared project planner with a synchronized task grid and Gantt timeline, resource capacity, progress, baselines, reusable templates, and an AI analyst that proposes validated changes.

This is a prototype with web and experimental Mac desktop builds. Microsoft Project file compatibility and Windows packaging remain outside this release.

## Mac desktop development builds

The desktop build bundles the real SQLite backend and a light Mac-style interface. See [Mac install, AI settings, backup and verification details](desktop/README.md). These are ad-hoc-signed development builds without notarization or actual Mac runtime validation.

## Try without installing anything

Open [the portable preview](portable/Open-Project.html) in a desktop browser. Save the HTML file to your computer and open it there. It contains the UI, scheduling engine and styles in one file, with no server or API key required. The sample workspace opens automatically.

Edit tasks, drag Gantt bars, manage resources, capture baselines and use Undo. Changes are saved in that browser's local storage. Use **Export backup** to save a JSON copy. Keep the HTML in the same location and use the same browser; clearing browser data or private browsing can remove saved work.

This is a local interactive prototype: account registration, AI, invitations and team sharing require the server version. It does not connect to the cloud workspace database.

Rebuild the portable file with `npm run build:portable`. Direct `file://` navigation is blocked by the managed test browser, so standalone behavior was tested by serving the exact single HTML with every other network request blocked. Actual downloaded-file behavior on users' browsers remains a manual check.

## Run locally

Requires **Node.js 24 or later** (uses built-in SQLite) and npm.

```bash
npm ci
npm run dev
```

Vite serves the client on port 5173 and proxies API requests to port 3001. Use **Explore demo workspace** to create an isolated sample project, or create an account. Demo work is saved in the local database; converting a demo account to a registered account preserves its projects.

For a production-style local run:

```bash
npm run build
npm start
```

The Node server serves both the built client and API on port 3001. Local data is stored in `data/open-project.sqlite` and its WAL files; these are ignored by Git. This is a single-instance prototype, not a production deployment recipe.

## Working with the planner

- Create a blank project or choose product launch, software delivery, marketing campaign, or event planning. Preview phases before creating the project.
- Click a task name to edit its dates, duration, progress, actuals, dependencies, and assignments. Zero-duration tasks are milestones. Summary dates and progress roll up from children.
- Drag task bars to reschedule and use the bar’s right edge to resize. Review the impact before applying. Press Escape during a drag to cancel. Keyboard alternatives: focus a bar and use Left/Right; Shift+Left/Right adjusts duration; Enter opens details.
- Use a row’s drag handle to reorder tasks. Select a row and use indent/outdent controls to change hierarchy. Hierarchy and dependency cycles are rejected.
- Use the dependency dot on a bar, then select the target bar to create a finish-to-start link. Task details support all four dependency types and signed lag.
- Customize visible columns, task-pane width, timeline zoom, phase collapse, search, and status/resource/risk colors.
- Add people or equipment in Resources, then assign them in task details. Capacity cells link back to tasks. Overloads are detected, not automatically leveled.
- Capture a named baseline to preserve the current plan. Select a baseline for comparison; Insights shows working-time and cost variance, including added/removed tasks.
- Use History or Undo/Redo to reverse changes. Reversals are validated and conservatively reject intervening edits rather than overwrite them.
- Save the project as a template using the template icon. Actuals, invitations, baselines, and resource names are excluded; resource role placeholders remain.

## Design

The planner uses a restrained productivity design system, with navy navigation, blue actions, aligned data and accessible controls. See the [design language and sources](docs/design-language.md) and [updated planner preview](docs/evidence/open-project-redesign.png).

## AI setup

For legitimate free-key options and Groq configuration, see [free AI setup](docs/free-ai-setup.md).

Manual planning works without an AI provider. Live AI requires a server-side provider credential. Copy `.env.example` to an ignored `.env` file and supply values securely; never put keys in browser configuration or Git. The start commands load `.env` automatically.

| Variable | Purpose |
| --- | --- |
| `AI_API_KEY` | Server-only API credential. |
| `AI_BASE_URL` | HTTPS OpenAI-compatible API base; default `https://api.openai.com/v1`. |
| `AI_MODEL` | Provider model; default `gpt-4.1-mini`. |
| `AI_TIMEOUT_MS` | Request timeout; default `60000`. |
| `DATABASE_PATH` | SQLite path; default `data/open-project.sqlite`. |
| `PORT` | API/build server port; default `3001`. |
| `APP_ORIGIN` | Exact hosted browser origin for mutation checks. Local Vite origins are supported in development. |

The server sends authorized project data to the configured provider. Review provider retention terms before using confidential real-world projects. Credentials stay on the server. The assistant can analyze, clarify, create plans, and propose task/resource/dependency changes. Every proposal is recalculated by the scheduling engine and must be explicitly applied. It cannot modify memberships or fabricate recorded actual progress. Missing credentials and provider failures are shown honestly; no canned output is represented as live AI.

AI-generated template workflow: create a blank project, ask the analyst to generate a template plan, review and apply its commands, then save the resulting project as a template.

## Sharing

Create an account before inviting teammates. Owners can create email-bound, seven-day invitation links for owners, editors, or viewers. No outbound email is configured: copy the link and send it yourself. Recipients must sign in using the invited email. Owners can revoke pending invitations and change roles. Access checks apply on the server, including AI actions.

Shared plans use saved revisions rather than simultaneous live coediting. A stale save preserves the draft and offers reload/review. A teammate-update notice appears when polling detects a newer revision. This prototype has no password recovery, email verification, or enterprise identity provider; do not treat it as production identity infrastructure.

## Verify

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
```

The browser configuration uses `/usr/bin/chromium` in the prepared cloud machine. To use a Playwright-managed browser elsewhere, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its executable or install Chromium and update that configuration. Domain/API tests use isolated in-memory or temporary databases. Browser tests create their own accounts/projects in the running local database and never require real AI credentials. The AI browser test injects a controlled provider behind the real API; it is not proof of live-provider access.

The performance test measures 30 recalculations and input-to-frame samples for 1,000 tasks, 1,500 dependencies, and 100 resources under four-times Chromium CPU throttling. Details and limitations are in [validation evidence](docs/validation.md).

## Architecture

- `shared/`: pure calendar, scheduling, metrics, templates, schemas, and validated commands.
- `server/`: SQLite persistence, sessions, memberships, revision-based edits/history, and AI orchestration.
- `client/`: React planner, workload/health views, sharing, templates, and AI proposal interface.
- `tests/`: domain, API, browser, accessibility, and performance checks.

The domain engine is independent of the web UI so future desktop clients can reuse its contracts. The SQLite schema uses a canonical project document with relational permissions/history and per-entity projections for atomic prototype edits.

## Backup and restore

Before a real deployment, configure scheduled backups and test recovery. The backup script uses SQLite's consistent `VACUUM INTO` snapshot; do not copy a live database while ignoring its WAL.

```bash
npm run db:backup -- /tmp/open-project-backup.sqlite
```

Stop the application before restoring. Preserve the current database and its WAL/SHM files in a separate recovery directory, then restore the validated backup to `DATABASE_PATH` and start the application. Verify account access, projects, baselines, and history before using the restored instance. Never overwrite a live database. Database backups contain project and account data and must be stored securely.

## Scope and evidence

See the [requirements](docs/superpowers/specs/2026-10-21-open-project-design.md), [implementation plan](docs/superpowers/plans/2026-10-21-open-project.md), and [validation report](docs/validation.md). Native desktop clients, offline sync, live coediting, automatic resource leveling, earned value, portfolio planning, and external integrations are deferred.
