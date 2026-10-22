# Open Project for Mac — development build 0.2.0

Requires macOS 13 or later. Choose **arm64** for an Apple silicon (M-series) Mac or **x64** for an Intel Mac. The application bundles its runtime, client, Express backend and SQLite support. No Node.js or Terminal installation is needed to use the app.

## Install

1. Unzip the matching download.
2. Drag **Open Project.app** to Applications and open it.
3. This is an ad-hoc-signed development build, without Apple Developer ID signing or notarization. macOS may block first launch. If you choose to trust this build, use the app-specific **Open Anyway** option in System Settings → Privacy & Security. Do not disable Gatekeeper globally.

The sample planner opens automatically. Click task names to edit, drag Gantt bars to reschedule, and drag their right edges to change duration. Resources, assignments, progress, named baselines, templates, Undo and history use the real local backend.

## Data and AI

Projects are saved in `~/Library/Application Support/Open Project/open-project.sqlite`. Moving/updating the app keeps that data. Browser-preview data is separate and is not automatically imported.

Use File → Back Up Workspace to save an integrity-checked SQLite copy outside application data. Quit the app before restoring; preserve existing database/WAL/SHM files before replacing them with a verified backup.

Open Project → Settings (Command-comma) configures an HTTPS OpenAI-compatible provider, model and your own API key. Keys are encrypted with Electron safeStorage (macOS credential storage); plaintext fallback is refused. AI needs Internet access and a valid provider account. No live provider was tested. Remote team sharing requires a hosted workspace; this local app does not create unusable loopback invitations.

## Evidence and limits

49 domain/API tests and 15 relevant Chromium planner/interaction/accessibility scenarios passed. An actual Linux Electron 45 runtime opened the bundled planner, saved a task, saved settings through the sandboxed IPC bridge, backed up the database through a stubbed native save dialog, and retained the task/settings after relaunch. A regression smoke confirmed that canceling Quit with a retained failed-save draft keeps the backend available.

Both Mac bundles were cross-built on Linux. Executable architectures, macOS 13 minimum and custom icons were inspected. Ad-hoc signing used rcodesign 0.29.0, downloaded with a verified hash; independent code-page hash checks passed for all 14 Mach-O files per app. The general rcodesign verifier reports an empty-CMS error on ad-hoc signatures. This does not replace macOS codesign/Gatekeeper validation.

Actual Mac launch, native title bar behavior, Keychain access and notarization were **not verified**. Treat these as development builds, not a fully validated production release.

The user-requested apple-design skill was installed from https://github.com/emilkowalski/skills and applied to the light sidebar, system typography, compact toolbar, clear feedback and accessibility preferences. Precise schedule editing remains previewed; no inertial rescheduling was added.

## Rebuild

```bash
npm ci
npm run build:desktop
npm run package:mac:arm64
npm run package:mac:x64
```

The packaging script requests ad-hoc signing on macOS. On Linux, set `OP_RCODESIGN_PATH` to a trusted rcodesign binary to sign cross-built apps. `ELECTRON_CACHE` selects the runtime cache. Production distribution requires Apple Developer signing, notarization and testing on a Mac.
