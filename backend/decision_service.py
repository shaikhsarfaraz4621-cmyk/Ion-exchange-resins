"""
decision_service.py — Phase 5
Orchestrates run_ranker, recipe_optimizer, and explainability into a clean
API surface consumed by main.py.
"""
from schemas import (
    RunRecord, RunKPIs, OptimizationGoal, OptimizationConstraint,
    OptimizationResponse, RunRankingResponse, RecipeCandidate,
)
from run_ranker import rank_runs, score_run
from recipe_optimizer import optimize_recipes, predict_kpi_proxy


def get_run_ranking(
    runs: list[RunRecord],
    kpis: dict[str, RunKPIs],
    weights: dict[str, float] | None = None,
) -> RunRankingResponse:
    """Return all completed / aborted runs ranked by KPI score."""
    finished = [r for r in runs if r.status in ("completed", "aborted")]
    return rank_runs(finished, kpis, weights)


def recommend_next_recipe(
    runs: list[RunRecord],
    kpis: dict[str, RunKPIs],
    goal: OptimizationGoal,
    constraints: OptimizationConstraint,
    top_n: int = 3,
) -> OptimizationResponse:
    """
    1. Rank finished runs.
    2. Select the best run as baseline (or use factory defaults if none exist).
    3. Generate and score candidate recipes.
    4. Return OptimizationResponse with summary.
    """
    ranking = get_run_ranking(runs, kpis)

    baseline_run_id: str | None = None
    baseline_kpi: RunKPIs | None = None

    if ranking.ranking:
        top = ranking.ranking[0]
        baseline_run_id = top.runId
        baseline_kpi = kpis.get(top.runId)

    from schemas import RecipeConfig
    if baseline_kpi and baseline_run_id:
        run_obj = next((r for r in runs if r.id == baseline_run_id), None)
        base_recipe = run_obj.recipeAtStart if run_obj else RecipeConfig()
    else:
        base_recipe = RecipeConfig()

    candidates = optimize_recipes(
        base_recipe=base_recipe,
        goal=goal,
        constraints=constraints,
        baseline_kpi=baseline_kpi,
        top_n=top_n,
    )

    # Build human-readable summary
    if not candidates:
        summary = "No feasible candidates found within the given constraints."
    else:
        top_c = candidates[0]
        summary = (
            f"Top candidate (rank 1) achieves score {top_c.score:.3f} with "
            f"confidence {top_c.confidence*100:.0f}%. "
            f"DVB {top_c.recipe.dvbPercent:.1f}%, "
            f"initiator {top_c.recipe.initiatorDosage:.2f}, "
            f"feed '{top_c.recipe.feedRateProfile}'. "
            f"Predicted WBC: {top_c.predictedKPIs.minPredictedWBC:.1f} mg/g, "
            f"conversion: {top_c.predictedKPIs.finalConversion:.1f}%, "
            f"max temp: {top_c.predictedKPIs.maxReactorTemp:.1f} °C."
        )

    return OptimizationResponse(
        baselineRunId=baseline_run_id,
        goal=goal,
        candidates=candidates,
        summary=summary,
    )


def explain_run(
    run_id: str,
    runs: list[RunRecord],
    kpis: dict[str, RunKPIs],
    goal: OptimizationGoal,
    constraints: OptimizationConstraint,
) -> RecipeCandidate | None:
    """
    Return the single best candidate recipe for the given run as a reference.
    Useful for the /decisions/explain endpoint.
    """
    run_obj = next((r for r in runs if r.id == run_id), None)
    if run_obj is None:
        return None

    baseline_kpi = kpis.get(run_id)
    candidates = optimize_recipes(
        base_recipe=run_obj.recipeAtStart,
        goal=goal,
        constraints=constraints,
        baseline_kpi=baseline_kpi,
        top_n=1,
    )
    return candidates[0] if candidates else None
