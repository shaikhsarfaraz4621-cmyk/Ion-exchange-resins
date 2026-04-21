import React from 'react';
import { FaChartLine, FaExclamationTriangle, FaInfoCircle, FaClock } from 'react-icons/fa';
import { GlassCard } from '../shared/GlassCard';
import { useSimulationStore } from '../../store/simulationStore';

export const AnalyticsSidebar: React.FC = () => {
  const { globalAlerts, nodes, pollInterval, setPollInterval } = useSimulationStore();
  const BASE_INTERVAL_MS = 2000;
  const SIM_MINUTES_PER_TICK = 1;
  const speedMultiplier = BASE_INTERVAL_MS / pollInterval;
  const ticksPerSecond = 1000 / pollInterval;
  const simMinutesPerSecond = ticksPerSecond * SIM_MINUTES_PER_TICK;
  const activeReactor = nodes.find(n => n.type === 'reactor' && n.data.status === 'running') || nodes.find(n => n.type === 'reactor');
  const d = activeReactor?.data;
  
  const stats = [
    { label: 'System Pressure', val: `${d?.pressure || 1.2}b`, status: (d?.pressure || 0) > 5 ? 'critical' : 'optimal' },
    { label: 'Avg PSD Mean', val: `${d?.psdMean || 0.62}mm`, status: (d?.psdMean || 0.62) > 0.65 ? 'variance' : 'in-spec' },
    { label: 'Exothermic Delta', val: `+${d?.exothermicDelta || 0}°C`, status: (d?.exothermicDelta || 0) > 3 ? 'rising' : 'nominal' }
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* Temporal Control Slider */}
      <div className="pro-card !p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20">
        <div className="flex items-center justify-between mb-4 uppercase tracking-[0.2em] text-[10px] opacity-80 font-black">
          <span>Temporal Control</span>
          <FaClock />
        </div>
        <input 
           type="range" min="100" max="4000" step="100" 
           value={pollInterval}
           className="w-full h-1.5 accent-white rounded-full cursor-pointer"
           onChange={(e) => setPollInterval(Number(e.target.value))}
        />
        <div className="flex justify-between mt-3 text-[9px] font-black uppercase tracking-widest opacity-60">
          <span>20.0x (Speed)</span>
          <span className="bg-white/20 px-2 py-0.5 rounded text-white opacity-100">{speedMultiplier.toFixed(1)}x</span>
          <span>0.5x (Real)</span>
        </div>
        <div className="mt-3 rounded-lg bg-white/15 px-3 py-2 text-[9px] font-black tracking-wide">
          <div className="flex justify-between">
            <span>Tick Interval</span>
            <span>{pollInterval} ms</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Ticks / Sec</span>
            <span>{ticksPerSecond.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Sim Min / Sec</span>
            <span>{simMinutesPerSecond.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="pro-card !p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Live Diagnostics</h2>
          <FaChartLine className="text-blue-500" />
        </div>
        
        <div className="gap-6 flex flex-col">
          
          {/* Stats Grid */}
          <div className="space-y-2">
            {stats.map(stat => (
              <div key={stat.label} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center transition-all hover:border-blue-200">
                <div>
                   <p className="text-[9px] text-slate-400 font-bold uppercase">{stat.label}</p>
                   <p className="text-sm font-black text-slate-800">{stat.val}</p>
                </div>
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-widest ${
                stat.status === 'optimal' || stat.status === 'in-spec' || stat.status === 'nominal' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>{stat.status}</span>
              </div>
            ))}
          </div>

          {/* New Industrial Alert Center */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center justify-between">
              Critical Alerts
              <span className="text-white bg-red-600 px-2 py-0.5 rounded-full text-[8px]">{globalAlerts.length}</span>
            </h3>
            
            <div className="space-y-2">
              {globalAlerts.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center">
                  <p className="text-[9px] text-slate-400 font-bold uppercase italic">No Active Alerts</p>
                </div>
              ) : (
                globalAlerts.map(alert => (
                  <div key={alert.id} className={`p-4 rounded-xl border flex gap-3 transition-all ${
                    alert.type === 'error' ? 'bg-red-50 border-red-100' : 
                    alert.type === 'warning' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'
                  }`}>
                    <div className={alert.type === 'error' ? 'text-red-500' : alert.type === 'warning' ? 'text-amber-500' : 'text-blue-500'}>
                      {alert.type === 'info' ? <FaInfoCircle /> : <FaExclamationTriangle className="text-sm" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-[11px] font-bold leading-tight ${
                        alert.type === 'error' ? 'text-red-900' : alert.type === 'warning' ? 'text-amber-900' : 'text-blue-900'
                      }`}>{alert.message}</p>
                      <span className="text-[8px] text-slate-400 font-bold mt-1 block uppercase tracking-tighter">{alert.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* LIVE AI SUGGESTIONS ENGINE */}
          <LiveSuggestions />

        </div>
      </div>
    </div>
  );
};

const LiveSuggestions: React.FC = () => {
  const { nodes, inventory } = useSimulationStore();
  
  const suggestions: { icon: string, text: string, severity: 'info' | 'warning' | 'critical' }[] = [];

  // Analyze plant state for dynamic suggestions
  const reactors = nodes.filter(n => n.type === 'reactor');
  const storages = nodes.filter(n => n.type === 'storage');
  const dryer = nodes.find(n => n.type === 'dryer');
  const emptyTanks = storages.filter(s => (s.data.currentLevel || 0) <= 0);
  const hotReactors = reactors.filter(r => (r.data.temp || 25) > 80);
  const lowStock = inventory.filter(i => i.category === 'raw' && i.currentStock <= i.reorderPoint && i.reorderPoint > 0);

  if (emptyTanks.length > 0) {
    suggestions.push({ icon: '🚨', text: `${emptyTanks.map(t => t.data.label).join(', ')} depleted — schedule replenishment to restore downstream cascade.`, severity: 'critical' });
  }
  if (hotReactors.length > 0) {
    suggestions.push({ icon: '🌡️', text: `${hotReactors.map(r => r.data.label).join(', ')} above 80°C — consider reducing Power Number to prevent thermal runaway.`, severity: 'warning' });
  }
  if (lowStock.length > 0) {
    suggestions.push({ icon: '📦', text: `${lowStock.map(i => i.name).join(', ')} below reorder threshold. Estimated stockout imminent.`, severity: 'warning' });
  }
  if (dryer && (dryer.data.moisture ?? 100) < 5 && dryer.data.status === 'running') {
    suggestions.push({ icon: '✅', text: `Dryer moisture target reached (${(dryer.data.moisture ?? 0).toFixed(1)}%). Product ready for QC packaging.`, severity: 'info' });
  }
  if (suggestions.length === 0) {
    suggestions.push({ icon: '🟢', text: 'All systems nominal. No corrective actions required.', severity: 'info' });
  }

  const severityColors = {
    info: 'bg-blue-50 border-blue-100 text-blue-900',
    warning: 'bg-amber-50 border-amber-100 text-amber-900',
    critical: 'bg-red-50 border-red-100 text-red-900',
  };

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        AI Suggestions
      </h3>
      {suggestions.map((s, i) => (
        <div key={i} className={`p-3 rounded-xl border text-[10px] font-bold leading-tight ${severityColors[s.severity]}`}>
          <span className="mr-1">{s.icon}</span> {s.text}
        </div>
      ))}
    </div>
  );
};
