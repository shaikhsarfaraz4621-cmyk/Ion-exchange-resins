import { useEffect, useState, useCallback } from 'react';
import {
  FaBrain,
  FaMagic,
  FaListOl,
  FaChevronDown,
  FaChevronUp,
  FaCheckCircle,
  FaExclamationTriangle,
  FaLightbulb,
  FaBalanceScale,
  FaSpinner,
  FaSyncAlt,
  FaCheck,
} from 'react-icons/fa';
import { api } from '../../services/api';
import { useSimulationStore } from '../../store/simulationStore';
import type {
  OptimizationGoal,
  OptimizationConstraint,
  OptimizationResponse,
  RunRankingResponse,
  RecipeCandidate,
} from '../../types';

// ── Helpers ────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 75 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : pct >= 50 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${color}`}>
      {pct}% confidence
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-black text-slate-400 w-8 text-right">{pct}</span>
    </div>
  );
}

function KpiChip({ label, value, unit = '' }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-white/5 border border-white/10 rounded-lg px-3 py-2 min-w-[80px]">
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <span className="text-sm font-black text-slate-200">
        {typeof value === 'number' ? value.toFixed(1) : value}
        {unit && <span className="text-[10px] text-slate-500 ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

// ── Candidate Card ─────────────────────────────────────────────────

function CandidateCard({
  candidate,
  onApply,
}: {
  candidate: RecipeCandidate;
  onApply: (c: RecipeCandidate) => void;
}) {
  const [showTrace, setShowTrace] = useState(false);
  const [applied, setApplied] = useState(false);
  const kpi = candidate.predictedKPIs;

  const handleApply = () => {
    onApply(candidate);
    setApplied(true);
    setTimeout(() => setApplied(false), 2500);
  };

  const rankColor =
    candidate.rank === 1 ? 'border-blue-500/40 bg-blue-500/5'
    : candidate.rank === 2 ? 'border-slate-500/30 bg-white/3'
    : 'border-slate-600/20 bg-white/2';

  const rankLabel =
    candidate.rank === 1 ? '🥇 Top Pick'
    : candidate.rank === 2 ? '🥈 Runner-Up'
    : '🥉 Alternative';

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${rankColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-300">{rankLabel}</span>
          <ConfidenceBadge value={candidate.confidence} />
        </div>
        <button
          onClick={handleApply}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            applied
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30'
          }`}
        >
          {applied ? <FaCheck /> : <FaMagic />}
          {applied ? 'Applied!' : 'Apply Recipe'}
        </button>
      </div>

      {/* Score bar */}
      <div>
        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Objective Score</div>
        <ScoreBar score={candidate.score} />
      </div>

      {/* Recipe chips */}
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-md px-2 py-1 font-black">
          DVB {candidate.recipe.dvbPercent.toFixed(1)}%
        </span>
        <span className="bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-md px-2 py-1 font-black">
          Init. {candidate.recipe.initiatorDosage.toFixed(2)}
        </span>
        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md px-2 py-1 font-black">
          M/W {candidate.recipe.monomerWaterRatio.toFixed(2)}
        </span>
        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md px-2 py-1 font-black capitalize">
          {candidate.recipe.feedRateProfile}
        </span>
      </div>

      {/* Predicted KPIs */}
      <div>
        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Predicted KPIs</div>
        <div className="flex flex-wrap gap-2">
          <KpiChip label="WBC" value={kpi.minPredictedWBC ?? 0} unit=" mg/g" />
          <KpiChip label="Conv" value={kpi.finalConversion} unit="%" />
          <KpiChip label="Max Temp" value={kpi.maxReactorTemp} unit="°C" />
          <KpiChip label="Energy Δ" value={`$${kpi.totalEnergyCostDelta.toFixed(2)}`} />
          <KpiChip label="Grade" value={kpi.qualityGradeFinal} />
        </div>
      </div>

      {/* Why? toggle */}
      <button
        onClick={() => setShowTrace(t => !t)}
        className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-blue-400 transition-colors uppercase tracking-widest"
      >
        <FaLightbulb className="text-amber-400" />
        Why this recipe?
        {showTrace ? <FaChevronUp /> : <FaChevronDown />}
      </button>

      {showTrace && (
        <div className="space-y-3 pt-1 border-t border-white/5">
          <TraceSection icon="⚡" title="Triggered Signals" items={candidate.trace.triggeredSignals} color="text-red-400" />
          <TraceSection icon="🔍" title="Cause Hypothesis" items={candidate.trace.causeHypothesis} color="text-amber-400" />
          <TraceSection icon="📈" title="Expected Impact" items={candidate.trace.expectedImpact} color="text-emerald-400" />
          <TraceSection icon="⚖️" title="Tradeoffs" items={candidate.trace.tradeoffs} color="text-slate-400" />
        </div>
      )}
    </div>
  );
}

function TraceSection({
  icon, title, items, color,
}: {
  icon: string; title: string; items: string[]; color: string;
}) {
  return (
    <div>
      <div className={`text-[9px] font-black uppercase tracking-widest mb-1.5 ${color}`}>{icon} {title}</div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-[11px] text-slate-400 flex gap-2">
            <span className="text-slate-600 mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Goal Builder ───────────────────────────────────────────────────

function GoalBuilder({
  goal, setGoal, constraints, setConstraints, onOptimize, loading,
}: {
  goal: OptimizationGoal;
  setGoal: (g: OptimizationGoal) => void;
  constraints: OptimizationConstraint;
  setConstraints: (c: OptimizationConstraint) => void;
  onOptimize: () => void;
  loading: boolean;
}) {
  const priorities: OptimizationGoal['prioritize'][] = ['balanced', 'quality', 'energy', 'throughput'];

  return (
    <div className="bg-white/3 border border-white/10 rounded-xl p-5 space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <FaBrain className="text-violet-400" />
        <span className="text-xs font-black text-slate-200 uppercase tracking-widest">Optimization Goal</span>
      </div>

      {/* Prioritize */}
      <div>
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Optimize for</label>
        <div className="flex flex-wrap gap-2">
          {priorities.map(p => (
            <button
              key={p}
              onClick={() => setGoal({ ...goal, prioritize: p })}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all capitalize ${
                goal.prioritize === p
                  ? 'bg-blue-600/30 text-blue-400 border-blue-500/50'
                  : 'text-slate-400 border-white/10 hover:border-white/20'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI targets */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
            Min WBC (mg/g)
          </label>
          <input
            type="number"
            value={goal.targetWBCMin ?? ''}
            onChange={e => setGoal({ ...goal, targetWBCMin: e.target.value ? +e.target.value : undefined })}
            placeholder="e.g. 90"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
            Min Conversion (%)
          </label>
          <input
            type="number"
            value={goal.targetConversionMin ?? ''}
            onChange={e => setGoal({ ...goal, targetConversionMin: e.target.value ? +e.target.value : undefined })}
            placeholder="e.g. 85"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
            Max Temp (°C)
          </label>
          <input
            type="number"
            value={goal.targetMaxTemp ?? ''}
            onChange={e => setGoal({ ...goal, targetMaxTemp: e.target.value ? +e.target.value : undefined })}
            placeholder="e.g. 95"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
            Max Energy Δ ($)
          </label>
          <input
            type="number"
            value={goal.targetMaxEnergyDelta ?? ''}
            onChange={e => setGoal({ ...goal, targetMaxEnergyDelta: e.target.value ? +e.target.value : undefined })}
            placeholder="e.g. 8"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Constraint DVB range */}
      <div>
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">DVB % Range</label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            value={constraints.dvbMin ?? 1}
            onChange={e => setConstraints({ ...constraints, dvbMin: +e.target.value })}
            placeholder="Min"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
          />
          <span className="text-slate-500 text-sm">–</span>
          <input
            type="number"
            value={constraints.dvbMax ?? 20}
            onChange={e => setConstraints({ ...constraints, dvbMax: +e.target.value })}
            placeholder="Max"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Feed profiles allowed */}
      <div>
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Allowed Feed Profiles</label>
        <div className="flex gap-2">
          {(['conservative', 'balanced', 'aggressive'] as const).map(fp => {
            const allowed = constraints.allowedFeedProfiles ?? ['conservative', 'balanced', 'aggressive'];
            const active = allowed.includes(fp);
            return (
              <button
                key={fp}
                onClick={() => {
                  const next = active
                    ? allowed.filter(f => f !== fp)
                    : [...allowed, fp];
                  setConstraints({ ...constraints, allowedFeedProfiles: next.length ? next : [fp] });
                }}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all capitalize ${
                  active
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'text-slate-600 border-white/10 hover:border-white/20'
                }`}
              >
                {fp}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onOptimize}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50"
      >
        {loading ? <FaSpinner className="animate-spin" /> : <FaMagic />}
        {loading ? 'Generating...' : 'Generate Recommendations'}
      </button>
    </div>
  );
}

// ── Run Ranking Panel ──────────────────────────────────────────────

function RunRankingPanel({ ranking }: { ranking: RunRankingResponse | null }) {
  if (!ranking || ranking.ranking.length === 0) {
    return (
      <div className="bg-white/3 border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <FaListOl className="text-blue-400" />
          <span className="text-xs font-black text-slate-200 uppercase tracking-widest">Run Ranking</span>
        </div>
        <p className="text-sm text-slate-500 text-center py-4">No completed runs to rank yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/3 border border-white/10 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <FaListOl className="text-blue-400" />
        <span className="text-xs font-black text-slate-200 uppercase tracking-widest">Run Ranking</span>
        <span className="text-[10px] text-slate-500 ml-auto">by KPI score</span>
      </div>
      {ranking.ranking.map((item, idx) => (
        <div key={item.runId} className="flex items-start gap-3 bg-white/3 border border-white/8 rounded-lg p-3">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 mt-0.5 ${
            idx === 0 ? 'bg-amber-500/20 text-amber-400' :
            idx === 1 ? 'bg-slate-400/20 text-slate-300' :
            idx === 2 ? 'bg-orange-700/20 text-orange-400' :
            'bg-white/5 text-slate-500'
          }`}>
            {idx + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-black text-slate-200 truncate">{item.label}</span>
              <span className="text-xs font-black text-blue-400 shrink-0">{(item.score * 100).toFixed(1)}</span>
            </div>
            <ScoreBar score={item.score} />
            <div className="mt-2 space-y-1">
              {item.strengths.slice(0, 2).map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                  <FaCheckCircle className="shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
              {item.weaknesses.slice(0, 1).map((w, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] text-amber-400">
                  <FaExclamationTriangle className="shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main View ──────────────────────────────────────────────────────

export default function DecisionView() {
  const setRecipe = useSimulationStore(state => state.setRecipe);

  const [goal, setGoal] = useState<OptimizationGoal>({ prioritize: 'balanced' });
  const [constraints, setConstraints] = useState<OptimizationConstraint>({
    dvbMin: 1, dvbMax: 20,
    initiatorMin: 0.1, initiatorMax: 5,
    monomerWaterMin: 0.1, monomerWaterMax: 1,
    allowedFeedProfiles: ['conservative', 'balanced', 'aggressive'],
  });
  const [optimResult, setOptimResult] = useState<OptimizationResponse | null>(null);
  const [ranking, setRanking] = useState<RunRankingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);

  const loadRanking = useCallback(async () => {
    setRankingLoading(true);
    try {
      const data = await api.getRunRanking();
      setRanking(data);
    } catch {
      // silently fail
    } finally {
      setRankingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  const handleOptimize = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.optimizeDecisions({
        goal: goal as Record<string, unknown>,
        constraints: constraints as Record<string, unknown>,
        topN: 3,
      });
      if (result.status === 'error') {
        setError(result.reason ?? 'Unknown error');
      } else {
        setOptimResult(result);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (candidate: RecipeCandidate) => {
    setRecipe(candidate.recipe);
    setAppliedMsg(
      `Recipe rank #${candidate.rank} applied — DVB ${candidate.recipe.dvbPercent.toFixed(1)}%, ` +
      `initiator ${candidate.recipe.initiatorDosage.toFixed(2)}, ` +
      `feed '${candidate.recipe.feedRateProfile}'`
    );
    setTimeout(() => setAppliedMsg(null), 5000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#080f1a] min-h-0">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
              <span>Operations</span><span>/</span>
              <span className="text-slate-600">Decision Intelligence</span>
            </div>
            <h2 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-3">
              <FaBrain className="text-violet-400" />
              Decision Intelligence
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              AI-assisted recipe optimization, run ranking, and explainable recommendations.
            </p>
          </div>
          <button
            onClick={loadRanking}
            disabled={rankingLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-black text-slate-400 hover:text-slate-200 transition-all uppercase tracking-widest"
          >
            <FaSyncAlt className={rankingLoading ? 'animate-spin' : ''} />
            Refresh Ranking
          </button>
        </div>

        {/* Applied toast */}
        {appliedMsg && (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
            <FaCheckCircle className="text-emerald-400 shrink-0" />
            <span className="text-sm text-emerald-300">{appliedMsg}. Go to <strong>Plant Configuration</strong> to run this recipe.</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <FaExclamationTriangle className="text-red-400 shrink-0" />
            <span className="text-sm text-red-300">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Left column: goal builder + ranking */}
          <div className="xl:col-span-1 space-y-5">
            <GoalBuilder
              goal={goal} setGoal={setGoal}
              constraints={constraints} setConstraints={setConstraints}
              onOptimize={handleOptimize}
              loading={loading}
            />
            <RunRankingPanel ranking={ranking} />
          </div>

          {/* Right column: candidates */}
          <div className="xl:col-span-2 space-y-4">
            {!optimResult && !loading && (
              <div className="flex flex-col items-center justify-center h-80 bg-white/3 border border-white/10 rounded-xl text-center space-y-3">
                <FaBalanceScale className="text-4xl text-slate-600" />
                <div className="text-slate-400 font-black text-sm uppercase tracking-widest">No recommendations yet</div>
                <p className="text-sm text-slate-500 max-w-xs">
                  Set your target KPIs and constraints on the left, then click
                  <strong className="text-slate-400"> Generate Recommendations</strong>.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center h-80 bg-white/3 border border-white/10 rounded-xl">
                <FaSpinner className="text-4xl text-blue-400 animate-spin mb-4" />
                <span className="text-sm text-slate-400 font-black uppercase tracking-widest">Generating candidates...</span>
              </div>
            )}

            {optimResult && !loading && (
              <>
                {/* Summary */}
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-5 py-4">
                  <div className="flex items-center gap-2 mb-1">
                    <FaMagic className="text-blue-400" />
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Summary</span>
                    {optimResult.baselineRunId && (
                      <span className="text-[10px] text-slate-500 ml-auto">
                        Baseline: <span className="text-slate-400 font-black">{optimResult.baselineRunId.slice(0, 8)}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-300">{optimResult.summary}</p>
                </div>

                {/* Candidate cards */}
                <div className="space-y-4">
                  {optimResult.candidates.map(c => (
                    <CandidateCard key={c.rank} candidate={c} onApply={handleApply} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
