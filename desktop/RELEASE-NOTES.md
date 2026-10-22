Mac desktop development builds with local SQLite planning, resources, baselines, templates, undo/history, database backup and provider settings.

Download arm64 for an Apple silicon Mac or x64 for an Intel Mac. Requires macOS 13+. Unzip and move Open Project.app into Applications.

These builds use ad-hoc signing, without Apple Developer ID signing or notarization. If macOS blocks launch, use the app-specific Open Anyway control only if you trust the build. Do not disable Gatekeeper globally.

The workflow builds and checks signatures on macOS; this does not establish complete end-user runtime or Keychain validation. AI requires your own compatible provider key. Remote sharing requires a hosted workspace. See desktop/README.md for data location, backups and remaining limits.
