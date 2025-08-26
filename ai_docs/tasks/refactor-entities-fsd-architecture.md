## 1. Task Overview

### Task Title
**Title:** Refactor Entities to FSD architecture with Zustand state and robust data fetching

### Goal Statement
**Goal:** Align `entities/WindData` and `entities/FieldSampler` with Feature-Sliced Design (FSD), introduce a clear data fetching layer, solidify typed state management with Zustand, and fix broken imports/usages so `VectorFieldPage` renders wind visuals from CSV data reliably in both web and XR modes.

---

## 2. Project Analysis & Current State

### Technology & Architecture
- **Frameworks & Versions:** Vite + React + TypeScript, @react-three/fiber, drei, @react-three/xr
- **Language:** TypeScript
- **State Management:** Zustand
- **Data Source:** CSV assets (e.g., `05092013-11112013_23s_res.csv`)
- **Key Architectural Patterns:** FSD-style folders (`entities/`, `features/`, `widgets/`, `pages/`, `shared/`)

### Current State
- `src/entities/WindData/model/windStore.ts` exists with a `useWindStore` store and inline CSV parsing function `parseMastCsvByHeights`.
- Data fetching is not implemented; `loadData` accepts a string but defaults to an imported `?url`, then passes that URL string directly to the parser that expects raw CSV text.
- Legacy `useWindData` and `windDataAPI` were deleted, but `src/pages/VectorFieldPage/ui/VectorFieldPage.tsx` still imports `useWindData`, `FieldSampler`, and `WindFrame` from `@entities/WindData`.
- `src/entities/WindData/index.ts` only re-exports `useWindStore`, not names needed by the page, creating import mismatches.
- `FieldSampler` lives under `src/entities/FieldSampler/model/fieldSampler.ts` and is consumed on the page.
- CSV parsing utilities also exist in `src/shared/lib/math/parsing.ts`.

Gaps:
- No proper API layer for fetching CSV data (from asset URL, remote URL, or `File`).
- State transitions do not handle async fetch lifecycle (loading/error/ready with fetch).
- Export barrels in `entities/WindData` are incomplete; types/selectors are not exported.
- Page imports are out-of-sync with current entity exports.

---

## 3. Context & Problem Definition

### Problem Statement
Wind data ingestion is tightly coupled to the store and assumes raw CSV text, yet the default path supplies a URL string. Deleted hooks (`useWindData`) and API files left the page importing non-existent symbols. The lack of a dedicated `api` layer and coherent `index.ts` exports breaks FSD boundaries and risks runtime errors.

### Success Criteria
- [ ] `VectorFieldPage` compiles and runs with no broken imports.
- [ ] Wind data loads via a proper async fetch path (asset URL, remote URL, or `File`).
- [ ] `useWindStore` exposes typed selectors/actions: `loadByUrl`, `loadFromText`, `getTimelineInfo`, `getCurrentFrame`, etc.
- [ ] Parsing lives in a `lib/` module and is used by both API and store layers.
- [ ] Entities barrels (`index.ts`) export stable public API (store, types, selectors, samplers as needed).
- [ ] Clear FSD boundaries between `entities/`, `features/`, `widgets/`, `pages/`, `shared/`.

---

## 4. Development Mode Context

- **🚨 Project Stage:** Active refactor on branch `refactoring-model`.
- **Breaking Changes:** Avoid user-facing breaking changes; fix compile/runtime issues. Internal module moves allowed with updated imports.
- **Data Handling:** Preserve CSV assets; ensure deterministic parsing and TZ-safe timestamps.
- **User Base:** Developers and demo users.
- **Priority:** Stability and correctness over rapid changes; keep renders performant.

---

## 5. Technical Requirements

### Functional Requirements
- User can load wind data automatically from a default asset URL.
- System can also load from a remote URL or provided raw CSV text (future-proofing for uploads).
- Vector field renders particles using layered field sampler across heights.
- Playback controls adjust `frameIndex`; status billboard shows aggregated metrics.

### Non-Functional Requirements
- **Performance:** Parsing should handle large CSVs without UI freezes (defer to microtasks; consider streaming in future).
- **Reliability:** Handle malformed rows gracefully with value sanitization.
- **Usability:** Timeline info is consistent across heights; timestamps avoid TZ shifts by using local time rendering.
- **Maintainability:** Clear FSD layering: `api` (fetch), `model` (state), `lib` (pure functions), `types`.

### Technical Constraints
- Must keep CSV assets under `src/data/` working with Vite.
- Must maintain existing public UI behavior (`VectorField`, labels, XR overlay).

---

## 6. Data & Database Changes

### Database Schema Changes
N/A (CSV files only).

### Data Model Updates
Define and centralize types in `entities/WindData/types/types.ts`:
- `WindFrame`
- `FramesByHeight = Record<number, WindFrame[]>`
- `TimelineInfo = { length: number; repHeight: number }`

### Data Migration Plan
N/A. Ensure parser remains compatible with existing CSVs.

---

## 7. API & Backend Changes

### Data Access Pattern Rules
- `entities/WindData/api` handles raw data retrieval and conversion to text.
- `entities/WindData/lib/parsing` parses CSV text into typed structures.
- `entities/WindData/model/windStore` orchestrates: calls API ➜ parses ➜ updates state.

### Server Actions
N/A. Client-side fetch only.

### Data Queries
- `fetchCsvText(url: string): Promise<string>` for asset/remote URLs.
- `readFileText(file: File): Promise<string>` (optional future).

---

## 8. Frontend Changes

### New Components
None required.

### Page Updates
- Update `src/pages/VectorFieldPage/ui/VectorFieldPage.tsx` to use `useWindStore` selectors and actions. Remove stale `useWindData` import. Trigger `loadByUrl(defaultAssetUrl)` on mount.

### State Management
- `useWindStore` (Zustand) holds `framesByHeight`, `heightOrder`, `frameIndex`, `status`, `error` and exposes:
  - `setFrameIndex(i: number)`
  - `loadByUrl(url?: string)` (async): sets loading, fetches, parses, sets ready or error
  - `loadFromText(text: string)` (sync): parses and sets ready
  - `getCurrentFrame()` and `getTimelineInfo()` selectors

---

## 9. Implementation Plan

1) Entities structure and types
- Create `src/entities/WindData/types/types.ts` with `WindFrame`, `FramesByHeight`, `TimelineInfo`.
- Move or re-export parsing helpers from `src/shared/lib/math/parsing.ts` as needed. Prefer a thin wrapper in `entities/WindData/lib/parsing.ts` that composes existing helpers and encapsulates column mapping.

2) API layer
- Add `src/entities/WindData/api/fetchCsv.ts` with `fetchCsvText(url: string)` and optional `readFileText(file: File)`.

3) Store refactor
- Update `src/entities/WindData/model/windStore.ts`:
  - Make `loadData` async and rename to `loadByUrl`.
  - Add `loadFromText` path for direct ingestion.
  - Use `status: 'idle' | 'loading' | 'ready' | 'error'` with proper transitions.
  - Move `parseMastCsvByHeights` into `lib/parsing.ts` and import it.
  - Export typed selectors via the store (keep `getTimelineInfo`, `getCurrentFrame`).

4) Barrel exports
- Update `src/entities/WindData/index.ts` to export:
  - store: `useWindStore`
  - types: `WindFrame`, `FramesByHeight`, `TimelineInfo`
  - parser: `parseMastCsvByHeights` (optional)
  - api: `fetchCsvText` (optional)

5) Page integration
- Fix `src/pages/VectorFieldPage/ui/VectorFieldPage.tsx` imports to use store exports.
- On mount, call `useEffect(() => loadByUrl(defaultAssetUrl), [])` with the Vite `?url` for the default CSV asset.
- Wire UI to store state: show `statusText`, disable playback while `loading`, handle `error`.

6) Cleanup
- Remove stale imports/usages (`useWindData`, old types from deleted modules).
- Ensure `@entities/WindData` path resolves to updated barrel.

---

## 10. Task Completion Tracking

- Add checklist to PR description and keep it updated:
  - [ ] Types centralized under `entities/WindData/types`
  - [ ] API layer implemented and used by store
  - [ ] Store exposes async `loadByUrl` and sync `loadFromText`
  - [ ] Parser resides in `entities/WindData/lib`
  - [ ] Page compiles and runs; no broken imports
  - [ ] Status transitions visible (idle ➜ loading ➜ ready | error)

---

## 11. File Structure & Organization

Target structure:
```
src/entities/WindData/
  api/
    fetchCsv.ts
  lib/
    parsing.ts
  model/
    windStore.ts
  types/
    types.ts
  index.ts

src/entities/FieldSampler/
  model/
    fieldSampler.ts
  index.ts (re-export sampler types/functions)
```

---

## 12. AI Agent Instructions

### Implementation Workflow
1. Create types and API files first, commit.
2. Refactor parser location, commit.
3. Update store to async API and new parser, commit.
4. Fix barrels and page imports, commit.
5. Run and verify in browser (web and XR paths), adjust as needed.

### Communication Preferences
- Keep commit messages scoped: `entities(WindData): ...`, `pages(VectorFieldPage): ...`.

### Code Quality Standards
- Follow local React/TypeScript/Zustand rules (see `.cursor/rules/react.mdc`, `.cursor/rules/typescript.mdc`, `.cursor/rules/zustand.mdc`).
- Strong typing, no `any`, guard clauses, no unnecessary nesting.

---

## 13. Second-Order Impact Analysis

### Impact Assessment
- Moving parser can affect imports across the app; ensure re-exports mitigate churn.
- Async store may change initial render timing; ensure components handle `loading` gracefully.
- Importing CSV with `?url` requires fetching; ensure CORS or asset availability in dev/prod.
- Particle counts and bounds unaffected, but ensure timeline-derived indices remain consistent after refactor.


