# DevTools Layout Refactor + Logo Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor DevTools to render in main content area (not sidebar panel) for better UX, and fix favicon not loading in GitHub Pages.

**Architecture:**
- DevTools mode now renders DevToolsPanel in the main content area (same space as HTTP Client)
- Grid of tool cards displays full-size
- Tool components render full-size when selected
- SidebarModeSwitch becomes a simple HTTP/DevTools toggle button
- Logo uses relative path in index.html for cross-platform compatibility

**Tech Stack:** React 19, TypeScript 5.9, existing CSS variables

---

## File Structure

```
src/
├── App.tsx                           (MODIFY — handle mode state, render DevTools in main area)
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx              (MODIFY — simplify mode rendering)
│   │   └── SidebarModeSwitch.tsx    (MODIFY — still a toggle button)
│   └── devtools/
│       └── DevToolsPanel.tsx        (NO CHANGE — same component, different parent)
├── index.html                        (MODIFY — fix favicon path)
└── ...

```

**Changes Summary:**
- App.tsx: Move DevTools rendering to main content area
- Sidebar.tsx: Simplify to not render DevTools panel
- index.html: Change `/vite.svg` to `./vite.svg` (relative path)

---

## Task Breakdown

### Task 1: Fix Favicon Path in index.html

**Files:**
- Modify: `index.html` (line 5)

**Problem:**
- Current: `<link rel="icon" type="image/svg+xml" href="/vite.svg" />`
- Issue: Absolute path `/vite.svg` fails in GitHub Pages (base is `/AuraFetch/`)
- Solution: Use relative path `./vite.svg` which works on all platforms

**Step 1: Update favicon href to relative path**

File: `index.html`

Change line 5 from:
```html
<link rel="icon" type="image/svg+xml" href="/vite.svg" />
```

To:
```html
<link rel="icon" type="image/svg+xml" href="./vite.svg" />
```

**Step 2: Verify in browser**

- Open http://localhost:5173 (dev)
- Check that Vite logo appears in browser tab
- Build and verify: `npm run build`

---

### Task 2: Refactor DevTools Layout - Modify App.tsx

**Files:**
- Modify: `src/App.tsx` (main orchestrator logic)

**Current Behavior:**
- Sidebar shows mode toggle (HTTP | DevTools)
- When mode=devtools, DevToolsPanel renders in sidebar panel

**Desired Behavior:**
- Sidebar shows mode toggle (still exists)
- When mode=devtools, DevToolsPanel renders in MAIN CONTENT AREA
- Grid of tool cards takes full width
- Selected tool takes full width

**Step 1: Review current App.tsx structure**

Read `src/App.tsx` to understand:
- How `mode` state is managed
- How RequestContext provides data
- Current render structure

**Step 2: Update main content rendering logic**

In `src/App.tsx`, modify the main content rendering section:

```typescript
// Current (approx):
// <main>
//   {mode === 'http' && <HttpClient />}
//   {mode === 'devtools' && <DevToolsPanelInSidebar />}
// </main>

// New:
// <main>
//   {mode === 'http' && <HttpClient />}
//   {mode === 'devtools' && <DevToolsPanel />}  // Full-size, not sidebar
// </main>
```

Ensure:
- DevToolsPanel is imported from `./components/devtools/DevToolsPanel`
- DevToolsPanel receives no `onBack` prop (not in sidebar anymore)
- DevToolsPanel manages its own back navigation

**Step 3: Remove DevTools from Sidebar**

In `src/App.tsx` or wherever Sidebar receives props:
- Pass only `mode` and `onModeChange` to SidebarModeSwitch
- Remove any DevToolsPanel rendering from sidebar template

**Step 4: Verify layout**

- Run `npm run dev`
- Click "HTTP" tab → HTTP Client renders full-width
- Click "Dev Tools" tab → Grid of 12 tool cards renders full-width
- Click a card → Tool renders full-width with "Voltar" button
- Click "Voltar" → Back to grid of cards

---

### Task 3: Refactor Sidebar.tsx

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Current:**
- Sidebar renders mode switcher + DevToolsPanel when mode=devtools

**New:**
- Sidebar renders mode switcher ONLY
- DevToolsPanel rendering moved to App.tsx main content

**Step 1: Remove DevTools rendering from Sidebar**

In `src/components/layout/Sidebar.tsx`:

Find the section that renders DevToolsPanel (likely around line 60-80):
```typescript
// REMOVE THIS:
{mode === 'devtools' && <DevToolsPanel onBack={...} />}
```

Keep only the CollectionTree:
```typescript
// KEEP THIS:
{mode === 'http' && <CollectionTree ... />}
```

**Step 2: Clean up imports**

Remove import of DevToolsPanel from Sidebar.tsx if it was only used there.

**Step 3: Verify Sidebar still renders mode switcher**

- Run `npm run dev`
- Toggle button should still work (HTTP | DevTools)
- Sidebar should only show CollectionTree when in HTTP mode
- Nothing should render in sidebar when in DevTools mode

---

### Task 4: Update DevToolsPanel Props (if needed)

**Files:**
- Review: `src/components/devtools/DevToolsPanel.tsx`

**Current:**
- DevToolsPanel has `onBack?: () => void` prop for sidebar use

**New:**
- DevToolsPanel still manages back navigation internally
- No change needed to component code
- Just verify it works standalone in main content area

**Step 1: Test DevToolsPanel in main content**

- Run `npm run dev`
- Navigate to DevTools mode
- Verify grid displays correctly
- Verify tool opens and "Voltar" works

**No code changes needed if component is self-contained.**

---

### Task 5: Run Tests and Verify

**Files:**
- Test: All existing 121 Cypress tests

**Step 1: Run Cypress tests**

Run: `npm run cypress:run`
Expected: All 121 tests pass (no breaking changes to HTTP Client)

**Step 2: Manual verification**

✓ Logo appears in browser tab (desktop and web)
✓ HTTP mode shows HTTP Client full-width
✓ DevTools mode shows grid full-width
✓ Clicking card opens tool full-width
✓ Voltar button returns to grid
✓ Mode toggle button still works
✓ No console errors

---

## Summary

**Total Tasks:** 5
**Files Modified:** 3 (index.html, App.tsx, Sidebar.tsx)
**Files Created:** 0
**Test Coverage:** Existing 121 tests should all pass

**Benefits of New Layout:**
- Better use of screen real estate
- Tool cards larger and easier to read
- Tool features have more space
- More intuitive UX (toggle to mode, not dropdown in sidebar)
- Logo visible everywhere
