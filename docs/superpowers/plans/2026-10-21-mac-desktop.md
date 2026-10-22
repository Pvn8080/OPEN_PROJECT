# Mac Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver downloadable Mac application bundles with the real planner backend and the selected native Mac visual direction.
**Architecture:** A bundled Electron main process owns an authenticated loopback Express service, SQLite and encrypted settings. A narrow preload bridge exposes preferences and backup operations. Existing React workflows retain their domain/API contracts.
**Tech Stack:** Electron, Electron Packager, esbuild, React, Express, SQLite.
**Spec:** docs/superpowers/specs/2026-10-21-mac-desktop-design.md

## Global Constraints
- Sandboxed renderer, context isolation, no renderer Node integration.
- Backend listens only on loopback and rejects requests without the launch secret.
- Credentials use safeStorage; no plaintext fallback or renderer key retrieval.
- Native Mac visual direction; existing planner workflows remain available.
- Unsigned cross-builds must not be described as Mac-tested or notarized.

## Review Focus
- Port discovery must not expose data to a browser or another local application.
- Preference validation must reject insecure URLs and preserve keys on blank edits.
- User data and browser sessions survive relaunch and executable relocation.
- Quitting must close the server/database; backup must remain consistent.
- Local invitations must not be represented as usable remote collaboration.

### Task 1: Desktop backend and settings
Files: desktop/service.ts, desktop/settings.ts, desktop/main.ts, desktop/preload.ts, tests/server/desktop.test.ts.
- [x] Add failing tests for authenticated service access, local persistent sessions, preference validation and credential preservation.
- [x] Implement loopback service, safe settings and desktop lifecycle/menu/IPC.
- [x] Run targeted tests and typecheck.

### Task 2: Mac interface and preferences
Files: client/mac-theme.css, client/desktop.ts, client/components/DesktopSettings.tsx, client/App.tsx, client/main.tsx.
- [x] Apply selected light native visual system and compact project chrome.
- [x] Add desktop settings entry, truthful local status and hosted-sharing explanation.
- [x] Verify planner interactions and automated contrast checks; inspect captures.

### Task 3: Packages and validation
Files: scripts/build-desktop.ts, scripts/package-desktop.ts, desktop/README.md, package.json.
- [x] Bundle main/preload/backend and client; package arm64/x64 Mac .app bundles.
- [x] Verify packaged structure, runtime version, bundle architectures and no workspace data/keys in payloads.
- [x] Run full unit/API tests and production build; attempt desktop runtime smoke where supported.
- [x] Create ZIP artifacts with accurate install/limitations notes; commit source and documentation.

Actual evidence and remaining Mac-specific checks are recorded in desktop/README.md and docs/validation.md. The runtime smoke used Linux Electron, not macOS.
