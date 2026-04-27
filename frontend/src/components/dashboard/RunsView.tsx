/**
 * Phase 4 — RunsView
 * Manage named simulation runs, view KPIs, compare two runs side-by-side,
 * and export evidence for client demos.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  FaPlay, FaStop, FaBan, FaDownload, FaChartBar, FaExchangeAlt,
  FaFlask, FaCheckCircle, FaTimesCircle, FaClock, FaThermometerHalf,
  FaBolt, FaTimes, FaTrash,
} from 'react-icons/fa';
import { api } from '../../services/api';
import type { RunWithKPIs, RunComparison } from '../../types';
import { useSimulationStore } from '../../store/simulationStore';

// ─── helpers ─────────────────────────────────────────────────────

const statusColor: Record<string, string> = {
  active:    'text-emerald-400',
  completed: 'text-sky-400',
  aborted:   'text-red-400',
};

const gradeColor: Record<string, string> = {
  AAA:     'text-emerald-400',
  AA:      'text-sky-400',
  B:       'text-yellow-400',
  Fail:    'text-red-500',
  Pending: 'text-gray-400',
};

function fmt(v: number | undefined | null, dec = 1, suffix = '') {
  if (v === undefined || v === null) return '—';
  return `${v.toFixed(dec)}${suffix}`;
}

function deltaChip(value: number, lowerIsBetter = false, unit = '') {
  if (value === 0) return <span className="text-gray-500 text-xs">±0{unit}</span>;
  const positive = lowerIsBetter ? value < 0 : value > 0;
  const arrow    = value > 0 ? '▲' : '▼';
  const color    = positive ? 'text-emerald-400' : 'text-red-400';
  return <span className={`${color} text-xs font-semibold`}>{arrow} {Math.abs(value).toFixed(2)}{unit}</span>;
}

// ─── sub-components ──────────────────────────────────────────────

function KpiRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-xs py-0.5">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-mono">{value}</span>
    </div>
  );
}

function RunCard({
  rk,
  activeRunId,
  onEnd,
  onAbort,
  onExport,
  onDelete,
  onSelect,
  selected,
}: {
  rk: RunWithKPIs;
  activeRunId: string | null;
  onEnd: (id: string) => void;
  onAbort: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  selected: boolean;
}) {
  const { run, kpis } = rk;
  const isActive = run.id === activeRunId;

  return (
    <div
      onClick={() => onSelect(run.id)}
      className={`rounded-xl border cursor-pointer transition-all p-4 ${
        selected
          ? 'border-sky-500 bg-sky-900/20'
          : 'border-white/10 bg-white/5 hover:border-white/25'
      }`}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-sm">{run.label}</span>
            <span className={`text-[10px] font-bold uppercase ${statusColor[run.status]}`}>
              {run.status}
            </span>
            {run.scenarioTag && (
              <span className="text-[10px] bg-violet-800/40 text-violet-300 px-1.5 py-0.5 rounded">
                {run.scenarioTag}
              </span>
            )}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            ID: {run.id} · Tick {run.tickStart}
            {run.tickEnd !== undefined ? `→${run.tickEnd}` : '…'}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isActive && (
            <>
              <button
                onClick={e => { e.stopPropagation(); onEnd(run.id); }}
                title="End run & compute KPIs"
                className="p-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/60 text-emerald-400 transition"
              >
                <FaStop size={11} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onAbort(run.id); }}
                title="Abort run"
                className="p-1.5 rounded-lg bg-red-600/30 hover:bg-red-600/60 text-red-400 transition"
              >
                <FaBan size={11} />
              </button>
            </>
          )}
          {run.status === 'completed' && (
            <button
              onClick={e => { e.stopPropagation(); onExport(run.id); }}
              title="Export JSON"
              className="p-1.5 rounded-lg bg-sky-600/30 hover:bg-sky-600/60 text-sky-400 transition"
            >
              <FaDownload size={11} />
            </button>
          )}
          {!isActive && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(run.id); }}
              title="Delete run"
              className="p-1.5 rounded-lg bg-red-700/20 hover:bg-red-700/50 text-red-400 transition"
            >
              <FaTrash size={11} />
            </button>
          )}
        </div>
      </div>

      {/* recipe snapshot */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {[
          { k: 'DVB', v: `${run.recipeAtStart.dvbPercent}%` },
          { k: 'Init', v: `${run.recipeAtStart.initiatorDosage}` },
          { k: 'M:W', v: `${run.recipeAtStart.monomerWaterRatio}` },
          { k: 'Feed', v: run.recipeAtStart.feedRateProfile },
        ].map(({ k, v }) => (
          <span key={k} className="text-[10px] bg-white/5 rounded px-1.5 py-0.5 text-gray-300">
            <span className="text-gray-500">{k}: </span>{v}
          </span>
        ))}
      </div>

      {/* KPIs (if available) */}
      {kpis ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1 border-t border-white/5 pt-2">
          <KpiRow label="Max Temp" value={<span className="flex items-center gap-1"><FaThermometerHalf className="text-orange-400" />{fmt(kpis.maxReactorTemp, 1, '°C')}</span>} />
          <KpiRow label="Final Conv." value={`${fmt(kpis.finalConversion, 1)}%`} />
          <KpiRow label="WBC" value={kpis.minPredictedWBC !== undefined ? fmt(kpis.minPredictedWBC, 1, '%') : '—'} />
          <KpiRow label="Energy Δ" value={<span className="flex items-center gap-1"><FaBolt className="text-yellow-400" />${fmt(kpis.totalEnergyCostDelta, 4)}</span>} />
          <KpiRow label="Quality" value={<span className={gradeColor[kpis.qualityGradeFinal]}>{kpis.qualityGradeFinal}</span>} />
          <KpiRow label="Alerts (E/W)" value={`${kpis.errorAlertCount}/${kpis.warningAlertCount}`} />
          <KpiRow label="Off-spec" value={fmt(kpis.offSpecProxyScore, 3)} />
          <KpiRow label="Ticks" value={<span className="flex items-center gap-1"><FaClock className="text-gray-400" />{kpis.tickDuration}</span>} />
        </div>
      ) : (
        <p className="text-[10px] text-gray-600 mt-1 border-t border-white/5 pt-2">
          {run.status === 'active' ? 'KPIs computed when run ends.' : 'No KPIs available.'}
        </p>
      )}
    </div>
  );
}


function ComparePanel({
  comparison,
  onClose,
}: {
  comparison: RunComparison;
  onClose: () => void;
}) {
  const { runA, runB, kpisA, kpisB, delta, narrative } = comparison;

  const rows: { label: string; a: string; b: string; d: React.ReactNode; lowerBetter?: boolean }[] = [
    {
      label: 'Max Reactor Temp',
      a: fmt(kpisA.maxReactorTemp, 1, '°C'),
      b: fmt(kpisB.maxReactorTemp, 1, '°C'),
      d: deltaChip(delta.maxReactorTemp, true, '°C'),
    },
    {
      label: 'Final Conversion',
      a: fmt(kpisA.finalConversion, 1, '%'),
      b: fmt(kpisB.finalConversion, 1, '%'),
      d: deltaChip(delta.finalConversion, false, '%'),
    },
    {
      label: 'Min WBC',
      a: kpisA.minPredictedWBC !== undefined ? fmt(kpisA.minPredictedWBC, 1, '%') : '—',
      b: kpisB.minPredictedWBC !== undefined ? fmt(kpisB.minPredictedWBC, 1, '%') : '—',
      d: delta.minPredictedWBC !== undefined ? deltaChip(delta.minPredictedWBC, false, '%') : <span className="text-gray-500 text-xs">—</span>,
    },
    {
      label: 'Energy Δ',
      a: `$${fmt(kpisA.totalEnergyCostDelta, 4)}`,
      b: `$${fmt(kpisB.totalEnergyCostDelta, 4)}`,
      d: deltaChip(delta.totalEnergyCostDelta, true),
    },
    {
      label: 'Quality Grade',
      a: kpisA.qualityGradeFinal,
      b: kpisB.qualityGradeFinal,
      d: <span className="text-gray-400 text-xs">—</span>,
    },
    {
      label: 'Error Alerts',
      a: String(kpisA.errorAlertCount),
      b: String(kpisB.errorAlertCount),
      d: deltaChip(delta.errorAlertCount, true),
    },
    {
      label: 'Off-spec Score',
      a: fmt(kpisA.offSpecProxyScore, 3),
      b: fmt(kpisB.offSpecProxyScore, 3),
      d: deltaChip(delta.offSpecProxyScore, true),
    },
    {
      label: 'Tick Duration',
      a: String(kpisA.tickDuration),
      b: String(kpisB.tickDuration),
      d: deltaChip(delta.tickDuration, true),
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#0f1929] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <FaExchangeAlt className="text-sky-400" />
            Run Comparison
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><FaTimes /></button>
        </div>

        {/* run labels */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div />
          <div className="text-center text-xs font-bold text-sky-300 bg-sky-900/20 rounded p-1.5">{runA.label}</div>
          <div className="text-center text-xs font-bold text-violet-300 bg-violet-900/20 rounded p-1.5">{runB.label}</div>
        </div>

        {/* table */}
        <div className="space-y-1">
          {rows.map(row => (
            <div key={row.label} className="grid grid-cols-3 gap-2 text-xs items-center py-1 border-b border-white/5">
              <span className="text-gray-400">{row.label}</span>
              <span className="text-center text-sky-200 font-mono">{row.a}</span>
              <span className="text-center text-violet-200 font-mono flex items-center justify-center gap-1">
                {row.b}
                <span className="ml-1">{row.d}</span>
              </span>
            </div>
          ))}
        </div>

        {/* narrative */}
        <div className="mt-4 p-3 bg-emerald-900/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 leading-relaxed">
          <span className="font-bold text-emerald-400 mr-1">Summary:</span>
          {narrative}
        </div>

        {/* recipe diff */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[{ run: runA, label: 'Recipe A', cls: 'border-sky-500/30' }, { run: runB, label: 'Recipe B', cls: 'border-violet-500/30' }].map(({ run, label, cls }) => (
            <div key={run.id} className={`rounded-lg border ${cls} bg-white/5 p-3`}>
              <p className="text-[10px] font-bold text-gray-400 mb-1">{label}</p>
              {[
                ['DVB', `${run.recipeAtStart.dvbPercent}%`],
                ['Initiator', String(run.recipeAtStart.initiatorDosage)],
                ['M:W Ratio', String(run.recipeAtStart.monomerWaterRatio)],
                ['Feed', run.recipeAtStart.feedRateProfile],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-[10px]">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-gray-200 font-mono">{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Start Run Modal ─────────────────────────────────────────────

function StartRunModal({ onStart, onClose }: { onStart: (label: string, tag: string) => void; onClose: () => void }) {
  const [label, setLabel] = useState('');
  const [tag, setTag] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#0f1929] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-white font-bold mb-4">Start New Run</h3>
        <input
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 mb-3 focus:outline-none focus:border-sky-500"
          placeholder="Run label (e.g. Baseline, High-DVB Test)"
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
        <input
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 mb-4 focus:outline-none focus:border-sky-500"
          placeholder="Scenario tag (optional, e.g. baseline, dvb-stress)"
          value={tag}
          onChange={e => setTag(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={() => onStart(label || `Run ${Date.now()}`, tag)}
            className="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold py-2 rounded-lg transition"
          >
            Start
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 text-sm py-2 rounded-lg transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main RunsView ────────────────────────────────────────────────

export default function RunsView() {
  const isSimulating = useSimulationStore(s => s.isSimulating);
  const setIsSimulating = useSimulationStore(s => s.setIsSimulating);
  const [runs, setRuns] = useState<RunWithKPIs[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<RunComparison | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const [list, activeRes] = await Promise.all([api.listRuns(), api.getActiveRun()]);
    setRuns(list as RunWithKPIs[]);
    setActiveRunId(activeRes.active ? activeRes.runId : null);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleStart = async (label: string, tag: string) => {
    setShowStartModal(false);
    setError(null);
    setLoading(true);
    try {
      // Ensure ticks continue while user remains on Runs view.
      if (!isSimulating) {
        await api.startSimulation();
        setIsSimulating(true);
      }
      const res = await api.startRun(label, tag || undefined);
      if (res.status === 'error') { setError(res.reason); }
      else { await refresh(); }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEnd = async (runId: string) => {
    setError(null);
    setLoading(true);
    try {
      await api.endRun(runId);
      await refresh();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleAbort = async (runId: string) => {
    setError(null);
    setLoading(true);
    try {
      await api.abortRun(runId);
      await refresh();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleExport = async (runId: string) => {
    try {
      const data = await api.exportRun(runId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `run-${runId}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setError(e.message); }
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      return [...prev, id];
    });
  };

  const handleCompare = async () => {
    if (selectedIds.length !== 2) return;
    setError(null);
    try {
      const result = await api.compareRuns(selectedIds[0], selectedIds[1]);
      if (result.status === 'error') { setError(result.reason); return; }
      setComparison(result as RunComparison);
    } catch (e: any) { setError(e.message); }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    const ok = window.confirm(`Delete ${selectedIds.length} selected run(s)? This cannot be undone.`);
    if (!ok) return;

    setError(null);
    setLoading(true);
    try {
      const result = await api.deleteRuns(selectedIds);
      const skipped = Array.isArray(result?.skipped) ? result.skipped : [];
      if (skipped.length > 0) {
        const activeSkipped = skipped.filter((s: any) => s.reason === 'active_run').length;
        const notFound = skipped.filter((s: any) => s.reason === 'not_found').length;
        const notes: string[] = [];
        if (activeSkipped) notes.push(`${activeSkipped} active`);
        if (notFound) notes.push(`${notFound} not found`);
        setError(`Some runs were not deleted (${notes.join(', ')}).`);
      }
      setSelectedIds([]);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSingle = async (runId: string) => {
    const ok = window.confirm('Delete this run? This cannot be undone.');
    if (!ok) return;
    setError(null);
    setLoading(true);
    try {
      const result = await api.deleteRuns([runId]);
      const skipped = Array.isArray(result?.skipped) ? result.skipped : [];
      if (skipped.length > 0) {
        setError('Could not delete this run (possibly active).');
      }
      setSelectedIds(prev => prev.filter(id => id !== runId));
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const completedCount = runs.filter(r => r.run.status === 'completed').length;

  return (
    <div className="p-6 h-full overflow-y-auto">
      {/* title row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-xl font-bold">Run Records & Evidence</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            {completedCount} completed · {runs.length} total · select runs to compare/delete
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600/30 hover:bg-red-600/60 disabled:opacity-40 text-red-300 rounded-lg text-sm transition"
            >
              <FaTrash size={12} />
              Delete Selected ({selectedIds.length})
            </button>
          )}
          {selectedIds.length === 2 && (
            <button
              onClick={handleCompare}
              className="flex items-center gap-1.5 px-3 py-2 bg-violet-600/30 hover:bg-violet-600/60 text-violet-300 rounded-lg text-sm transition"
            >
              <FaExchangeAlt size={12} />
              Compare
            </button>
          )}
          <button
            onClick={() => setShowStartModal(true)}
            disabled={!!activeRunId || loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition"
          >
            <FaPlay size={11} />
            {activeRunId ? 'Run Active' : 'New Run'}
          </button>
        </div>
      </div>

      {/* active run banner */}
      {activeRunId && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-xl text-sm text-emerald-300">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Run <span className="font-mono font-bold">{activeRunId}</span> is active — end or abort it before starting a new one.
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-xl text-sm text-red-300 flex items-center gap-2">
          <FaTimesCircle className="text-red-400 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200"><FaTimes size={12} /></button>
        </div>
      )}

      {/* instruction when empty */}
      {runs.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <FaChartBar size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No runs yet. Start a run to record KPIs and compare recipes.</p>
        </div>
      )}

      {/* select hint */}
      {selectedIds.length > 0 && selectedIds.length < 2 && (
        <div className="mb-3 text-xs text-sky-400 bg-sky-900/10 border border-sky-500/20 rounded-lg px-3 py-2">
          <FaCheckCircle className="inline mr-1" />
          {selectedIds.length === 1 ? 'Select one more run to enable comparison.' : ''}
        </div>
      )}
      {selectedIds.length > 2 && (
        <div className="mb-3 text-xs text-amber-400 bg-amber-900/10 border border-amber-500/20 rounded-lg px-3 py-2">
          Compare works with exactly 2 selected runs. Delete supports any number.
        </div>
      )}

      {/* run cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {runs.map(rk => (
          <RunCard
            key={rk.run.id}
            rk={rk}
            activeRunId={activeRunId}
            onEnd={handleEnd}
            onAbort={handleAbort}
            onExport={handleExport}
            onDelete={handleDeleteSingle}
            onSelect={handleSelect}
            selected={selectedIds.includes(rk.run.id)}
          />
        ))}
      </div>

      {/* legend */}
      {runs.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3 text-[10px] text-gray-500">
          <span><FaFlask className="inline mr-1 text-violet-400" />Click cards to select runs (multi-select enabled)</span>
          <span><FaStop className="inline mr-1 text-emerald-400" />End run to compute KPIs</span>
          <span><FaBan className="inline mr-1 text-red-400" />Abort stops run quickly</span>
          <span><FaTrash className="inline mr-1 text-red-400" />Delete Selected removes old run cards</span>
          <span><FaDownload className="inline mr-1 text-sky-400" />Export run as JSON</span>
        </div>
      )}

      {/* modals */}
      {showStartModal && (
        <StartRunModal onStart={handleStart} onClose={() => setShowStartModal(false)} />
      )}
      {comparison && (
        <ComparePanel comparison={comparison} onClose={() => setComparison(null)} />
      )}
    </div>
  );
}
