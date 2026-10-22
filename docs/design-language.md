# Open Project design language

The planning surface is the main product. The redesign retains the existing workflows and scheduling engine while improving information density, hierarchy and readability.

## Research and references

- [UI Skills baseline-ui](https://github.com/ibelick/ui-skills/blob/main/skills/baseline-ui/SKILL.md): restrained accents, no decorative gradients, tabular figures, existing accessible primitives and explicit actions. Installed a local copy in `.agents/skills/baseline-ui`. Existing CSS and native dialogs are retained; this is not a Tailwind migration.
- [Frontend design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md): intentional typography, subject-specific hierarchy, meaningful structural borders and plain product copy. Installed in `.agents/skills/frontend-design` with its source license.
- [Microsoft Fluent UI](https://github.com/microsoft/fluentui): desktop productivity reference for control hierarchy, semantic tokens and familiar navigation. Referenced the official repository and published token package; the application does not install or claim to use Fluent components.
- [IBM Carbon](https://github.com/carbon-design-system/carbon): enterprise data-interface reference for structured tables, alignment and separation of navigation from content. The official repository was accessible; the documentation website was blocked by this environment's network policy. No claim of Carbon conformance.

The UI Skills website, Fluent design website and Carbon website returned network-policy errors. Public source repositories and the npm registry were accessible. Research was based on the retrieved materials, rather than unverified website contents.

## System

| Role | Decision |
| --- | --- |
| Navigation | Navy `#172b4d`, visibly selected project and view, stable 224 px desktop rail. |
| Canvas | White `#ffffff`, subtle surface `#f5f7fa`, structural border `#dce2e9`. |
| Action | Blue `#185abd`; the same treatment for primary actions throughout the app. |
| Text | Ink `#172b4d`, secondary `#42526e`, muted `#63748b`. |
| Type | Segoe UI with system fallbacks. Tabular figures for durations, costs, dates and completion. 12–13 px working text, 25 px project title. |
| Density | Compact 46 px app header, concise project summary, aligned grid and timeline rows. |
| Task status | Green complete, blue in progress, slate not started. Text labels, completion percentages and icons complement color. Risk mode uses red for critical tasks. |
| Surfaces | 4 px control/panel corners; 8 px modal corners. Borders separate data; elevation is reserved for dialogs. |
| AI | Contextual analysis panel with specific planning actions and a clear review-before-apply explanation. |

The old lavender neutrals were replaced throughout existing modal, resource, template and narrow-screen styles. `client/design-system.css` defines the new semantic tokens and consistent component treatments over the existing layout rules. No font CDN, animation library or UI framework dependency was added.

## Verification

Visual captures include the full planner and the planner with the AI analyst open. Automated browser checks cover keyboard/pointer interactions, task editing, resources, baselines, conflicts, sharing and targeted accessibility. See `docs/validation.md` for actual results and remaining limitations.

## Native Mac direction

The user selected a light native Mac direction and requested the [apple-design skill](../.agents/skills/apple-design/SKILL.md) from emilkowalski/skills. Installation succeeded using the requested CLI. `client/mac-theme.css` applies light navigation, platform system typography, compact controls, restrained structure, responsive feedback and accessibility preferences. [Current browser-rendered design](evidence/mac-design.png) is not a Mac runtime capture.
