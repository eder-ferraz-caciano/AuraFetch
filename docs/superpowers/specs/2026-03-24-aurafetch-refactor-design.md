# AuraFetch — Refactor, Bug Fix & Rename Design Spec

**Date:** 2026-03-24
**Author:** Eder Ferraz Caciano
**Status:** Approved

---

## Overview

AuraFetch is a desktop API client (Postman/Insomnia alternative) built with Tauri 2 (Rust) + React 19 + TypeScript. Currently at v1.3.1, the app has critical bugs reported by users and a monolithic architecture (`App.tsx` with 3,741 lines) that makes maintenance and evolution difficult.

This spec covers a 4-phase plan to stabilize, refactor, and rebrand the project.

---

## Goals

- Fix all critical bugs affecting users (white screen, file upload freeze, large response freeze)
- Identify and fix all latent bugs through a thorough audit
- Break the monolithic `App.tsx` into maintainable, testable components
- Rename and rebrand the project to **HTTPilot**
- Keep the app functional and deployable after each phase

---

## Non-Goals

- New features during phases 0–2
- Rewrite in another framework (staying with React)
- Changes to backend Rust/Tauri code (unless required by a bug fix)
- Breaking the pre-request script API (`aurafetch.setEnv()`, `aurafetch.setVar()`, `aurafetch.log()`) — user scripts saved in collections depend on this interface

---

## Phase 0 — Deep Audit

**Goal:** Map every bug and issue in the codebase before writing a single fix.

### What will be inspected

| Category | What to look for |
|---|---|
| Crashes / white screen | Unhandled errors reaching the render tree, insufficient Error Boundary coverage, module load failures at `main.tsx` level |
| File upload freeze | Missing file size limits, synchronous blocking reads in `tauriReadFile`, lack of streaming |
| Large response freeze | `JSON.parse` of huge payloads on the main thread, `localStorage.setItem` of the full collection after each response (double block) |
| Memory leaks | WebSocket connections not closed, accumulating event listeners, uncleaned timers |
| Inconsistent state | Dirty data between requests, environments not resetting correctly |
| Web vs desktop gaps | Tauri-only features called without browser fallback |
| Silent errors | `try/catch` blocks that swallow errors without logging |
| Performance | Unnecessary re-renders, missing memoization on expensive components |
| Script API stability | The `aurafetchCtx` / `aurafetch.setEnv()` / `aurafetch.setVar()` / `aurafetch.log()` API surface is used in saved user scripts — flag anything that could break it |
| Other latent bugs | Any suspicious behavior that hasn't crashed yet but likely will |

### Deliverable

A prioritized bug list (P0/P1/P2) presented to the user before any code changes begin.

---

## Phase 1 — Bug Fixes

**Goal:** Fix all identified bugs, highest priority first.

- Each bug gets its own commit with a clear description of what was fixed and why
- Fixes are minimal and scoped — no refactoring mixed in
- After fixes: deploy to both desktop (Tauri) and web (GitHub Pages) and verify

### Known bugs (pre-audit)

| Bug | Severity | Affected builds | Suspected failure point |
|---|---|---|---|
| White screen | P0 | Both web and desktop | Unhandled error bypassing the existing `ErrorBoundary` (likely at module load or `main.tsx` level, before the boundary is mounted) |
| File upload freeze | P0 | Both web and desktop | `tauriReadFile` reading the full file into memory synchronously before transmitting; no size limit guard |
| Large response freeze | P0 | Both web and desktop | Two compounding blocks: (1) `JSON.parse` of the full payload on the main thread, (2) `localStorage.setItem` serializing the entire collection including the large response body on every state update |

---

## Phase 2 — Componentization

**Goal:** Break `App.tsx` (3,741 lines) into focused, single-responsibility components.

### State Management Approach

The current `App.tsx` has 28 `useState` calls and no shared context. Simply extracting components with prop drilling is not viable — `CollectionTree`, `RequestBuilder`, `RequestTabs`, and `ResponseViewer` all need access to the same active request state.

**Strategy:** Introduce a single `RequestContext` (React Context) that holds the shared active-request state:
- Active request node (`activeNodeId`, `activeRequest`)
- Collection tree (`collection`)
- Global variables and environments (`globalVariables`, `activeEnv`, `environments`)
- Loading and response state (`loading`, `savedResponse`)

Each component reads from context only what it needs. Local state (e.g., which body tab is open) stays local in the component. Hooks (`useRequest`, `useCollection`, etc.) encapsulate the logic and update context via callbacks.

This is the lightest approach that works — no external state library needed.

### Target directory structure

```
src/
├── assets/
│   ├── logo.png             # HTTPilot logo
│   └── logo.svg             # HTTPilot logo (vector)
├── styles/
│   ├── global.css           # Reset, CSS variables, fonts (extracted from index.css)
│   ├── themes.css           # Dark theme, color palette, gradients
│   └── animations.css       # Transitions and keyframes
├── components/
│   ├── ErrorBoundary/       # Error boundary (currently inline in App.tsx)
│   ├── RequestBuilder/      # URL bar, HTTP method selector, send button
│   ├── RequestTabs/         # Body, Headers, Auth, Params, Scripts tabs
│   ├── ResponseViewer/      # Status, response tabs, JSON/HTML/image rendering
│   ├── CollectionTree/      # Sidebar with collections, folders, requests
│   ├── HistoryPanel/        # Request history sidebar (separate from CollectionTree)
│   ├── EnvironmentPanel/    # Environment manager and variable editor
│   ├── WebSocketPanel/      # WebSocket-specific UI
│   ├── Console/             # Logs and timestamps
│   └── CodeSnippet/         # cURL/fetch/axios code generator
├── context/
│   └── RequestContext.tsx   # Shared active-request state (React Context)
├── hooks/
│   ├── useRequest.ts        # Request sending logic
│   ├── useWebSocket.ts      # WebSocket connection logic
│   ├── useCollection.ts     # Collection/folder CRUD
│   └── useEnvironment.ts    # Environment management
├── types/
│   └── index.ts             # All TypeScript types (extracted from App.tsx)
├── utils/
│   └── safeFetch.ts         # Tauri/browser fetch wrapper (extracted from App.tsx)
├── App.tsx                  # Lightweight orchestrator (~100 lines)
└── main.tsx
```

### Approach

- Extract `types/index.ts` and `utils/safeFetch.ts` first (zero risk, no UI change)
- Extract `ErrorBoundary` next
- Set up `RequestContext` before touching any visible component
- Extract one component at a time, verifying no regressions after each
- Extract hooks alongside components to keep logic co-located
- `App.tsx` becomes a thin orchestrator that wraps context and renders layout

### Note on CodeMirror

`ResponseViewer` and `RequestTabs` both embed CodeMirror editor instances. CodeMirror setup in React requires ~20–40 lines of boilerplate per instance. The 300-line limit per component is still achievable, but keep CodeMirror config co-located with its component rather than abstracting it prematurely.

---

## Phase 3 — Rename to HTTPilot

**Goal:** Fully rebrand the project from AuraFetch to HTTPilot.

### localStorage Migration (critical — do this first in Phase 3)

The app stores user data in `localStorage` under keys prefixed with `aurafetch_`. Renaming these keys without migration will silently wipe all user workspaces on upgrade.

**Migration shim** (run once on app startup, before any data reads):

```typescript
const keyMap: Record<string, string> = {
  'aurafetch_collection_v2': 'httppilot_collection_v2',
  // 'aurafetch_workspaces' is a legacy v1.x read-only key — already migrated into
  // 'aurafetch_collection_v2' by existing startup code. Only remove it, don't write a new key.
  'aurafetch_globals': 'httppilot_globals',
  'aurafetch_collection': 'httppilot_collection',
  'aurafetch_envs': 'httppilot_envs',
  'aurafetch_env_active': 'httppilot_env_active',
};
Object.entries(keyMap).forEach(([oldKey, newKey]) => {
  const value = localStorage.getItem(oldKey);
  if (value !== null) {
    localStorage.setItem(newKey, value);
    localStorage.removeItem(oldKey);
  }
});
// Clean up the legacy key (no corresponding new write needed)
localStorage.removeItem('aurafetch_workspaces');
```

After migration, update all `localStorage.getItem/setItem` calls throughout the codebase to use the `httppilot_` prefix.

### Scripting API backward-compat note

Phase 3 renames `aurafetchCtx` to `httppilotCtx`, which changes the runtime object passed to user pre-request scripts from `aurafetch` to `httppilot`. **Existing saved user scripts call `aurafetch.setEnv(...)`, `aurafetch.setVar(...)`, and `aurafetch.log(...)` by name** — these will silently break after rename.

**Fix:** In the script runner (`fn(aurafetchCtx)` call), pass both the new and old names for one release:

```typescript
// Before (current):
fn(aurafetchCtx)

// After rename (Phase 3):
fn(httppilotCtx, httppilotCtx)  // second arg = backward-compat alias
// or more explicitly via fn signature:
// fn({ httppilot: httppilotCtx, aurafetch: httppilotCtx })
```

This ensures scripts written against `aurafetch.*` continue to work. The `aurafetch` alias can be removed in a future release after users have had time to migrate their scripts.

### Files to update

| File | What to change |
|---|---|
| `package.json` | `name: "httppilot"`, `description`, `homepage`, `repository.url`, `keywords` (remove `aurafetch`, add `httppilot`) |
| `src-tauri/tauri.conf.json` | `productName: "HTTPilot"`, `identifier: "com.httppilot.desktop"`, `app.windows[0].title: "HTTPilot"` |
| `src-tauri/Cargo.toml` | `name = "app"` → `name = "httppilot"` and `name = "app_lib"` → `name = "httppilot_lib"` (current values are `"app"` / `"app_lib"`, not `"aurafetch"`) |
| `vite.config.ts` | `base: '/AuraFetch/'` (PascalCase) → `base: '/httppilot/'` |
| `index.html` | `<title>HTTPilot</title>`, set favicon to new logo (`public/httppilot_logo.png`). Note: current favicon is `vite.svg` (default Vite asset, never branded) — `public/aurafetch_logo.png` exists but is not referenced in `index.html` |
| `src/App.tsx` | localStorage keys (see migration above), `aurafetchCtx` → `httppilotCtx`, scripting API object rename: `aurafetch.setEnv()` / `aurafetch.setVar()` / `aurafetch.log()` → `httppilot.*` (keep `aurafetch` as a backward-compat alias for one release — see note below), file-save dialog filter `'AuraFetch Workspace'` → `'HTTPilot Workspace'`, default filename `'aurafetch_workspace.json'` → `'httppilot_workspace.json'` |
| `cypress/e2e/*.cy.ts` (5 files) | `describe('AuraFetch - ...')` suite names → `describe('HTTPilot - ...')` |
| `README.md` | Full rebrand of content |
| `CHANGELOG.md` | Add rebrand note |
| `public/` | Replace `aurafetch_logo.png` with `httppilot_logo.png` |
| `src/assets/` | Add `logo.png` and `logo.svg` for HTTPilot |
| GitHub repo | Rename repository (user action — do last, after all files are updated) |

---

## Tech Stack (unchanged)

- **Desktop:** Tauri 2 (Rust)
- **Frontend:** React 19 + TypeScript
- **Bundler:** Vite 7
- **Editor:** CodeMirror 6
- **Icons:** Lucide React
- **Testing:** Cypress 15 (E2E)

---

## Success Criteria

- [ ] Zero crashes/freezes on: page load, file upload, large responses
- [ ] All existing Cypress E2E tests pass after each phase
- [ ] `App.tsx` reduced to ~100 lines
- [ ] No component file exceeds 300 lines (CodeMirror boilerplate included)
- [ ] Project correctly named HTTPilot across all config files
- [ ] Existing user localStorage data migrated without loss on upgrade
- [ ] GitHub Pages deploys successfully under new name

---

## Out of Scope (future roadmap)

- Team collaboration
- Plugin system
- macOS / Linux builds
- Unit tests (beyond existing Cypress E2E)
