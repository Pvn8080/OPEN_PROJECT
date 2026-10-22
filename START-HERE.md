# Open Project — local environment handoff

This ZIP contains the complete application source, dependency lockfile, browser preview, Mac builder, tests, design documents, and installed design skills. Dependencies and generated application bundles are rebuilt in the new environment. Credentials, workspace databases and test data are not included.

## Continue in another environment

Extract the ZIP and open the extracted folder as the project. For Mac building and launch diagnosis, use a **local environment on the user's M4 Pro Mac**, rather than a Linux cloud environment.

Paste this prompt into the new session:

> Continue Open Project from this folder. Read START-HERE.md and docs/prompt-loop.md. Build, test and launch the Mac app locally on this M4 Pro, diagnose any launch failure, and install the working app with my authorization. Preserve existing workspace data. Use Build Open Project.command as the starting point. Keep the light Apple-style planner and existing project features. Do not set up GitHub hosting. Do not claim the Mac launch is fixed until it actually works on this Mac.

## Current implementation

- React planner with task grid and Gantt editing, dependencies, resources, completion tracking, named baselines, reusable templates, history and Undo.
- Express/SQLite backend with revision checks, accounts, memberships, invitations and AI proposal/apply flows.
- Electron Mac app with a bundled local backend, light Apple-style UI, native menus, settings and workspace backup.
- AI needs the user's own provider key. The local Mac app does not provide remote team sharing without a hosted backend.
- The user requested an ongoing prompt loop: interpret each prompt, preserve earlier requirements, implement the change, verify the affected flow, and let the user try it again.

## What is verified and unresolved

The most recent Linux checks passed all 49 domain/API tests, TypeScript checking, and the desktop build. An arm64 Mac bundle was cross-built and its 14 Mach-O code-page hashes were verified. These checks do **not** prove launch success on the user's Mac.

Earlier arm64 and Intel GitHub Mac runner tests passed, but the downloaded app repeatedly failed on the user's M4 Pro with “Open Project cannot be opened because of a problem.” The cause remains unresolved. The user does not have the crash report. Do not ask them to repeat architecture checks; M4 Pro correctly uses arm64.

The updated local builder creates and extracts a ZIP, verifies signatures and runs the launch/persistence check on the extracted app before opening the original app. It can bootstrap a private checksum-verified native Node runtime. The updated builder's full Mac execution remains unverified; its syntax and non-Mac rejection were checked on Linux.

The latest smoke check explicitly requires a packaged app and sandbox enabled. Playwright's automatic `--no-sandbox` default applies to Linux, not macOS; do not misidentify that as the earlier Mac failure's cause.

## Run on an Apple silicon Mac

From a terminal in the extracted folder:

```bash
bash "Build Open Project.command"
```

This downloads build dependencies, runs tests, builds the app, checks the extracted archive, then opens the app. The output app is `mac-release/Open Project-darwin-arm64/Open Project.app`. No Apple Developer ID or notarization is configured.

Existing desktop data is in `~/Library/Application Support/Open Project`. Preserve it. The builder leaves this directory in place; the automated launch check uses temporary data.

## Browser use

Open `portable/Open-Project.html` directly in a browser for local planning, or use Node 24+ to run the full server:

```bash
npm ci
npm run dev
```

The full web development UI is at `http://localhost:5173`; the API is on port 3001. Live AI needs a server-side provider credential. The single-file preview stores projects in browser storage and has no live AI, accounts or team sharing.

## Environment requirements

Internet access is needed to fetch npm packages, the official Electron runtime, and optionally the official Node runtime. No app hosting or website deployment is required. This archive deliberately has no browser-hosting workflow.
