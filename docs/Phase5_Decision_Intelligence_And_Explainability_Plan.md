# Phase 5 — Decision Intelligence & Explainability (Plan + Code Skeleton)

**Status:** Planning + skeleton only.  
**Implementation:** starts after your approval.

---

## 1) Why Phase 5

Phase 4 proved the simulator can **record evidence** (runs, KPIs, comparisons).  
Phase 5 upgrades it into a **decision assistant**:

- Recommend next-best recipe settings for a target outcome
- Explain why a recommendation is made (traceable logic)
- Estimate confidence so operators can judge risk
- Rank historical runs and suggest what to try next

This is where the system shifts from "monitor + compare" to "suggest + justify."

---

## 2) Phase 5 Objectives

| Objective | Outcome |
|---|---|
| Recipe optimization | Suggest recipe candidates based on KPI targets and constraints |
| What-if engine | Simulate candidate recipes in a sandbox before operator applies them |
| Explainability | Every recommendation includes triggered conditions + expected KPI impact |
| Confidence scoring | Add confidence score (0-1) + rationale to each recommendation |
| Run ranking | Sort historical runs by weighted performance score |
| Next-run guidance | Produce "Recommended Next Recipe" card from evidence |

---

## 3) Scope (v1 for this phase)

### In scope
- Rule + heuristic optimizer (deterministic, explainable)
- Optional AI narrative layer on top of deterministic output
- Backend endpoints for optimize/rank/explain
- Frontend panel in `Runs & Evidence` for recommendations

### Out of scope (next phase)
- Full Bayesian optimization / ML training pipeline
- External DB and long-term model retraining workflow
- Multi-user approval workflows

---

## 4) High-Level Architecture

```text
  Historical runs + KPIs
          │
          ▼
  run_ranker.py  ──► ranked evidence
          │
          ▼
  recipe_optimizer.py ──► candidate recipes + predicted impacts + confidence
          │
          ▼
  explainability.py  ──► reason chain + triggered conditions + tradeoffs
          │
          ▼
  FastAPI endpoints  ──► frontend "Recommended Next Recipe" + "Why?"
```

---

## 5) New Data Contracts (backend `schemas.py`)

```python
class OptimizationGoal(BaseModel):
    targetWBCMin: Optional[float] = None
    targetConversionMin: Optional[float] = None
    targetMaxTemp: Optional[float] = None
    targetMaxEnergyDelta: Optional[float] = None
    prioritize: Literal["quality", "energy", "throughput", "balanced"] = "balanced"

class OptimizationConstraint(BaseModel):
    dvbMin: float = 1.0
    dvbMax: float = 20.0
    initiatorMin: float = 0.1
    initiatorMax: float = 5.0
    monomerWaterMin: float = 0.1
    monomerWaterMax: float = 1.0
    allowedFeedProfiles: list[FeedRateProfile] = ["conservative", "balanced", "aggressive"]

class ExplainabilityTrace(BaseModel):
    triggeredSignals: list[str]          # e.g. "maxTemp too high", "offSpec score elevated"
    causeHypothesis: list[str]           # e.g. "aggressive feed + high dvb driving thermal load"
    expectedImpact: list[str]            # e.g. "reduce maxTemp by 4-8C"
    tradeoffs: list[str]                 # e.g. "slightly lower throughput"

class RecipeCandidate(BaseModel):
    rank: int
    recipe: RecipeConfig
    predictedKPI: RunKPIs                # proxy predicted KPI snapshot
    confidence: float                    # 0.0-1.0
    score: float                         # weighted objective score
    trace: ExplainabilityTrace

class OptimizationResponse(BaseModel):
    baselineRunId: Optional[str] = None
    goal: OptimizationGoal
    candidates: list[RecipeCandidate]
    summary: str

class RunRankItem(BaseModel):
    runId: str
    label: str
    score: float
    strengths: list[str]
    weaknesses: list[str]

class RunRankingResponse(BaseModel):
    ranking: list[RunRankItem]
    scoringWeights: dict[str, float]
```

---

## 6) Backend Module Plan (new files)

### `backend/run_ranker.py`
- Build weighted score from run KPIs
- Produce ranked list + strengths/weaknesses

### `backend/recipe_optimizer.py`
- Generate candidate recipe variations from baseline recipe
- Predict KPI proxies using current heuristic model
- Score each candidate against user goal
- Return top-N candidates

### `backend/explainability.py`
- Build trace objects:
  - triggered signals
  - root-cause hypothesis
  - expected impact
  - tradeoffs

### `backend/decision_service.py`
- Orchestrates ranker + optimizer + explainability
- Provides one clean API surface for `main.py`

---

## 7) Backend API Endpoints (Phase 5)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/decisions/optimize` | Input goals + constraints, output ranked recipe candidates |
| `GET` | `/decisions/run-ranking` | Rank historical runs with weighted score |
| `GET` | `/decisions/recommend-next` | Return best next candidate from latest evidence |
| `POST` | `/decisions/explain` | Given runId/candidate, return explainability trace only |

Example request:

```json
{
  "goal": {
    "targetWBCMin": 90,
    "targetConversionMin": 85,
    "targetMaxTemp": 95,
    "prioritize": "balanced"
  },
  "constraints": {
    "dvbMin": 5,
    "dvbMax": 12,
    "allowedFeedProfiles": ["balanced", "conservative"]
  },
  "topN": 3
}
```

---

## 8) Frontend Plan

## `Runs & Evidence` additions
- New right-side panel: **Recommended Next Recipe**
- Show top 3 candidates:
  - recipe chips
  - predicted KPI deltas vs baseline
  - confidence badge
  - "Why?" expandable explainability
  - "Apply to Recipe Setup" button

## New file
- `frontend/src/components/dashboard/DecisionView.tsx` (or panel component inside `RunsView`)

## Existing files touched
- `frontend/src/services/api.ts` (decision endpoints)
- `frontend/src/types/index.ts` (Phase 5 types)
- `frontend/src/store/simulationStore.ts` (optional: store decision outputs)

---

## 9) Code Skeleton (File-by-File)

## `backend/run_ranker.py`

```python
from schemas import RunKPIs, RunRecord, RunRankItem

DEFAULT_WEIGHTS = {
    "quality": 0.35,
    "energy": 0.20,
    "safety": 0.25,
    "throughput": 0.20,
}

def score_run(kpi: RunKPIs, w: dict[str, float]) -> float:
    # Normalize and combine. Higher score = better.
    pass

def rank_runs(runs: list[RunRecord], kpis: dict[str, RunKPIs], weights: dict[str, float] | None = None) -> list[RunRankItem]:
    pass
```

## `backend/recipe_optimizer.py`

```python
from schemas import RecipeConfig, OptimizationGoal, OptimizationConstraint, RecipeCandidate, RunKPIs

def generate_candidate_grid(base: RecipeConfig, c: OptimizationConstraint) -> list[RecipeConfig]:
    # Small bounded grid around baseline, constrained by user limits.
    pass

def predict_kpi_proxy(recipe: RecipeConfig, baseline_kpi: RunKPIs | None) -> RunKPIs:
    # Reuse existing physics heuristics (Phase 2/4 signals).
    pass

def score_candidate(predicted: RunKPIs, goal: OptimizationGoal) -> float:
    pass

def optimize_recipes(base_recipe: RecipeConfig, goal: OptimizationGoal, constraints: OptimizationConstraint, top_n: int = 3) -> list[RecipeCandidate]:
    pass
```

## `backend/explainability.py`

```python
from schemas import RecipeConfig, RunKPIs, ExplainabilityTrace

def build_trace(
    baseline_recipe: RecipeConfig,
    candidate_recipe: RecipeConfig,
    baseline_kpi: RunKPIs | None,
    candidate_kpi: RunKPIs
) -> ExplainabilityTrace:
    # Create deterministic cause-effect bullets.
    pass
```

## `backend/decision_service.py`

```python
from schemas import OptimizationGoal, OptimizationConstraint, OptimizationResponse, RunRankingResponse

def recommend_next_recipe(goal: OptimizationGoal, constraints: OptimizationConstraint, top_n: int = 3) -> OptimizationResponse:
    # 1) get ranked runs
    # 2) choose baseline
    # 3) optimize candidates
    # 4) attach explainability traces
    pass

def get_run_ranking() -> RunRankingResponse:
    pass
```

## `backend/main.py` additions

```python
@app.post("/decisions/optimize")
def decisions_optimize(body: dict):
    pass

@app.get("/decisions/run-ranking")
def decisions_run_ranking():
    pass

@app.get("/decisions/recommend-next")
def decisions_recommend_next():
    pass

@app.post("/decisions/explain")
def decisions_explain(body: dict):
    pass
```

## `frontend/src/services/api.ts`

```ts
async optimizeDecisions(payload: {
  goal: OptimizationGoal;
  constraints: OptimizationConstraint;
  topN?: number;
}): Promise<OptimizationResponse> { /* ... */ }

async getRunRanking(): Promise<RunRankingResponse> { /* ... */ }
```

## `frontend/src/components/dashboard/DecisionPanel.tsx`

```tsx
export default function DecisionPanel() {
  // fetch optimization result
  // render candidates with confidence + trace
  // apply selected candidate to recipe store
}
```

---

## 10) Implementation Order (recommended)

1. Add Phase 5 schemas in `backend/schemas.py`
2. Implement `run_ranker.py` + `recipe_optimizer.py` (no UI yet)
3. Add `decision_service.py` + backend endpoints
4. Add frontend types + API client methods
5. Build `DecisionPanel` in Runs view
6. Add "Apply candidate recipe" flow
7. Validate with 3 demo scenarios and compare outcomes

---

## 11) Acceptance Criteria

- System returns at least 3 ranked recipe candidates for a valid goal
- Each candidate includes confidence + explainability trace
- Operator can apply one candidate directly to recipe settings
- Run ranking endpoint returns deterministic order for same input set
- Recommendation panel works without breaking existing Phase 4 features

---

## 12) Demo Script for Client (Phase 5)

1. Run baseline and one stressed run (already available from Phase 4)
2. Open Decision panel and set target:
   - WBC >= 90
   - Max Temp <= 95C
   - Balanced priority
3. Show generated candidates with confidence + "Why?"
4. Apply top candidate and execute a new run
5. Compare with baseline and show measurable improvement

---

## 13) Risks & Mitigations

- **Risk:** Heuristic recommendations feel arbitrary  
  **Mitigation:** deterministic traces + confidence + explicit tradeoffs

- **Risk:** Overfitting to proxy KPIs  
  **Mitigation:** keep calibration hook for real plant data in next phase

- **Risk:** UI clutter  
  **Mitigation:** keep panel compact with collapsible "Why?" section

---

## 14) Ready-to-Start Checklist

- [ ] Phase 5 schemas approved
- [ ] Target optimization goals finalized
- [ ] Candidate limit and scoring weights agreed
- [ ] UI placement approved (`RunsView` side panel)
- [ ] Start implementation

