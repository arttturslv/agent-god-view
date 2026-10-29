# Project Decisions

- **Name**: `agent-god-view` (check availability on npm and reserve early).
- **Event Channel**: NDJSON spool at `%APPDATA%/agent-god-view/spool/<projectId>.ndjson`, where `projectId` is the hash of the project's absolute path. One JSON line per event.
- **Shell**: Tauri v2, with a main window and a second window for PiP (borderless, always-on-top).
- **Monorepo**: pnpm workspaces. TypeScript everywhere; Rust only in the Tauri shell.
- **Distribution**: main package + platform package in `optionalDependencies`, starting with `win32-x64` only. Fallback: download the `.exe` on first run, verifying SHA-256. No `postinstall` as the main path.
- **Workflow Order**: first read the `.opencode/` folder (without plugin), then a recorder-only plugin, then live mode.
- **OpenCode Plugins**: located in `.opencode/plugins/` (plural, according to current documentation).
