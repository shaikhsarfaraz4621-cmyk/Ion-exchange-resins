"""
Phase 4 — Run KPI computation.
Aggregates tick history and live plant state into a RunKPIs summary.
All formulas are proxies; tune in Phase 5 calibration.
"""
from typing import Optional
from schemas import RunRecord, RunKPIs, RunComparisonDelta, RunComparison, PlantState, HistoryPoint


_GRADE_ORDER = {"AAA": 0, "AA": 1, "B": 2, "Fail": 3, "Pending": 4}


def _worst_grade(grades: list[str]) -> str:
    if not grades:
        return "Pending"
    return max(grades, key=lambda g: _GRADE_ORDER.get(g, 4))


def _off_spec_score(
    psd_spread: Optional[float],
    psd_mean: Optional[float],
    psd_min: float,
    psd_max: float,
    quality_grade: str,
) -> float:
    """
    0.0 = perfect, 1.0 = worst.
    Combines PSD band miss + quality penalty.
    """
    score = 0.0
    if psd_mean is not None and not (psd_min <= psd_mean <= psd_max):
        score += 0.3
    if psd_spread is not None and psd_spread > 0.30:
        score += 0.2 + min(0.2, (psd_spread - 0.30) * 2)
    grade_penalty = {"AAA": 0.0, "AA": 0.1, "B": 0.3, "Fail": 0.5, "Pending": 0.0}
    score += grade_penalty.get(quality_grade, 0.0)
    return min(1.0, round(score, 3))


def compute_run_kpis(
    run: RunRecord,
    state_at_end: PlantState,
    history_slice: list[HistoryPoint],
    energy_start: float,
    alert_errors: int,
    alert_warnings: int,
) -> RunKPIs:
    """
    Compute KPIs from the terminal plant state and sliced simulation history.
    history_slice: only ticks that belong to this run (tickStart..tickEnd).
    energy_start: cumulativeEnergyCost at tickStart (to compute delta).
    """
    reactors = [n for n in state_at_end.nodes if n.type == "reactor"]

    max_temp   = max((r.data.temp or 25.0 for r in reactors), default=25.0)
    max_peak   = max((r.data.peakTemp or 25.0 for r in reactors), default=25.0)
    final_conv = max((r.data.conversion or 0.0 for r in reactors), default=0.0)
    grades     = [r.data.qualityGrade or "Pending" for r in reactors]
    quality    = _worst_grade(grades)

    # WBC — use minimum across reactors (most conservative)
    wbc_vals = [r.data.predictedWBC for r in reactors if r.data.predictedWBC is not None]
    min_wbc  = min(wbc_vals) if wbc_vals else None

    # PSD
    psd_spreads  = [r.data.psdSpread for r in reactors if r.data.psdSpread is not None]
    psd_means    = [r.data.psdMean   for r in reactors if r.data.psdMean   is not None]
    avg_psd_spread = round(sum(psd_spreads) / len(psd_spreads), 4) if psd_spreads else None
    avg_psd_mean   = round(sum(psd_means)   / len(psd_means),   4) if psd_means   else None

    # Ion capacity
    ion_caps = [r.data.predictedIonCapacity for r in reactors if r.data.predictedIonCapacity is not None]
    avg_ion  = round(sum(ion_caps) / len(ion_caps), 3) if ion_caps else None

    # History-based avg conversion
    hist_convs = [h.conversion for h in history_slice] if history_slice else []
    avg_conv   = round(sum(hist_convs) / len(hist_convs), 2) if hist_convs else final_conv

    # Energy delta
    energy_end   = state_at_end.cumulativeEnergyCost or 0.0
    energy_delta = round(max(0.0, energy_end - energy_start), 4)

    # Tick duration
    tick_end   = run.tickEnd or state_at_end.tick
    tick_dur   = max(0, tick_end - run.tickStart)

    # Off-spec score (use recipe PSD targets)
    recipe  = run.recipeAtStart
    off_spec = _off_spec_score(avg_psd_spread, avg_psd_mean, recipe.targetPsdMin, recipe.targetPsdMax, quality)

    return RunKPIs(
        runId=run.id,
        maxReactorTemp=round(max_temp, 2),
        maxPeakTemp=round(max_peak, 2),
        minPredictedWBC=round(min_wbc, 2) if min_wbc is not None else None,
        avgConversion=avg_conv,
        finalConversion=round(final_conv, 2),
        totalEnergyCostDelta=energy_delta,
        errorAlertCount=alert_errors,
        warningAlertCount=alert_warnings,
        qualityGradeFinal=quality,
        tickDuration=tick_dur,
        offSpecProxyScore=off_spec,
        avgPsdSpread=avg_psd_spread,
        avgIonCapacity=avg_ion,
    )


def build_comparison(
    run_a: RunRecord,
    run_b: RunRecord,
    kpis_a: RunKPIs,
    kpis_b: RunKPIs,
) -> RunComparison:
    """Diff kpisB - kpisA. Positive delta on max_temp is bad (higher temp). Context in narrative."""

    def _d(a, b):
        if a is None or b is None:
            return None
        return round(b - a, 4)

    delta = RunComparisonDelta(
        maxReactorTemp=_d(kpis_a.maxReactorTemp, kpis_b.maxReactorTemp) or 0.0,
        maxPeakTemp=_d(kpis_a.maxPeakTemp, kpis_b.maxPeakTemp) or 0.0,
        minPredictedWBC=_d(kpis_a.minPredictedWBC, kpis_b.minPredictedWBC),
        avgConversion=_d(kpis_a.avgConversion, kpis_b.avgConversion) or 0.0,
        finalConversion=_d(kpis_a.finalConversion, kpis_b.finalConversion) or 0.0,
        totalEnergyCostDelta=_d(kpis_a.totalEnergyCostDelta, kpis_b.totalEnergyCostDelta) or 0.0,
        errorAlertCount=float((kpis_b.errorAlertCount or 0) - (kpis_a.errorAlertCount or 0)),
        warningAlertCount=float((kpis_b.warningAlertCount or 0) - (kpis_a.warningAlertCount or 0)),
        tickDuration=float((kpis_b.tickDuration or 0) - (kpis_a.tickDuration or 0)),
        offSpecProxyScore=_d(kpis_a.offSpecProxyScore, kpis_b.offSpecProxyScore) or 0.0,
    )

    # Auto-generate a short narrative
    lines = []
    if delta.maxReactorTemp < -2:
        lines.append(f"Run B ran {abs(delta.maxReactorTemp):.1f}°C cooler (peak temperature reduced).")
    elif delta.maxReactorTemp > 2:
        lines.append(f"Run B ran {delta.maxReactorTemp:.1f}°C hotter — higher thermal risk.")

    if delta.minPredictedWBC is not None:
        if delta.minPredictedWBC > 2:
            lines.append(f"Predicted WBC improved by {delta.minPredictedWBC:.1f}% in Run B.")
        elif delta.minPredictedWBC < -2:
            lines.append(f"Predicted WBC dropped by {abs(delta.minPredictedWBC):.1f}% in Run B.")

    if delta.offSpecProxyScore < -0.05:
        lines.append(f"Off-spec proxy score improved by {abs(delta.offSpecProxyScore):.2f} (lower is better).")
    elif delta.offSpecProxyScore > 0.05:
        lines.append(f"Off-spec proxy score worsened by {delta.offSpecProxyScore:.2f} in Run B.")

    if delta.errorAlertCount < 0:
        lines.append(f"Run B had {abs(int(delta.errorAlertCount))} fewer critical alerts.")
    elif delta.errorAlertCount > 0:
        lines.append(f"Run B had {int(delta.errorAlertCount)} more critical alerts.")

    if delta.totalEnergyCostDelta < 0:
        lines.append(f"Run B consumed ${abs(delta.totalEnergyCostDelta):.4f} less energy.")
    elif delta.totalEnergyCostDelta > 0:
        lines.append(f"Run B consumed ${delta.totalEnergyCostDelta:.4f} more energy.")

    if not lines:
        lines.append("Both runs produced similar KPI outcomes. No significant difference detected.")

    narrative = " ".join(lines)

    return RunComparison(
        runA=run_a, runB=run_b,
        kpisA=kpis_a, kpisB=kpis_b,
        delta=delta, narrative=narrative,
    )
