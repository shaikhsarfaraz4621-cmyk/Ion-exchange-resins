"""
recipe_optimizer.py — Phase 5
Generates recipe candidates via a bounded grid search, predicts KPI proxies
using the same physics heuristics as the simulation engine, scores each
candidate against the operator's goal, and returns the top-N ranked candidates.
"""
import math
import itertools
from schemas import (
    RecipeConfig, OptimizationGoal, OptimizationConstraint,
    RecipeCandidate, RunKPIs,
)
from explainability import build_trace

# ── Physics / heuristic constants (mirror simulation.py) ─────────
DVB_BASE        = 7.0
INITIATOR_BASE  = 0.8
MW_BASE         = 0.33
TRIP_TEMP       = 110.0
FEED_SPEED      = {"conservative": 0.7, "balanced": 1.0, "aggressive": 1.3}


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def generate_candidate_grid(
    base: RecipeConfig,
    c: OptimizationConstraint,
) -> list[RecipeConfig]:
    """
    Build a small discrete grid around the baseline recipe,
    bounded by the operator's constraints.  Grid has 3 levels per
    continuous parameter × n feed profiles.
    """
    def _steps(lo: float, hi: float, base_val: float, n: int = 3) -> list[float]:
        mid = _clamp(base_val, lo, hi)
        step = max((hi - lo) / (n * 2), 0.001)
        candidates = sorted({
            _clamp(mid - step, lo, hi),
            _clamp(mid, lo, hi),
            _clamp(mid + step, lo, hi),
        })
        return candidates

    dvb_vals  = _steps(c.dvbMin, c.dvbMax, base.dvbPercent)
    init_vals = _steps(c.initiatorMin, c.initiatorMax, base.initiatorDosage)
    mw_vals   = _steps(c.monomerWaterMin, c.monomerWaterMax, base.monomerWaterRatio)
    feed_list = [p for p in c.allowedFeedProfiles if p in ("conservative", "balanced", "aggressive")]
    if not feed_list:
        feed_list = ["balanced"]

    grid: list[RecipeConfig] = []
    for dvb, init, mw, feed in itertools.product(dvb_vals, init_vals, mw_vals, feed_list):
        grid.append(RecipeConfig(
            dvbPercent=round(dvb, 2),
            initiatorDosage=round(init, 3),
            monomerWaterRatio=round(mw, 3),
            feedRateProfile=feed,          # type: ignore[arg-type]
            targetPsdMin=base.targetPsdMin,
            targetPsdMax=base.targetPsdMax,
        ))
    return grid


def predict_kpi_proxy(
    recipe: RecipeConfig,
    baseline_kpi: RunKPIs | None,
    run_id: str = "candidate",
) -> RunKPIs:
    """
    Deterministic physics-heuristic KPI prediction for a recipe.
    All calculations mirror the heuristics in simulation.py.
    """
    dvb  = recipe.dvbPercent
    init = recipe.initiatorDosage
    mw   = recipe.monomerWaterRatio
    feed = FEED_SPEED.get(recipe.feedRateProfile, 1.0)

    # Crosslink density drives WBC (inversely) and rigidity
    crosslink = 0.4 + (dvb / 20.0) * 0.6
    wbc = max(20.0, 110.0 - crosslink * 30.0 - (init - 0.5) * 5.0)
    wbc = min(wbc * (1.0 + mw * 0.05), 120.0)

    # Conversion: higher initiator + higher feed → faster but risk over-shoot
    conv = min(95.0, 55.0 + init * 18.0 + (dvb - 4.0) * 0.5 + feed * 5.0)

    # Max reactor temp: exothermic from initiator + DVB + feed pace
    exo_factor = (dvb / DVB_BASE) * (init / INITIATOR_BASE) * feed
    max_temp = 60.0 + 30.0 * exo_factor
    max_temp = min(max_temp, TRIP_TEMP - 2.0)

    # Energy cost: proportional to DVB crosslinking work and feed speed
    energy_cost = round(1.5 + (dvb / 10.0) * 3.0 + feed * 1.2, 2)

    # Quality grade heuristic
    if wbc >= 90 and max_temp < 90 and conv >= 85:
        grade = "AAA"
    elif wbc >= 75 and max_temp < 100 and conv >= 70:
        grade = "AA"
    elif wbc >= 55 and conv >= 55:
        grade = "B"
    else:
        grade = "Fail"

    # Off-spec score: driven by temp overshoot + low WBC
    off_spec = _clamp((max_temp - 80.0) / 30.0 * 0.5 + (100.0 - wbc) / 100.0 * 0.5, 0.0, 1.0)

    # PSD spread: lower mw ratio → tighter distribution
    psd_spread = round(0.6 + (mw - MW_BASE) * 1.5, 3)

    # Tick duration estimate (proxy)
    tick_dur = int(200 / feed + dvb * 2)

    return RunKPIs(
        runId=run_id,
        maxReactorTemp=round(max_temp, 2),
        maxPeakTemp=round(max_temp + 3.0, 2),
        minPredictedWBC=round(wbc, 2),
        avgConversion=round(conv * 0.92, 2),
        finalConversion=round(conv, 2),
        totalEnergyCostDelta=energy_cost,
        errorAlertCount=1 if max_temp >= 100 else 0,
        warningAlertCount=1 if max_temp >= 85 else 0,
        qualityGradeFinal=grade,
        tickDuration=tick_dur,
        offSpecProxyScore=round(off_spec, 4),
        avgPsdSpread=psd_spread,
        avgIonCapacity=round(wbc * 0.42, 2),
    )


def score_candidate(predicted: RunKPIs, goal: OptimizationGoal) -> float:
    """
    Return a 0-1 objective score aligned with the operator's goal.
    Higher = better match.
    """
    score = 0.0
    weights = {"quality": 0.35, "energy": 0.20, "throughput": 0.20, "safety": 0.25}
    priority = goal.prioritize

    if priority == "quality":
        weights = {"quality": 0.55, "energy": 0.10, "throughput": 0.15, "safety": 0.20}
    elif priority == "energy":
        weights = {"quality": 0.25, "energy": 0.45, "throughput": 0.15, "safety": 0.15}
    elif priority == "throughput":
        weights = {"quality": 0.25, "energy": 0.15, "throughput": 0.45, "safety": 0.15}

    # Quality sub-score
    wbc = predicted.minPredictedWBC or 0.0
    wbc_target = goal.targetWBCMin or 85.0
    q = _clamp(wbc / wbc_target, 0.0, 1.0) * 0.5
    conv_target = goal.targetConversionMin or 80.0
    q += _clamp(predicted.finalConversion / conv_target, 0.0, 1.0) * 0.5
    score += weights["quality"] * q

    # Energy sub-score
    max_e = goal.targetMaxEnergyDelta or 8.0
    e = _clamp(1.0 - predicted.totalEnergyCostDelta / max_e, 0.0, 1.0)
    score += weights["energy"] * e

    # Safety sub-score
    max_t = goal.targetMaxTemp or 95.0
    s = _clamp(1.0 - (predicted.maxReactorTemp - 60.0) / (max_t - 60.0), 0.0, 1.0)
    s = max(0.0, s - predicted.errorAlertCount * 0.1)
    score += weights["safety"] * s

    # Throughput sub-score (lower tick duration = better)
    t = _clamp(1.0 - predicted.tickDuration / 400.0, 0.0, 1.0)
    score += weights["throughput"] * t

    return round(score, 5)


def _confidence(
    recipe: RecipeConfig,
    c: OptimizationConstraint,
    score: float,
    baseline_kpi: RunKPIs | None,
) -> float:
    """
    Estimate confidence 0-1 based on:
    - How close recipe is to known-good region (near baseline)
    - Score magnitude
    - Whether constraints are comfortably satisfied
    """
    constraint_margin = (
        min(recipe.dvbPercent - c.dvbMin, c.dvbMax - recipe.dvbPercent) / max(c.dvbMax - c.dvbMin, 1.0)
        + min(recipe.initiatorDosage - c.initiatorMin, c.initiatorMax - recipe.initiatorDosage) / max(c.initiatorMax - c.initiatorMin, 1.0)
    ) / 2.0

    prior = 0.5 + score * 0.3 + constraint_margin * 0.2
    if baseline_kpi and baseline_kpi.errorAlertCount > 2:
        prior *= 0.85   # less confident when baseline had instability
    return round(_clamp(prior, 0.05, 0.97), 3)


def optimize_recipes(
    base_recipe: RecipeConfig,
    goal: OptimizationGoal,
    constraints: OptimizationConstraint,
    baseline_kpi: RunKPIs | None = None,
    top_n: int = 3,
) -> list[RecipeCandidate]:
    grid = generate_candidate_grid(base_recipe, constraints)

    scored: list[tuple[float, RecipeConfig, RunKPIs]] = []
    for recipe in grid:
        predicted = predict_kpi_proxy(recipe, baseline_kpi)
        s = score_candidate(predicted, goal)
        scored.append((s, recipe, predicted))

    # Remove exact duplicates (same DVB/init/feed), keep best
    seen: set[tuple] = set()
    deduped: list[tuple[float, RecipeConfig, RunKPIs]] = []
    for s, r, kpi in scored:
        key = (r.dvbPercent, r.initiatorDosage, r.monomerWaterRatio, r.feedRateProfile)
        if key not in seen:
            seen.add(key)
            deduped.append((s, r, kpi))

    deduped.sort(key=lambda x: x[0], reverse=True)
    top = deduped[:top_n]

    candidates: list[RecipeCandidate] = []
    for rank, (s, recipe, predicted) in enumerate(top, start=1):
        conf = _confidence(recipe, constraints, s, baseline_kpi)
        trace = build_trace(base_recipe, recipe, baseline_kpi, predicted)
        candidates.append(RecipeCandidate(
            rank=rank,
            recipe=recipe,
            predictedKPIs=predicted,
            confidence=conf,
            score=s,
            trace=trace,
        ))

    return candidates
