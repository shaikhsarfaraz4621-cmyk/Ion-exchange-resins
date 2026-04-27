"""
run_ranker.py — Phase 5
Ranks historical runs by weighted KPI score and produces a structured
RunRankingResponse with human-readable strengths/weaknesses bullets.
"""
from schemas import RunKPIs, RunRecord, RunRankItem, RunRankingResponse

DEFAULT_WEIGHTS: dict[str, float] = {
    "quality":    0.35,
    "energy":     0.20,
    "safety":     0.25,
    "throughput": 0.20,
}


def _quality_score(kpi: RunKPIs) -> float:
    """
    0-1 quality sub-score.
    WBC proxy, conversion, low off-spec, good grade.
    """
    grade_map = {"AAA": 1.0, "AA": 0.75, "B": 0.40, "Fail": 0.0, "Pending": 0.5}
    grade = grade_map.get(kpi.qualityGradeFinal, 0.5)

    wbc_score = min((kpi.minPredictedWBC or 0.0) / 100.0, 1.0)

    conv_score = min(kpi.finalConversion / 100.0, 1.0)

    off_spec = 1.0 - min(kpi.offSpecProxyScore, 1.0)

    return (grade * 0.35 + wbc_score * 0.25 + conv_score * 0.25 + off_spec * 0.15)


def _energy_score(kpi: RunKPIs) -> float:
    """
    0-1 energy sub-score.  Lower energy delta = better.
    Normalise against a "bad" ceiling of $10.
    """
    cost = kpi.totalEnergyCostDelta
    ceiling = 10.0
    return max(0.0, 1.0 - cost / ceiling)


def _safety_score(kpi: RunKPIs) -> float:
    """
    0-1 safety sub-score.
    Low max temp, few errors.
    """
    TRIP_TEMP = 110.0
    temp_ratio = kpi.maxReactorTemp / TRIP_TEMP
    temp_score = max(0.0, 1.0 - temp_ratio)

    error_penalty = min(kpi.errorAlertCount * 0.15, 1.0)
    warn_penalty  = min(kpi.warningAlertCount * 0.05, 0.3)

    return max(0.0, temp_score - error_penalty - warn_penalty)


def _throughput_score(kpi: RunKPIs) -> float:
    """
    0-1 throughput sub-score.
    Shorter tick duration (up to a 300-tick ceiling) = better.
    """
    if kpi.tickDuration <= 0:
        return 0.5
    ceiling = 300
    return max(0.0, 1.0 - kpi.tickDuration / ceiling)


def score_run(kpi: RunKPIs, w: dict[str, float] | None = None) -> float:
    weights = w or DEFAULT_WEIGHTS
    q = _quality_score(kpi)
    e = _energy_score(kpi)
    s = _safety_score(kpi)
    t = _throughput_score(kpi)
    return (
        weights.get("quality", 0.35) * q
        + weights.get("energy", 0.20) * e
        + weights.get("safety", 0.25) * s
        + weights.get("throughput", 0.20) * t
    )


def _strengths_weaknesses(kpi: RunKPIs) -> tuple[list[str], list[str]]:
    strengths: list[str] = []
    weaknesses: list[str] = []

    if kpi.qualityGradeFinal in ("AAA", "AA"):
        strengths.append(f"High quality grade ({kpi.qualityGradeFinal})")
    else:
        weaknesses.append(f"Low quality grade ({kpi.qualityGradeFinal})")

    if kpi.minPredictedWBC is not None:
        if kpi.minPredictedWBC >= 85.0:
            strengths.append(f"Good WBC ({kpi.minPredictedWBC:.1f} mg/g)")
        else:
            weaknesses.append(f"Low WBC ({kpi.minPredictedWBC:.1f} mg/g)")

    if kpi.finalConversion >= 85.0:
        strengths.append(f"High conversion ({kpi.finalConversion:.1f} %)")
    elif kpi.finalConversion < 60.0:
        weaknesses.append(f"Low conversion ({kpi.finalConversion:.1f} %)")

    if kpi.maxReactorTemp <= 85.0:
        strengths.append(f"Safe reactor temp (max {kpi.maxReactorTemp:.1f} °C)")
    elif kpi.maxReactorTemp >= 100.0:
        weaknesses.append(f"Dangerously high temp ({kpi.maxReactorTemp:.1f} °C)")

    if kpi.totalEnergyCostDelta <= 2.0:
        strengths.append(f"Low energy cost (${kpi.totalEnergyCostDelta:.2f})")
    elif kpi.totalEnergyCostDelta >= 6.0:
        weaknesses.append(f"High energy cost (${kpi.totalEnergyCostDelta:.2f})")

    if kpi.errorAlertCount == 0:
        strengths.append("No error alerts")
    else:
        weaknesses.append(f"{kpi.errorAlertCount} error alert(s) during run")

    if kpi.offSpecProxyScore <= 0.2:
        strengths.append("Low off-spec proxy score")
    elif kpi.offSpecProxyScore >= 0.6:
        weaknesses.append(f"High off-spec proxy score ({kpi.offSpecProxyScore:.2f})")

    if not strengths:
        strengths.append("Run completed")
    return strengths, weaknesses


def rank_runs(
    runs: list[RunRecord],
    kpis: dict[str, RunKPIs],
    weights: dict[str, float] | None = None,
) -> RunRankingResponse:
    w = weights or DEFAULT_WEIGHTS
    items: list[tuple[float, RunRankItem]] = []

    for run in runs:
        kpi = kpis.get(run.id)
        if kpi is None:
            continue
        s = score_run(kpi, w)
        strengths, weaknesses = _strengths_weaknesses(kpi)
        items.append((s, RunRankItem(
            runId=run.id,
            label=run.label,
            score=round(s, 4),
            strengths=strengths,
            weaknesses=weaknesses,
        )))

    items.sort(key=lambda x: x[0], reverse=True)
    return RunRankingResponse(
        ranking=[item for _, item in items],
        scoringWeights=w,
    )
