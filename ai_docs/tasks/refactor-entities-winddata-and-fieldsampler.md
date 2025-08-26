# Refactor Entities: WindData and FieldSampler (FSD-aligned)

## 1. Task Overview

### Task Title
**Title:** Refactor two entity slices: WindData and FieldSampler to FSD with robust public APIs

### Goal Statement
**Goal:** Align `entities/WindData` and `entities/FieldSampler` with Feature-Sliced Design (segments: api, lib, model, types), introduce a typed async data-loading flow using Zustand, centralize types, and fix import mismatches so `VectorFieldPage` and `VectorField` compile and run reliably in web/XR.

---

## 2. Project Analysis & Current State

### Technology & Architecture
- **Frameworks & Versions:** Vite, React, TypeScript, @react-three/fiber, drei, @react-three/xr
- **State Management:** Zustand
- **Data Source:** CSV assets under `src/data/`
- **Architecture:** FSD-style layers (`app/`, `pages/`, `widgets/`, `features/`, `entities/`, `shared/`)

### Current State
- `src/entities/WindData/model/windStore.ts` defines `useWindStore` with `loadData` that expects raw CSV text, but defaults to a `?url` import and passes that URL string to a parser that expects text.
- Inline parser `parseMastCsvByHeights` is inside the store; parsing helpers also exist in `src/shared/lib/math/parsing.ts`.
- Legacy `useWindData` and `windDataAPI` were deleted, but `src/pages/VectorFieldPage/ui/VectorFieldPage.tsx` still imports `useWindData` from `@entities/WindData`.
- `src/entities/WindData/index.ts` exports only `useWindStore`; no types or helpers are exposed.
- `src/entities/FieldSampler/model/fieldSampler.ts` implements `createLayeredFieldSampler` and defines `buildSpatialGrid`. It references `FramesByHeight`/`WindFrame` types without importing them.
- `src/widgets/VectorField/ui/VectorField.tsx` imports types from `@entities/WindData/lib/types` (which do not exist) and uses `buildSpatialGrid` without importing it.

Gaps:
- Missing `api` for fetching CSV text and `types` segment for WindData and FieldSampler.
- Parser should live under `lib/` and be shared by store and API layer.
- Barrel exports are incomplete; page/widget imports are broken.

---

## 3. Context & Problem Definition

### Problem Statement
Wind data ingestion is tightly coupled and miswired: a URL is passed where raw text is expected, the parser lives inside the store, and several symbols referenced by `VectorFieldPage`/`VectorField` no longer exist. Entities lack clear public APIs per FSD, causing compile/runtime errors and making future changes risky.

### Success Criteria
- [ ] `VectorFieldPage` compiles and runs; no broken imports.
- [ ] `VectorField` compiles and runs; imports are valid.
- [ ] Async load path via `loadByUrl(url)` works; `loadFromText(text)` supported.
- [ ] Parsing in `entities/WindData/lib/parsing.ts` uses shared sanitizers and timestamp parsing.
- [ ] Clear public API via `entities/WindData/index.ts` and `entities/FieldSampler/index.ts` (store, types, key lib fns).
- [ ] Zustand store exposes typed selectors/actions and status transitions: idle → loading → ready | error.

---

## 4. Development Mode Context
- **🚨 Project Stage:** Active refactor on branch `refactoring-model`.
- **Breaking Changes:** Allowed internally; avoid user-facing breakage. Fix compile/runtime errors.
- **Data Handling:** Keep CSV assets intact; timestamps treated as local time to avoid TZ drift.
- **Priority:** Stability and correctness first; maintain performance.

---

## 5. Technical Requirements

### Functional Requirements
- User can view vector field rendered from CSV data by default.
- System can load wind data from a Vite `?url` asset, remote URL, or (future) `File`.
- Playback controls drive `frameIndex`; layered sampler blends between heights.

### Non-Functional Requirements
- **Performance:** Parsing large CSVs should not freeze UI; keep logic synchronous for now but structured for future streaming.
- **Reliability:** Sanitize malformed values; handle missing columns gracefully.
- **Maintainability:** Strict FSD segmentation: `api/`, `lib/`, `model/`, `types/`; stable barrels.

### Technical Constraints
- Must work with existing CSVs in `src/data/`.
- Keep widget/feature behavior unchanged (labels, bounds, XR overlay).

---

## 6. Data & Database Changes

### Database Schema Changes
N/A (CSV files only).

### Data Model Updates
Centralize WindData types under `entities/WindData/types/types.ts`:
- `WindFrame`
- `FramesByHeight = Record<number, WindFrame[]>`
- `TimelineInfo = { length: number; repHeight: number }`

Centralize FieldSampler types under `entities/FieldSampler/types/types.ts`:
- `FieldSample`
- `FieldSampler`

Optional (widget-local): Keep `PreparedVector` internal to `widgets/VectorField` to avoid cross-entity coupling.

### Data Migration Plan
N/A.

---

## 7. API & Backend Changes

### Data Access Pattern Rules
- `entities/WindData/api/fetchCsv.ts` handles fetching/reading CSV as text.
- `entities/WindData/lib/parsing.ts` parses CSV text → typed structures.
- `entities/WindData/model/windStore.ts` orchestrates: fetch → parse → update state.

### Server Actions
N/A (client-only).

### Data Queries
- `fetchCsvText(url: string): Promise<string>`
- `readFileText(file: File): Promise<string>` (future-compatible)

---

## 8. Frontend Changes

### New Components
None.

### Page Updates
- Update `src/pages/VectorFieldPage/ui/VectorFieldPage.tsx` to use `useWindStore` instead of `useWindData`.
- On mount, call `loadByUrl(defaultAssetUrl)`.
- Use selectors: `getTimelineInfo()`, `getCurrentFrame()` where appropriate.

### Widget Updates
- Update `src/widgets/VectorField/ui/VectorField.tsx`:
  - Import `buildSpatialGrid` from `@entities/FieldSampler` barrel (re-export from model).
  - Stop importing non-existent `@entities/WindData/lib/types`; rely on local `PreparedVector` type and on `FieldSampler` type from `@entities/FieldSampler`.

### State Management
- Zustand store keeps: `framesByHeight`, `heightOrder`, `frameIndex`, `status`, `error`.
- Actions: `setFrameIndex`, `loadByUrl`, `loadFromText`, `setFramesByHeight`.
- Selectors: `getCurrentFrame`, `getTimelineInfo`.

---

## 9. Implementation Plan

1) Types and lib groundwork
- Add `src/entities/WindData/types/types.ts` with `WindFrame`, `FramesByHeight`, `TimelineInfo`.
- Add `src/entities/FieldSampler/types/types.ts` with `FieldSample`, `FieldSampler`.
- Move WindData parser to `src/entities/WindData/lib/parsing.ts`, composing helpers from `src/shared/lib/math/parsing.ts`.

2) API layer
- Add `src/entities/WindData/api/fetchCsv.ts` with `fetchCsvText(url)` and optional `readFileText(file)`.

3) Store refactor
- In `src/entities/WindData/model/windStore.ts`:
  - Replace `loadData` with `loadByUrl(url?)` (async) and `loadFromText(text)`.
  - Import parser from `lib/` and types from `types/`.
  - Implement status transitions and error handling.

4) FieldSampler public API
- Ensure `createLayeredFieldSampler` uses `FramesByHeight`/`WindFrame` via imports from `@entities/WindData` types.
- Export `createLayeredFieldSampler` and `buildSpatialGrid` via `src/entities/FieldSampler/index.ts`.

5) Barrel exports
- Update `src/entities/WindData/index.ts` to export: `useWindStore`, types, and optionally `parseMastCsvByHeights`/`fetchCsvText` if needed.
- Update `src/entities/FieldSampler/index.ts` to export: `createLayeredFieldSampler`, `buildSpatialGrid`, and types.

6) Page and widget integration
- Fix imports in `VectorFieldPage.tsx` to use `useWindStore` and call `loadByUrl`.
- Fix imports in `VectorField.tsx` to use `FieldSampler` type from `@entities/FieldSampler` and import `buildSpatialGrid` from the same barrel; keep `PreparedVector` local.

7) Cleanup
- Remove stale imports/usages (`useWindData`, nonexistent `@entities/WindData/lib/types`).
- Verify alias paths resolve to updated barrels.

---

## 10. Task Completion Tracking
- [ ] Types centralized under `entities/WindData/types` and `entities/FieldSampler/types`.
- [ ] Parser moved to `entities/WindData/lib` and used by store.
- [ ] API layer created and used by store.
- [ ] Store exposes `loadByUrl` and `loadFromText` with status transitions.
- [ ] Barrels export stable public APIs for both entities.
- [ ] `VectorFieldPage` uses `useWindStore` and runs without errors.
- [ ] `VectorField` compiles with corrected imports and runs.

---

## 11. File Structure & Organization
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
  types/
    types.ts
  index.ts
```

---

## 12. AI Agent Instructions

### Implementation Workflow
1. Create types and lib files; commit.
2. Add API; commit.
3. Refactor store to async and import new lib/types; commit.
4. Fix FieldSampler types/imports and barrel; commit.
5. Update page and widget imports; commit.
6. Build and run; fix any lints/types; commit.

### Communication Preferences
- Use scoped commits: `entities(WindData): ...`, `entities(FieldSampler): ...`, `pages(VectorFieldPage): ...`, `widgets(VectorField): ...`.

### Code Quality Standards
- Follow local React/TypeScript/Zustand rules (`.cursor/rules/*`).
- Strong typing, no `any`. Guard clauses, clear selectors, minimal nesting.

---

## 13. Second-Order Impact Analysis
- Moving parser may affect any code that imported it from the store; re-export if needed to avoid churn.
- Async loading changes initial render timing; ensure UI handles `loading`/`error`.
- Cross-entity type usage (FieldSampler → WindData types) is explicit via barrels; revisit if coupling grows.
- Ensure Vite asset `?url` fetch path works in dev/prod and respects CORS when remote.
