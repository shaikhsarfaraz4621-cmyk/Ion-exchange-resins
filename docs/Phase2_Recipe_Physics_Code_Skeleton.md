# Phase 2 Documentation: Recipe-to-Physics Coupling (Code Skeleton)

This document provides a review-first code skeleton for implementing Phase 2:

- Recipe inputs drive physics outputs
- Physics outputs drive quality scoring
- Outputs surface in dashboard + advisor logic

It is intentionally scaffold-level (function signatures, data model shape, flow), not final tuned equations.

---

## 1) Scope of Phase 2

### Inputs (already available)

- `recipe.dvbPercent`
- `recipe.initiatorDosage`
- `recipe.monomerWaterRatio`
- `recipe.feedRateProfile`
- `recipe.targetPsdMin`
- `recipe.targetPsdMax`

### New outputs to add

- `crosslinkDensity`
- `swellingIndex`
- `rigidityIndex`
- `psdSpread`
- `predictedWBC`
- `predictedIonCapacity`

---

## 2) Backend Schema Skeleton

File: `backend/schemas.py`

```python
class NodeData(BaseModel):
    # ... existing fields ...
    crosslinkDensity: Optional[float] = None
    swellingIndex: Optional[float] = None
    rigidityIndex: Optional[float] = None
    psdSpread: Optional[float] = None
    predictedWBC: Optional[float] = None
    predictedIonCapacity: Optional[float] = None
```

No new endpoint is required if these values are returned via existing `nodes` in `/state` and `/simulate/tick`.

---

## 3) Simulation Engine Skeleton

File: `backend/simulation.py`

### 3.1 Add helper constants

```python
# Placeholder coefficients; tune with process feedback/calibration.
DVB_BASE = 7.0
INITIATOR_BASE = 0.8
MONOMER_WATER_BASE = 0.33
```

### 3.2 Add helper functions

```python
def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _feed_profile_factor(feed_profile: str) -> float:
    if feed_profile == "conservative":
        return 0.9
    if feed_profile == "aggressive":
        return 1.15
    return 1.0


def _crosslink_density(dvb_percent: float, initiator: float, conversion: float) -> float:
    # Skeleton proxy only (replace with validated form)
    x = 0.55 * (dvb_percent / DVB_BASE) + 0.20 * (initiator / INITIATOR_BASE) + 0.25 * (conversion / 100.0)
    return _clamp(x, 0.1, 2.0)


def _swelling_index(crosslink_density: float) -> float:
    # Higher crosslink -> lower swelling
    return _clamp(1.4 - 0.45 * crosslink_density, 0.1, 1.5)


def _rigidity_index(crosslink_density: float) -> float:
    # Higher crosslink -> higher rigidity
    return _clamp(0.5 + 0.5 * crosslink_density, 0.1, 2.0)


def _turbulence_proxy(rpm: float, power_number: float, diameter_m: float) -> float:
    # Consistent with agitation power trends (proxy, not CFD)
    return _clamp((rpm / 120.0) * (power_number / 5.0) * (diameter_m / 2.0), 0.1, 4.0)


def _stability_proxy(monomer_water_ratio: float, crosslink_density: float) -> float:
    # Skeleton relation: more stable around nominal ratio, influenced by matrix structure
    ratio_term = 1.0 - abs(monomer_water_ratio - MONOMER_WATER_BASE) * 1.8
    x = ratio_term + 0.15 * crosslink_density
    return _clamp(x, 0.2, 2.0)


def _psd_outputs(psd_mean_prev: float, turbulence: float, stability: float) -> tuple[float, float]:
    # turbulence/stability ratio drives mean + spread
    ratio = turbulence / max(0.1, stability)
    psd_mean = _clamp(0.62 - 0.05 * (ratio - 1.0), 0.25, 1.5)
    psd_spread = _clamp(0.18 + 0.06 * abs(ratio - 1.0), 0.08, 0.8)
    return psd_mean, psd_spread


def _predicted_wbc(swelling_idx: float, rigidity_idx: float, thermal_peak: float) -> float:
    # proxy: lower swelling shock + better rigidity + controlled thermal -> better WBC
    score = 92.0 + (rigidity_idx - 1.0) * 6.0 - max(0.0, thermal_peak - 90.0) * 0.35 - abs(swelling_idx - 0.9) * 8.0
    return _clamp(score, 40.0, 99.8)


def _predicted_ion_capacity(conversion: float, crosslink_density: float, stage: str) -> float:
    stage_boost = 1.0 if stage in ("functionalization", "hydration", "complete") else 0.85
    val = (1.3 + 0.006 * conversion + 0.12 * crosslink_density) * stage_boost
    return _clamp(val, 0.5, 3.0)


def _quality_grade_from_composite(
    conversion: float,
    temp: float,
    psd_mean: float,
    psd_spread: float,
    target_psd_min: float,
    target_psd_max: float,
    predicted_wbc: float,
) -> str:
    in_psd_band = target_psd_min <= psd_mean <= target_psd_max
    spread_ok = psd_spread <= 0.30

    if temp >= 110 or predicted_wbc < 60:
        return "Fail"
    if conversion >= 85 and in_psd_band and spread_ok and temp < 90 and predicted_wbc >= 92:
        return "AAA"
    if conversion >= 75 and in_psd_band and temp < 100 and predicted_wbc >= 85:
        return "AA"
    if conversion >= 60 and temp < 105:
        return "B"
    return "Fail"
```

### 3.3 Integrate into reactor block inside `simulate_tick(...)`

```python
# inside reactor branch after you compute conversion/temp/rpm/power
recipe = state.recipe
feed_factor = _feed_profile_factor(recipe.feedRateProfile)

# thermal aggressiveness coupling (skeleton multiplier)
exothermic_rise *= (1.0 + 0.18 * (recipe.initiatorDosage / INITIATOR_BASE - 1.0)) * feed_factor

# new recipe-driven process outputs
crosslink_density = _crosslink_density(recipe.dvbPercent, recipe.initiatorDosage, next_conversion)
swelling_idx = _swelling_index(crosslink_density)
rigidity_idx = _rigidity_index(crosslink_density)

turbulence = _turbulence_proxy(rpm, power_number, diameter_m)
stability = _stability_proxy(recipe.monomerWaterRatio, crosslink_density)
psd_mean, psd_spread = _psd_outputs(nd.psdMean or 0.62, turbulence, stability)

pred_wbc = _predicted_wbc(swelling_idx, rigidity_idx, nd.peakTemp or next_temp)
pred_ion_cap = _predicted_ion_capacity(next_conversion, crosslink_density, next_stage.value)

nd.crosslinkDensity = round(crosslink_density, 4)
nd.swellingIndex = round(swelling_idx, 4)
nd.rigidityIndex = round(rigidity_idx, 4)
nd.psdMean = round(psd_mean, 4)
nd.psdSpread = round(psd_spread, 4)
nd.predictedWBC = round(pred_wbc, 2)
nd.predictedIonCapacity = round(pred_ion_cap, 3)

nd.qualityGrade = _quality_grade_from_composite(
    conversion=next_conversion,
    temp=next_temp,
    psd_mean=psd_mean,
    psd_spread=psd_spread,
    target_psd_min=recipe.targetPsdMin,
    target_psd_max=recipe.targetPsdMax,
    predicted_wbc=pred_wbc,
)
```

---

## 4) Advisor Logic Skeleton

File: `backend/ai_advisor.py`

Add rule signals from new fields:

```python
def _recipe_physics_signals(state: PlantState) -> list[str]:
    signals = []
    reactors = [n for n in state.nodes if n.type == "reactor"]
    for r in reactors:
        d = r.data
        if (d.psdSpread or 0) > 0.30:
            signals.append(f"{r.id}: PSD spread high ({d.psdSpread:.2f})")
        if (d.swellingIndex or 0) > 1.15:
            signals.append(f"{r.id}: swelling risk elevated ({d.swellingIndex:.2f})")
        if (d.temp or 25) > 85 and state.recipe.feedRateProfile == "aggressive":
            signals.append(f"{r.id}: thermal risk amplified by aggressive feed profile")
    return signals
```

Recommendation scaffold:

```python
# pseudo
if psd_spread_high:
    action = "LOWER_RPM"
    reason = "High turbulence/stability ratio widening PSD"
    impact = "Reduce off-spec fines/oversize risk"
elif thermal_risk_high and aggressive_feed:
    action = "START_COOLING"
    reason = "Recipe aggressiveness + rising exotherm"
    impact = "Lower trip probability and thermal stress"
```

---

## 5) Frontend Store and UI Skeleton

### 5.1 Type shape

File: `frontend/src/types/index.ts`

```ts
export type PhysicsOutputs = {
  crosslinkDensity?: number;
  swellingIndex?: number;
  rigidityIndex?: number;
  psdSpread?: number;
  predictedWBC?: number;
  predictedIonCapacity?: number;
};
```

### 5.2 Dashboard cards

File: `frontend/src/components/dashboard/DashboardView.tsx`

```tsx
const activeReactor = reactors.find(r => r.data.status === "running") || reactors[0];
const d = activeReactor?.data || {};

// new cards
// Crosslink Density, Swelling Index, Rigidity Index, PSD Spread, Predicted WBC, Predicted Ion Capacity
```

### 5.3 Recipe-aware advisor view text

File: `frontend/src/components/chatbot/PlantChatbot.tsx`

```ts
// include hints in fallback text:
// "PSD spread is high due to turbulence-to-stability imbalance. Consider reducing RPM."
```

---

## 6) Validation Skeleton

Create deterministic scenario checks (manual or scripted):

```text
Case A: Increase DVB only -> crosslink up, swelling down, rigidity up
Case B: Increase RPM moderate -> psdMean down
Case C: Increase RPM high -> psdSpread up
Case D: Aggressive feed + high initiator -> thermal alerts earlier
```

Pass condition:

- Directional response matches domain expectation in all four cases.

---

## 7) Implementation Order

1. `backend/schemas.py` (new fields)
2. `backend/simulation.py` (helpers + reactor integration)
3. `backend/ai_advisor.py` (rule updates)
4. `frontend/src/components/dashboard/DashboardView.tsx` (new metrics view)
5. `frontend/src/components/chatbot/PlantChatbot.tsx` (explanations)
6. Build/tests and scenario validation

---

## 8) Notes for Review

- All formulas in this doc are placeholders for initial phase rollout.
- Coefficients should be tuned in Phase 5 calibration.
- Keep equations explainable and bounded to avoid unstable demo behavior.

