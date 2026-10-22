# Open Project Mac desktop

The user selected a native Mac visual direction: light sidebar, compact toolbar, calm canvas and polished Gantt. They want a usable Mac application rather than another browser preview. Keep the existing scheduling, resources, templates, progress, baselines and history contracts.

Package the actual Express/SQLite backend in an Electron desktop application with a sandboxed renderer. Bind the backend to an ephemeral loopback port. Gate every request using a per-launch secret header injected only into same-origin requests from the application window. Keep database, encrypted provider settings and persistent browser session under Application Support/Open Project. Bundle Node through Electron; users install no development tools. Use native menu items for preferences, database backup and quit, plus a conventional Mac title bar.

AI preferences use Electron safeStorage (macOS Keychain-backed encryption) and never return the key to the renderer. Apply configuration to subsequent AI requests without restarting. Do not silently store a credential with a plaintext encryption backend. Backups use SQLite VACUUM INTO with an integrity check and explicit save dialog. Closing and reopening preserves projects and sessions.

UI: system Mac typography, light gray navigation, white project canvas, one blue accent and semantic task colors. Reduce branding, summary decoration and duplicated breadcrumbs. Preserve functional labels, keyboard navigation and planner interactions. Desktop must explain that sharing requires a hosted workspace; do not issue unusable loopback invitations.

Build macOS arm64 and x64 application bundles and ZIPs where supported. This Linux environment cannot validate actual Mac launch, Keychain integration, signing, notarization or Gatekeeper behavior. Label any unsigned build accurately. Do not claim complete MS Project parity, live AI verification, remote collaboration, or Mac runtime tests that were not performed.
