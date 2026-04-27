# Phase 4 — Comparative Evidence + Recipe UX (Code Structure & Outline)

**Status:** Planning only — implementation starts after you approve (`begin coding`).

This document outlines **Phase 4 (comparative evidence / run history)** and clarifies **recipe editability** (what exists today vs what we will add).

---

## 1) Objectives

### Phase 4 — Comparative evidence (primary)

| Goal | Description |
|------|-------------|
| **Run as an artifact** | Persist a logical “batch run” with start/end, recipe snapshot, optional scenario tag, and outcome summary. |
| **Baseline vs optimized** | Allow two (or more) saved runs to be compared on the same KPI dimensions. |
| **Run-level KPIs** | Aggregate tick/history into per-run metrics (not only live dashboard). |
| **Export** | Download a run summary (JSON and/or CSV; optional PDF later). |

### Recipe editability (secondary, within this phase)

| Current behavior | Already in app |
|------------------|----------------|
| Recipe fields (DVB%, initiator, M/W ratio, feed profile, PSD min/max) | Editable under **Settings → Recipe & Batch Setup**; `setRecipe` merges and syncs to backend. |

| Enhancement (proposed for Phase 4) | Rationale |
|-----------------------------------|-----------|
| **Named recipe presets** (save / load / duplicate) | Operators can switch “Standard A” vs “Trial B” without re-sliding every slider. |
| **Optional: recipe locked while simulating** | Prevents mid-run drift unless user explicitly “Unlock & edit” (configurable). |
| **Run stores immutable `recipeAtStart`** | Evidence compares true recipe used for that run, even if live recipe later changes. |

---

## 2) High-level architecture

```
┌─────────────────┐     POST /runs/start      ┌──────────────┐
│  React UI       │ ────────────────────────► │  FastAPI     │
│  (new Runs UI)  │     POST /runs/:id/end    │  in-memory   │
│                 │     GET  /runs            │  run store   │
└─────────────────┘     GET  /runs/compare    └──────────────┘
        │                        │
        │                        ▼
        │                 simulation ticks
        │                 already advance plant_state
        │                        │
        ▼                        ▼
  RunRecord {               Optional: on tick,
    recipeSnapshot,         append to current run’s
    kpiBuffer or           rolling stats or
    post-hoc aggregate     compute on /end
  }
```

- **Storage:** start with **in-memory list** on the backend (same pattern as `plant_state`), with optional **JSON file persistence** in a follow-up if you need survival across restarts.
- **No new database required** for the first cut unless you want SQLite later.

---

## 3) Data models (backend `schemas.py`)

**New (proposed):**

```text
RunStatus          = "active" | "completed" | "aborted"
ScenarioTag        = str | null   # e.g. "reactor_overheat" demo, "baseline", "optimized"

RunRecord
  id: str                          # uuid
  label: str                       # "Baseline run #3"
  status: RunStatus
  createdAt, endedAt: ISO timestamps (string)
  tickStart, tickEnd: int
  batchStageAtStart, batchStageAtEnd: str (optional)
  recipeAtStart: RecipeConfig      # immutable snapshot
  scenarioTag: Optional[str]
  plantSnapshotAtStart: Optional[dict]  # optional: node summary or hash

RunKPIs
  maxReactorTemp: float
  maxPeakTemp: float
  minPredictedWBC: float
  avgConversion: float              # or final conversion
  totalEnergyCostDelta: float       # from cumulative at end - start, or from history
  errorAlertCount, warningAlertCount: int
  qualityGradeFinal: str            # worst or primary reactor grade
  timeToFirstRisk: Optional[int]  # tick index (optional)
  offSpecProxyScore: float         # 0–1 from PSD/recipe band (optional heuristic)

RunComparison
  runA, runB: RunRecord (or ids)
  kpisA, kpisB: RunKPIs
  delta: dict[str, float]         # B - A for numeric KPIs
  narrative: str                   # optional: template summary for client
```

**Existing (reuse):** `RecipeConfig`, `HistoryPoint`, `PlantState` fields for energy and nodes.

---

## 4) Backend API surface (`main.py` — proposed routes)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/runs/start` | Body: `{ label?, recipeOverride?, scenarioTag? }`. Captures `recipeAtStart` from `plant_state.recipe` (or override), `tickStart`, returns `runId`. |
| `POST` | `/runs/{id}/end` | Finalizes run: `tickEnd`, computes `RunKPIs` from `simulationHistory` + node data + alerts, status `completed`. |
| `POST` | `/runs/{id}/abort` | Same as end but status `aborted` (optional). |
| `GET` | `/runs` | List recent runs (newest first), cap 50. |
| `GET` | `/runs/{id}` | Single `RunRecord` + KPIs. |
| `GET` | `/runs/compare?a=&b=` | Two runs side-by-side + deltas. |
| `GET` | `/runs/{id}/export` | `application/json` or `text/csv` (query `format=`). |

**KPI computation:** implemented in a small module, e.g. `backend/run_metrics.py`, called from `end` and `compare`.

**Global state (proposed):** `_active_run_id: Optional[str]`, `_runs: list[RunRecord]`, `_run_kpis: dict[str, RunKPIs]`.

---

## 5) Backend logic modules (new / touched files)

| File | Responsibility |
|------|----------------|
| `backend/schemas.py` | Add `RunRecord`, `RunKPIs`, `RunComparison` (or flatten compare response). |
| `backend/run_metrics.py` | `compute_run_kpis(plant_state_end, run: RunRecord, history_slice) -> RunKPIs` |
| `backend/main.py` | Wire routes, in-memory store, call metrics on `/end`. |
| `backend/simulation.py` | *No change required* unless we decide to tag ticks with `runId` (optional). |

---

## 6) Frontend structure (proposed)

| Path | Purpose |
|------|---------|
| `frontend/src/types/index.ts` | Types: `RunRecord`, `RunKPIs`, `RunComparison`. |
| `frontend/src/services/api.ts` | `startRun`, `endRun`, `listRuns`, `getRun`, `compareRuns`, `exportRun`. |
| `frontend/src/store/simulationStore.ts` | *Optional:* `activeRunId`, `lastCompletedRun` or keep runs only in view-level state. |
| `frontend/src/components/dashboard/RunsView.tsx` | **New screen:** start/end run, list, select two for compare, export buttons. |
| `frontend/src/components/dashboard/RecipePresetsPanel.tsx` | **New (recipe UX):** save/load named presets in `localStorage` (v1) or `GET/POST /recipe-presets` (v2). |
| `frontend/src/App.tsx` + `SidebarNav.tsx` | Nav item e.g. **“Runs & evidence”** → `RunsView`. |
| `frontend/src/components/dashboard/SettingsView.tsx` | **Optional:** link to presets, or “Recipe locked while simulating” toggle. |

**Recipe presets (v1):** `localStorage` key `autonex-recipe-presets` → JSON array `{ name, recipe: RecipeConfig, updatedAt }`.  
**Recipe presets (v2):** same shape via backend if you need multi-user / audit.

---

## 7) UI flows (client demo story)

1. **Baseline:** Configure recipe → **Start run** (“Baseline A”) → run simulation → **End run** → KPIs stored.  
2. **Optimized:** Tweak recipe or apply mitigations → **Start run** (“Optimized B”) → run → **End run**.  
3. **Compare:** Open **Runs & evidence** → select A and B → see delta table + export JSON/CSV for the client.

---

## 8) Implementation order (when coding starts)

1. `schemas.py` — run models + request/response DTOs.  
2. `run_metrics.py` — KPI function + unit-style checks with fake data.  
3. `main.py` — in-memory run store + `/runs/*` routes.  
4. `api.ts` + `RunsView.tsx` + navigation.  
5. Export JSON/CSV.  
6. **Recipe:** presets panel + `localStorage` (and optional sim-lock UX).  
7. Build + manual smoke test (two runs + compare + export).

---

## 9) Acceptance criteria (Phase 4)

- [ ] User can start/end a run and see it listed with **recipe snapshot** and **KPIs**.  
- [ ] User can pick **two runs** and see **side-by-side comparison** with numeric deltas.  
- [ ] User can **export** at least one run as JSON (CSV optional in same pass).  
- [ ] **Recipe presets:** save and load at least one named recipe without re-entering all sliders.  
- [ ] No regression to existing sim tick, advisor, or settings recipe sync.

---

## 10) Out of scope (later phases)

- Long-term database (Postgres / SQLite) for runs.  
- PDF reports (can reuse your `docs/generate_*_pdf.py` pattern).  
- Multi-tenant or auth.  

---

*End of planning document. Say **“begin coding”** (or similar) when you want implementation to start.*
