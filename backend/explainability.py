"""
explainability.py — Phase 5
Builds deterministic ExplainabilityTrace objects describing *why* a candidate
recipe differs from the baseline and what impact is expected.
"""
from schemas import RecipeConfig, RunKPIs, ExplainabilityTrace


def _fmt(value: float | None, digits: int = 1) -> str:
    if value is None:
        return "N/A"
    try:
        num = float(value)
    except (TypeError, ValueError):
        return "N/A"
    return f"{num:.{digits}f}"


def _num(value: float | None, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def build_trace(
    baseline_recipe: RecipeConfig,
    candidate_recipe: RecipeConfig,
    baseline_kpi: RunKPIs | None,
    candidate_kpi: RunKPIs,
) -> ExplainabilityTrace:
    signals: list[str] = []
    causes: list[str] = []
    impacts: list[str] = []
    tradeoffs: list[str] = []

    base_dvb = _num(getattr(baseline_recipe, "dvbPercent", None))
    cand_dvb = _num(getattr(candidate_recipe, "dvbPercent", None))
    base_init = _num(getattr(baseline_recipe, "initiatorDosage", None))
    cand_init = _num(getattr(candidate_recipe, "initiatorDosage", None))
    base_mw = _num(getattr(baseline_recipe, "monomerWaterRatio", None))
    cand_mw = _num(getattr(candidate_recipe, "monomerWaterRatio", None))

    dvb_delta = cand_dvb - base_dvb
    init_delta = cand_init - base_init
    mw_delta = cand_mw - base_mw
    feed_changed = candidate_recipe.feedRateProfile  != baseline_recipe.feedRateProfile

    # ── Triggered signals ──────────────────────────────────────────
    if baseline_kpi:
        if baseline_kpi.maxReactorTemp >= 90.0:
            signals.append(f"Baseline max reactor temp elevated ({_fmt(baseline_kpi.maxReactorTemp, 1)} °C)")
        baseline_wbc = baseline_kpi.minPredictedWBC
        if baseline_wbc is None:
            signals.append("Baseline WBC unavailable — using conservative optimization assumptions")
        elif baseline_wbc < 80.0:
            signals.append(f"Baseline WBC below threshold ({_fmt(baseline_wbc, 1)} mg/g)")
        if baseline_kpi.offSpecProxyScore >= 0.4:
            signals.append(f"Baseline off-spec proxy score high ({_fmt(baseline_kpi.offSpecProxyScore, 2)})")
        if baseline_kpi.finalConversion < 75.0:
            signals.append(f"Baseline conversion low ({_fmt(baseline_kpi.finalConversion, 1)} %)")
        if baseline_kpi.errorAlertCount > 0:
            signals.append(f"{baseline_kpi.errorAlertCount} error alert(s) in baseline run")

    if not signals:
        signals.append("Optimizing for improved performance vs baseline")

    # ── Cause hypothesis ──────────────────────────────────────────
    if abs(dvb_delta) > 0.1:
        direction = "higher" if dvb_delta > 0 else "lower"
        causes.append(
            f"DVB % {direction} by {_fmt(abs(dvb_delta), 1)} pp — adjusts crosslink density and thermal load"
        )
    if abs(init_delta) > 0.05:
        direction = "higher" if init_delta > 0 else "lower"
        causes.append(
            f"Initiator dosage {direction} by {_fmt(abs(init_delta), 2)} — modifies initiation rate and exotherm"
        )
    if abs(mw_delta) > 0.02:
        direction = "higher" if mw_delta > 0 else "lower"
        causes.append(
            f"Monomer/water ratio {direction} by {_fmt(abs(mw_delta), 2)} — affects droplet size and PSD"
        )
    if feed_changed:
        causes.append(
            f"Feed profile changed from '{baseline_recipe.feedRateProfile}' "
            f"to '{candidate_recipe.feedRateProfile}' — controls feed-rate pacing"
        )
    if not causes:
        causes.append("Minor parameter tuning relative to baseline")

    # ── Expected impact ───────────────────────────────────────────
    if baseline_kpi:
        temp_delta = _num(candidate_kpi.maxReactorTemp) - _num(baseline_kpi.maxReactorTemp)
        if abs(temp_delta) >= 1.0:
            word = "reduce" if temp_delta < 0 else "increase"
            impacts.append(f"Expected to {word} max reactor temp by {_fmt(abs(temp_delta), 1)} °C")

        wbc_b = baseline_kpi.minPredictedWBC or 0.0
        wbc_c = candidate_kpi.minPredictedWBC or 0.0
        wbc_delta = wbc_c - wbc_b
        if abs(wbc_delta) >= 0.5:
            word = "improve" if wbc_delta > 0 else "reduce"
            impacts.append(f"Expected to {word} WBC by {_fmt(abs(wbc_delta), 1)} mg/g")

        conv_delta = _num(candidate_kpi.finalConversion) - _num(baseline_kpi.finalConversion)
        if abs(conv_delta) >= 1.0:
            word = "improve" if conv_delta > 0 else "reduce"
            impacts.append(f"Expected to {word} conversion by {_fmt(abs(conv_delta), 1)} pp")

        energy_delta = _num(candidate_kpi.totalEnergyCostDelta) - _num(baseline_kpi.totalEnergyCostDelta)
        if abs(energy_delta) >= 0.1:
            word = "reduce" if energy_delta < 0 else "increase"
            impacts.append(f"Expected to {word} energy cost by ${_fmt(abs(energy_delta), 2)}")

    if not impacts:
        impacts.append("Marginal improvement across quality and safety metrics")

    # ── Tradeoffs ─────────────────────────────────────────────────
    if dvb_delta > 1.0:
        tradeoffs.append("Higher DVB may slightly increase viscosity and agitation power draw")
    if dvb_delta < -1.0:
        tradeoffs.append("Lower DVB may reduce crosslink density and long-term resin rigidity")
    if init_delta > 0.3:
        tradeoffs.append("Higher initiator increases exotherm risk — monitor jacket cooling")
    if init_delta < -0.3:
        tradeoffs.append("Lower initiator slows initiation — may extend batch duration")
    if candidate_recipe.feedRateProfile == "aggressive":
        tradeoffs.append("Aggressive feed increases throughput but raises thermal stress")
    if candidate_recipe.feedRateProfile == "conservative":
        tradeoffs.append("Conservative feed reduces thermal stress at cost of throughput")
    if not tradeoffs:
        tradeoffs.append("No significant tradeoffs anticipated")

    return ExplainabilityTrace(
        triggeredSignals=signals,
        causeHypothesis=causes,
        expectedImpact=impacts,
        tradeoffs=tradeoffs,
    )
