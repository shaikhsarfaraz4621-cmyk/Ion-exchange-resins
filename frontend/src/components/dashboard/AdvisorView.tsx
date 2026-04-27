import React, { useEffect, useState } from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { api } from '../../services/api';
import type { StructuredRecommendation, MitigationEvent } from '../../types';
import {
  FaThermometerHalf, FaTint, FaAtom, FaMedal, FaGasPump,
  FaDatabase, FaExclamationTriangle, FaCheckCircle, FaEye,
  FaPlay, FaHistory, FaChevronDown, FaChevronUp
} from 'react-icons/fa';

// ─── Severity helpers ────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    badge: 'bg-red-100 text-red-700',
    icon: <FaExclamationTriangle className="text-red-500" />,
    label: 'CRITICAL',
    dot: 'bg-red-500',
  },
  risk: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    icon: <FaExclamationTriangle className="text-orange-400" />,
    label: 'RISK',
    dot: 'bg-orange-400',
  },
  watch: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700',
    icon: <FaEye className="text-yellow-500" />,
    label: 'WATCH',
    dot: 'bg-yellow-400',
  },
  safe: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    icon: <FaCheckCircle className="text-emerald-500" />,
    label: 'SAFE',
    dot: 'bg-emerald-400',
  },
};

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  thermal:   <FaThermometerHalf className="text-red-400" />,
  psd:       <FaAtom className="text-blue-400" />,
  crosslink: <FaTint className="text-purple-400" />,
  quality:   <FaMedal className="text-amber-400" />,
  feed:      <FaGasPump className="text-teal-400" />,
  buffer:    <FaDatabase className="text-indigo-400" />,
};

// ─── Recommendation Card ─────────────────────────────────────────

const RecCard: React.FC<{
  rec: StructuredRecommendation;
  onApply: (rec: StructuredRecommendation) => void;
  applying: boolean;
}> = ({ rec, onApply, applying }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[rec.severity] ?? SEVERITY_CONFIG.watch;

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 transition-all`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0">{DOMAIN_ICONS[rec.domain] ?? <FaAtom className="text-slate-400" />}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${cfg.badge}`}>
                {cfg.label}
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                {rec.domain}
              </span>
              {rec.nodeLabel && (
                <span className="text-[9px] font-bold text-slate-500 truncate">
                  · {rec.nodeLabel}
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-slate-800 mt-1 leading-snug">{rec.condition}</p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
        >
          {expanded ? <FaChevronUp className="text-xs" /> : <FaChevronDown className="text-xs" />}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Root Cause</p>
            <p className="text-xs text-slate-700 leading-relaxed">{rec.rootCause}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Recommended Action</p>
            <p className="text-xs text-slate-700 leading-relaxed">{rec.action}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Expected Impact</p>
            <p className="text-xs text-slate-600 leading-relaxed">{rec.expectedImpact}</p>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] text-slate-400 font-mono">{rec.timestamp}</span>
            {rec.command && (
              <button
                onClick={() => onApply(rec)}
                disabled={applying}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
              >
                <FaPlay className="text-[8px]" />
                {applying ? 'Applying…' : `Apply ${rec.command}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Mitigation Log Row ──────────────────────────────────────────

const MitigationRow: React.FC<{ evt: MitigationEvent }> = ({ evt }) => {
  const [expanded, setExpanded] = useState(false);

  const delta = (before: number | undefined, after: number | undefined, unit: string, lowerBetter = true) => {
    if (before == null || after == null) return null;
    const diff = after - before;
    const improved = lowerBetter ? diff < 0 : diff > 0;
    return (
      <span className={`text-[10px] font-bold ${improved ? 'text-emerald-600' : 'text-red-500'}`}>
        {before.toFixed(1)}{unit} → {after.toFixed(1)}{unit}
        {' '}({diff > 0 ? '+' : ''}{diff.toFixed(1)}{unit})
      </span>
    );
  };

  return (
    <div className="border border-slate-100 rounded-xl bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full shrink-0 ${evt.resolved ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <div>
            <p className="text-xs font-black text-slate-800">{evt.action} · {evt.nodeLabel}</p>
            <p className="text-[9px] text-slate-400 font-mono">Tick {evt.tick} · {evt.timestamp}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${evt.resolved ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            {evt.resolved ? 'Resolved' : 'Pending'}
          </span>
          <button onClick={() => setExpanded(v => !v)} className="text-slate-400 hover:text-slate-600 p-1">
            {expanded ? <FaChevronUp className="text-xs" /> : <FaChevronDown className="text-xs" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Trigger</p>
          <p className="text-xs text-slate-600 mb-2">{evt.triggerCondition}</p>
          <div className="grid grid-cols-2 gap-2">
            {evt.beforeTemp != null && (
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-[9px] text-slate-400 font-black uppercase mb-0.5">Temperature</p>
                {delta(evt.beforeTemp, evt.afterTemp, '°C', true) ?? (
                  <span className="text-[10px] text-slate-500">Before: {evt.beforeTemp.toFixed(1)}°C</span>
                )}
              </div>
            )}
            {evt.beforeRpm != null && (
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-[9px] text-slate-400 font-black uppercase mb-0.5">RPM</p>
                {delta(evt.beforeRpm, evt.afterRpm, '', true) ?? (
                  <span className="text-[10px] text-slate-500">Before: {evt.beforeRpm}</span>
                )}
              </div>
            )}
            {evt.beforePsdSpread != null && (
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-[9px] text-slate-400 font-black uppercase mb-0.5">PSD Spread</p>
                {delta(evt.beforePsdSpread, evt.afterPsdSpread, 'mm', true) ?? (
                  <span className="text-[10px] text-slate-500">Before: {evt.beforePsdSpread.toFixed(3)}mm</span>
                )}
              </div>
            )}
            {evt.beforeWBC != null && (
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-[9px] text-slate-400 font-black uppercase mb-0.5">WBC</p>
                {delta(evt.beforeWBC, evt.afterWBC, '%', false) ?? (
                  <span className="text-[10px] text-slate-500">Before: {evt.beforeWBC.toFixed(1)}%</span>
                )}
              </div>
            )}
            {evt.beforeQuality && (
              <div className="bg-slate-50 rounded-lg p-2 col-span-2">
                <p className="text-[9px] text-slate-400 font-black uppercase mb-0.5">Quality Grade</p>
                <span className="text-xs font-black text-slate-700">
                  {evt.beforeQuality}
                  {evt.afterQuality && evt.afterQuality !== evt.beforeQuality
                    ? <> → <span className="text-emerald-600">{evt.afterQuality}</span></>
                    : evt.afterQuality ? <> → {evt.afterQuality}</> : null
                  }
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main AdvisorView ────────────────────────────────────────────

export const AdvisorView: React.FC = () => {
  const rawRecs = useSimulationStore(s => s.recommendations);
  const recommendations = Array.isArray(rawRecs) ? rawRecs : [];
  const rawLog = useSimulationStore(s => s.mitigationLog);
  const mitigationLog = Array.isArray(rawLog) ? rawLog : [];
  const refreshRecs     = useSimulationStore(s => s.refreshRecommendations);
  const refreshLog      = useSimulationStore(s => s.refreshMitigationLog);
  const isSimulating    = useSimulationStore(s => s.isSimulating);
  const tick            = useSimulationStore(s => s.tick);

  const [tab, setTab]         = useState<'recs' | 'log'>('recs');
  const [applying, setApplying] = useState<string | null>(null);
  const [filterSev, setFilterSev] = useState<string>('all');

  // Load on mount and when simulation pauses
  useEffect(() => {
    refreshRecs();
    refreshLog();
  }, [isSimulating, tick]);

  const handleApply = async (rec: StructuredRecommendation) => {
    if (!rec.command || !rec.commandValue) return;
    setApplying(rec.id);
    try {
      await api.applyRecommendation(rec.command, rec.commandValue, rec.condition);
      await refreshLog();
      await refreshRecs();
    } finally {
      setApplying(null);
    }
  };

  const filteredRecs = filterSev === 'all'
    ? recommendations
    : recommendations.filter(r => r.severity === filterSev);

  const counts = {
    critical: recommendations.filter(r => r.severity === 'critical').length,
    risk:     recommendations.filter(r => r.severity === 'risk').length,
    watch:    recommendations.filter(r => r.severity === 'watch').length,
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              <span>Enterprise</span><span>/</span>
              <span className="text-slate-600">Prescriptive Intelligence</span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Advisor — Phase 3</h2>
            <p className="text-xs text-slate-500 mt-1">
              Structured recommendations with condition → root cause → action → expected impact
            </p>
          </div>
          <button
            onClick={() => { refreshRecs(); refreshLog(); }}
            className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            Refresh
          </button>
        </div>

        {/* Summary band */}
        <div className="grid grid-cols-3 gap-4">
          {(['critical', 'risk', 'watch'] as const).map(sev => {
            const cfg = SEVERITY_CONFIG[sev];
            return (
              <div key={sev} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 cursor-pointer ${filterSev === sev ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                onClick={() => setFilterSev(filterSev === sev ? 'all' : sev)}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={`text-[9px] font-black uppercase tracking-widest ${cfg.badge.split(' ')[1]}`}>{cfg.label}</span>
                </div>
                <p className="text-2xl font-black text-slate-800">{counts[sev]}</p>
                <p className="text-[9px] text-slate-400 font-bold">active signals</p>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {([['recs', 'Recommendations'], ['log', 'Mitigation Log']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                tab === key ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
              {key === 'log' && mitigationLog.length > 0 && (
                <span className="ml-1.5 text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-black">
                  {mitigationLog.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Recommendations tab */}
        {tab === 'recs' && (
          <div className="space-y-3">
            {/* Domain filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Filter:</span>
              {['all', 'critical', 'risk', 'watch'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilterSev(f)}
                  className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border transition-all ${
                    filterSev === f
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {filteredRecs.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
                <FaCheckCircle className="text-emerald-400 text-2xl mx-auto mb-2" />
                <p className="text-sm font-black text-emerald-700">All systems nominal</p>
                <p className="text-xs text-emerald-600 mt-1">
                  {isSimulating ? 'No active signals for the selected severity.' : 'Start the simulation to generate live recommendations.'}
                </p>
              </div>
            ) : (
              filteredRecs.map(rec => (
                <RecCard
                  key={rec.id}
                  rec={rec}
                  onApply={handleApply}
                  applying={applying === rec.id}
                />
              ))
            )}
          </div>
        )}

        {/* Mitigation log tab */}
        {tab === 'log' && (
          <div className="space-y-3">
            {mitigationLog.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                <FaHistory className="text-slate-300 text-2xl mx-auto mb-2" />
                <p className="text-sm font-black text-slate-500">No mitigations applied yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Apply a recommendation to start tracking before/after deltas.
                </p>
              </div>
            ) : (
              mitigationLog.map(evt => (
                <MitigationRow key={evt.id} evt={evt} />
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
};
