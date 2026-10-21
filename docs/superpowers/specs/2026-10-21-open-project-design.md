# Open Project — Product Requirements

Date: October 21, 2026

Status: Draft for product review

Product: Open Project

## 1. Purpose

Open Project is an AI-powered project planner for small teams that need professional scheduling tools in a clean, intuitive interface. Users should be able to build and adjust detailed plans, manage resources, track delivery against baselines, and ask an AI analyst to explain project health or make requested changes.

The first product is a web prototype. Mac and Windows applications are the intended destination; desktop packaging is a later phase. Microsoft Project import, export, and file compatibility are out of scope.

The product should feel approachable without reducing the precision experienced project managers need. Advanced controls should be available in contextual panels rather than crowding the default workspace.

## 2. Agreed direction and proposed defaults

The user requested professional task planning, resources, percentage completion, baselines, fluid task movement, strong color coding, useful templates, powerful AI analysis and editing, and project sharing.

This document proposes the following defaults for review: a shared web workspace; owner, editor, and viewer roles; previewing AI changes before application; revision-based conflict detection rather than simultaneous live editing; and a phased implementation. These are concrete product decisions in this draft, rather than claims that a finished application already exists.

## 3. Users and outcomes

| User | Main needs |
| --- | --- |
| Project owner or manager | Create a credible schedule, assign resources, track variance, and control changes. |
| Team member | Understand assigned work, update progress, and see how changes affect delivery. |
| Stakeholder or viewer | Review milestones, completion, and risks without editing the plan. |

Success means a user can create a project from a template or AI prompt, refine its schedule visually, identify resource conflicts, save a baseline, update progress, and share the resulting plan. The AI must produce actionable explanations grounded in the current project and perform requested edits accurately.

## 4. First-build scope

The first build must demonstrate a complete planning and tracking workflow with persisted data and real calculations. A static mockup or canned AI response does not satisfy functional requirements.

Included: projects, task hierarchy, editable task grid, interactive Gantt chart, dependency scheduling, milestones, project working calendar, critical path, resource assignments and capacity, basic costs, progress updates, multiple saved baselines, variance reporting, templates, AI analysis and approved edits, project invitations, permissions, and change history.

Later scope: desktop packaging, offline editing and synchronization, simultaneous live editing, portfolio management, advanced accounting, earned-value management, timesheets, external integrations, and enterprise administration. Automatic resource leveling and advanced scheduling constraints are also later scope; the first build detects conflicts and supports manual or AI-proposed resolution.

This is a defined professional planning foundation. It does not promise every Microsoft Project feature in the first build.

## 5. Main workspace and interaction design

- A restrained navigation area gives access to projects, templates, and resources.
- The main planning view pairs an editable task grid with a synchronized Gantt timeline. Users can resize either side, choose visible columns, collapse task groups, filter, and zoom the timeline.
- A contextual inspector holds task, dependency, resource, cost, and baseline details.
- An AI panel remains available beside the plan and can reference selected tasks or the entire project.
- Alternate views provide a resource workload view and a project health summary using the same underlying data.

Users can add and edit tasks inline, drag tasks to reschedule, resize bars to change duration, reorder rows, and indent or outdent tasks. Dependency handles support linking tasks visually. Reordering a row changes its display position; rescheduling a bar changes dates. The interface must make these distinct actions clear.

Dragging shows a preview of affected dates and dependent tasks before saving. Invalid moves explain the problem and preserve the existing schedule. Keyboard and inspector controls provide alternatives to dragging. Undo and redo are visible and accessible.

Color coding supports status, owner, or risk modes. A legend identifies the active mode. Baseline bars and current bars must be visually distinct. Text labels, icons, and patterns supplement color so color is never the only indication of meaning. Focus states, readable contrast, reduced-motion support, and keyboard navigation are required. The planning workspace targets desktop browsers; narrower screens must retain task viewing and editing through a simplified layout.

## 6. Project and task requirements

### 6.1 Project setup

A project has a name, description, owner, start date, timezone, currency, working calendar, members, and status date. The default calendar is Monday through Friday, eight working hours per day, with editable working days, hours, and date exceptions. Each project uses one currency in the first build; currency conversion is excluded.

Users can start from a blank project, a template, or an AI-generated draft. Saving a project and reopening it must preserve its plan and tracking data.

### 6.2 Task model

Tasks support a stable identifier, title, description, parent task, display order, duration, scheduled start and finish, dependency links, resource assignments, percentage complete, actual start and finish, actual work, remaining work, priority, and status. Milestones have zero duration. Summary tasks roll up their children rather than accepting independent schedule and progress values.

Deleting a task must show the affected assignments, dependencies, and child tasks before confirmation. Task identifiers remain stable when rows move or titles change.

### 6.3 Scheduling rules

- Support finish-to-start, start-to-start, finish-to-finish, and start-to-finish dependency types, with positive or negative lag measured in working hours.
- Calculate dates using the project calendar; show dates in the project timezone.
- Offer automatic scheduling and manually scheduled tasks. Automatic tasks recalculate from dependencies and the project start. Manual tasks retain their dates and display violations when dependencies cannot be met.
- Use fixed-duration scheduling in the first build. Changing resource allocations must not silently change task duration. Other effort-driven scheduling modes are later scope.
- Prevent dependency cycles and self-links with a useful explanation. The first build links leaf tasks and milestones; links to summary tasks are excluded.
- Recalculate downstream automatic tasks after schedule edits and expose which dates changed.
- Calculate total float and highlight the critical path from the dependency network and project finish. Resource conflicts are a separate signal and must not be represented as resolved by critical-path calculation.
- Derive summary start and finish from children. Exclude summary rows from effort and cost totals to avoid double counting.

The scheduling engine, rather than the AI model, is authoritative for date calculations and validation.

## 7. Resource and cost planning

Resources support people and equipment, a name, category or role, available capacity, hourly rate, and active status. Resources do not need user accounts; an external person or piece of equipment can be planned without an invitation.

Assignments connect resources to tasks with an allocation percentage. Planned work equals task working duration multiplied by allocation, summed across assignments. Planned labor or equipment cost equals assignment work multiplied by its rate, plus any task fixed cost. The first build uses the project calendar and per-resource capacity; individual resource calendars are later scope.

The workload view shows scheduled demand against capacity by day or week, identifies overlapping assignments, and links conflicts back to their tasks. Moving or resizing work recalculates demand. Rate changes show their cost impact before saving; baselines retain their captured costs.

Actual work is entered explicitly per assignment, and actual cost uses that work and its recorded rate plus recorded fixed costs. Percentage complete alone must not be presented as actual cost or earned value. Missing actuals are labeled as incomplete information.

## 8. Progress, baselines, and analysis

Users can enter task percentage complete from 0 to 100, actual dates, actual work, and remaining work. Marking a task complete requires an actual finish date, defaulting to the project status date for review. Contradictory actual dates are rejected.

Summary completion is weighted by child planned working duration. Zero-duration milestones are excluded from that weighted value; a summary containing only milestones uses the proportion completed. The interface labels this metric as schedule completion, distinct from work consumed.

Users can save multiple named baselines capturing task identifiers, hierarchy, scheduled dates, duration, work, assignments, rates, and planned costs. Baselines are immutable snapshots. A user can create a new baseline and select one for comparison; the AI must not overwrite or delete one as a side effect of another request.

Baseline comparisons include a Gantt overlay and start, finish, duration, work, and cost variances. Positive finish variance means later than baseline and is measured in project working time. Added and removed tasks are identified explicitly rather than assigned misleading zero variance.

Project health summarizes milestone movement, overdue unfinished tasks relative to the status date, critical tasks, workload conflicts, and baseline variance. Explanations distinguish observed facts, calculated results, and AI estimates.

## 9. Templates

Provide at least four useful starter templates: product launch, software delivery, marketing campaign, and event planning. Each contains phases, tasks, dependencies, milestones, relative durations, and placeholder resource roles. Dates are recalculated from the chosen project start and calendar.

Users can preview a template before creating a project and save an existing plan as a reusable template. Templates exclude actual progress, baseline history, invitations, and private member information by default. AI can generate or refine templates from a description, with assumptions and proposed roles shown for review.

## 10. AI analyst and planning assistant

### 10.1 Supported jobs

- Generate a project draft or template from a goal, target date, scope, and available resources.
- Explain project health and reference the relevant tasks, assignments, dates, and baseline.
- Identify schedule risks, dependency bottlenecks, missing ownership, and resource overload.
- Compare scenarios such as moving a deadline, reducing capacity, or changing task duration.
- Apply requested edits: add or restructure tasks, update dates and durations, manage dependency links, assign resources, and update progress.
- Create a named baseline only when explicitly requested. Baseline deletion is not an AI action in the first build.

### 10.2 Change workflow

1. Interpret the request using the current project revision and the user's permissions.
2. Ask a focused clarification when ambiguity would materially change the outcome; otherwise state assumptions.
3. Build a structured change proposal in a separate scenario without altering the shared project.
4. Validate it through scheduling, resource, permission, and data rules.
5. Show an itemized preview with affected tasks, before/after values, delivery impact, workload changes, and unresolved constraints.
6. Apply the approved proposal atomically against the expected project revision.
7. Record the actor, request, proposal, and committed changes in history, and offer undo.

The first build always requires the user to apply a proposed mutation through the preview. This supports real AI execution while keeping the change and its consequences visible. Analysis and draft generation do not require a mutation approval.

AI cannot bypass permissions, silently invite users, change project access, fabricate actual progress, or claim that a target date is feasible when validated constraints contradict it. Project text is treated as data rather than authority to execute tools. Only allowlisted application operations can change state.

AI requests run on the server; provider credentials never reach the browser. Only project data authorized for the requesting user is included. Provider retention terms and organization-level controls require review before production use. A failed or timed-out request leaves the project unchanged and provides a retry path; ordinary manual planning remains available when AI is unavailable.

## 11. Sharing, permissions, and history

Projects support invitations to named email addresses and owner, editor, and viewer roles. Users authenticate before accessing a shared project. Invitations expire after seven days and can be revoked. If outbound email is not configured in development, the owner can copy an invitation link; delivery status must not falsely claim an email was sent.

| Operation | Owner | Editor | Viewer |
| --- | --- | --- | --- |
| View project and AI analysis | Yes | Yes | Yes |
| Edit tasks, resources, and progress | Yes | Yes | No |
| Apply AI edits and create templates or baselines | Yes | Yes | No |
| Invite members or change roles | Yes | No | No |
| Delete project or transfer ownership | Yes | No | No |

Authorization is checked on the server for every project read and mutation, including AI operations. An invitation alone does not expose project data to an unauthenticated visitor.

Saved edits appear when another member refreshes or the application checks for a newer revision. If two users edit the same revision, the second save detects the conflict, preserves the unsaved proposal, and offers reload and review instead of overwriting newer work.

History records who changed what and when, including AI-assisted actions. Undo creates a validated reverse change; it never resets the project over intervening edits. If reversal conflicts with later work, show the conflict and require review. Redo is supported when its changes remain valid.

## 12. Architecture requirements

The web client owns presentation and interaction previews. A server API owns authenticated access, persistence, project revisions, atomic mutations, and AI orchestration. A relational database stores projects and related records.

The scheduling and resource calculation engine must be independently testable and deterministic, with a defined input/output contract. The server reruns authoritative validation before every committed edit. Client previews may reuse the same calculation library but cannot override server results.

AI produces structured proposals using the same command interface as manual edits. It does not write directly to the database. Templates instantiate through that interface as well. Background AI operations track status and cancellation; duplicate application requests must not apply the same proposal twice.

Primary entities: user, project, membership, invitation, calendar, task, dependency, resource, assignment, baseline, baseline task snapshot, template, change set, and AI proposal. Projects and proposals include revision identifiers. Historical snapshots preserve values even when current entities change.

Keep scheduling and command contracts independent of browser UI so they can support later Mac and Windows clients. Desktop framework selection is deferred until packaging and offline requirements are defined.

## 13. Quality and operational requirements

- No silent data loss: display saving, saved, failed, and conflicting states clearly.
- Use virtualized task rows and limit timeline rendering to the visible range.
- Performance acceptance fixture: 1,000 leaf tasks, 1,500 acyclic dependencies, and 100 resources. In a current desktop Chrome browser under four-times CPU throttling, local input feedback should appear within 100 ms and schedule recalculation within one second at the 95th percentile across 30 representative edits. Record the machine and fixture with results.
- Long AI operations show progress and can be canceled. The service uses a configurable timeout, initially 60 seconds, with no partial project mutation on timeout.
- Cover core flows in current Chrome, Safari, and Edge. Meet WCAG 2.2 AA for the primary planning workflows, including non-drag alternatives.
- Keep credentials out of logs and clients. Enforce project isolation, validate input, and record actionable server errors without exposing private project content unnecessarily.
- Configure database backups before any production launch and verify restoration. Production deployment, payment plans, and commercial operations are outside this prototype build.

## 14. Acceptance scenarios

| ID | Scenario and expected result |
| --- | --- |
| A1 | Create a project from each starter template. Relative dates respect the selected calendar, dependencies are valid, and no sample actual progress is copied. |
| A2 | Create a task hierarchy and dependency chain. Move and resize tasks in the Gantt; the grid, dependent dates, summaries, and critical path update consistently. Keyboard or inspector edits produce the same result. |
| A3 | Add a weekend exception and a holiday. Dates, lag calculations, duration, and baseline variance use working time consistently. |
| A4 | Attempt a dependency cycle or an invalid actual date. The edit is rejected with an explanation and existing data remains intact. |
| A5 | Assign one resource above capacity across overlapping tasks. The workload conflict appears; moving an assignment resolves it without silently changing durations. |
| A6 | Save a baseline, delay work, and change a rate. The baseline remains unchanged, current variance is correct, and added or removed tasks are distinguished. |
| A7 | Update completion and actual work, save, and reopen. Values persist, summaries calculate correctly, and actual costs are not inferred from completion percentage. |
| A8 | Ask AI to generate a plan and then bring a milestone forward. Inspect the structured preview and calculated impacts, apply it, and verify actual persisted changes. An infeasible request explains its constraints. |
| A9 | Undo an AI change. With no conflicting later work, original values return through a new history entry. With a conflicting edit, undo requests review rather than overwriting it. |
| A10 | Invite an editor and viewer. The editor can save changes; the viewer cannot mutate through either the UI, API, or AI. An unrelated user cannot access the project. |
| A11 | Submit edits from two sessions using the same revision. The second edit reports a conflict and preserves its proposal for review. |
| A12 | Disable or time out the AI provider. Manual editing remains usable, no partial changes persist, and the failed AI action has an honest retry state. |
| A13 | Exercise the representative large-project fixture. Record responsiveness and calculation measurements against the stated targets. |

## 15. Validation strategy

Use deterministic unit tests for scheduling, calendar exceptions, all dependency types, lag, critical path, progress rollups, resource demand, cost formulas, and baseline comparison. Include invariant tests for cycle prevention and summary double counting.

Use integration tests for persistence, atomic changes, project isolation, invitation acceptance, revision conflicts, AI proposal validation, duplicate apply requests, and undo conflicts. Use a fake AI provider for repeatable failure and mutation tests, plus a separately reported live-provider smoke test when credentials are configured. Fake-provider success must not be described as verified live AI capability.

Use browser tests for template creation, Gantt editing, baseline comparison, resource conflicts, sharing, and AI preview/apply/undo. Check keyboard operation and contrast, then manually inspect drag feedback, visual hierarchy, and reduced-motion behavior. Desktop packaging is not validated by these web checks.

## 16. Delivery sequence

1. Planning foundation: project persistence, calendar, task hierarchy, scheduling engine, task grid, and interactive Gantt.
2. Professional tracking: resources, costs, progress, critical path display, baselines, variance, and starter templates.
3. Team workflow: authentication, invitations, permissions, revision conflicts, and change history with undo/redo.
4. AI workflow: plan and template generation, grounded analysis, scenario previews, validated edits, and safe application.
5. Integrated prototype validation: complete acceptance scenarios, UI polish, accessibility, and representative performance checks.

These are implementation slices of one coherent product, not separate approvals to omit agreed requirements. The integrated prototype is complete only when the included requirements pass or documented limitations are explicitly accepted.

## 17. Dependencies and decisions for implementation planning

A hosted prototype needs database storage, an authentication and invitation mechanism, an AI provider binding, and a deployment destination. These do not block requirements review. Implementation planning should select concrete tools, document their licenses and operating costs, and identify required secure configuration before live-service validation.

The next step after review is an implementation plan with concrete modules, migrations, dependencies, tests, and work order. No product implementation or live service configuration is implied by this requirements document.
