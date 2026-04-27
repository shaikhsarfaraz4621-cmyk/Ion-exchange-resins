import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useSimulationStore } from '../../store/simulationStore';
import { GlassCard } from '../shared/GlassCard';
import { 
  FaFlask, 
  FaAward, 
  FaCogs, 
  FaCheckCircle, 
  FaClock, 
  FaArrowUp,
  FaArrowDown
} from 'react-icons/fa';

// We'll reuse GlassCard but now it's styled as a ProCard in CSS
const ProCard = GlassCard;

export const DashboardView: React.FC = () => {
  const { simulationHistory, batchStage, nodes, globalAlerts, recipe } = useSimulationStore();

  const reactors = nodes.filter(n => n.type === 'reactor');
  const activeReactor = reactors.find(n => n.data.status === 'running') || reactors[0];
  const conversionRate = Math.round(activeReactor?.data.conversion || 0);
  const liveQuality = activeReactor?.data.qualityGrade;
  const yieldGrade = liveQuality ? `Grade ${liveQuality}` : 'Grade Pending';

  const runningReactorCount = reactors.filter(r => r.data.status === 'running').length;
  const errorCount = globalAlerts.filter(a => a.type === 'error').length;
  const warningCount = globalAlerts.filter(a => a.type === 'warning').length;
  const availability = reactors.length > 0 ? (runningReactorCount / reactors.length) * 100 : 100;
  const alertPenalty = errorCount * 10 + warningCount * 4;
  const systemEfficiency = Math.max(
    0,
    Math.min(100, Math.round((availability * 0.55 + conversionRate * 0.45) - alertPenalty))
  );

  const BIN_LABELS = ['0.42mm', '0.48mm', '0.55mm', '0.62mm', '0.68mm', '0.75mm', '0.82mm'];
  const activeReactorForPSD = activeReactor;
  const psdBins = activeReactorForPSD?.data.psdBins || [12, 28, 85, 142, 95, 32, 8];
  const maxCount = Math.max(...psdBins, 150);
  
  const psdData = BIN_LABELS.map((size, index) => ({
    size,
    count: psdBins[index] || 0,
    maxPossible: maxCount
  }));

  const batchStatus = errorCount > 0 ? 'Alert' : batchStage === 'complete' ? 'Success' : 'Active';
  const recentBatches = [
    { id: 'BT-LIVE-001', stage: batchStage, status: batchStatus, time: `T+${simulationHistory[simulationHistory.length-1]?.tick || 0}` },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Breadcrumb / Title Row */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                <span>Enterprise</span>
                <span>/</span>
                <span className="text-slate-600">Production Dashboard</span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">System Performance Overview</h2>
          </div>
          <button className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            Export Report
          </button>
        </div>

        {/* Pro KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ProCard className="pro-card !p-6">
             <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <FaCogs className="text-base" />
                </div>
                <FaArrowUp className="text-xs text-emerald-500" />
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Reactors</p>
             <h3 className="text-2xl font-black text-slate-800">{runningReactorCount}<span className="text-xs text-slate-400 ml-1">/ {reactors.length}</span></h3>
          </ProCard>

          <ProCard className="pro-card !p-6">
             <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                    <FaFlask className="text-base" />
                </div>
                <span className="text-[10px] font-black text-orange-600 px-2 py-0.5 bg-orange-50 rounded">ACTIVE</span>
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Conversion Rate</p>
             <h3 className="text-2xl font-black text-slate-800">{conversionRate}%</h3>
          </ProCard>

          <ProCard className="pro-card !p-6">
             <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                    <FaAward className="text-base" />
                </div>
                <FaCheckCircle className="text-sm text-emerald-500" />
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expected Quality</p>
             <h3 className="text-2xl font-black text-slate-800">{yieldGrade}</h3>
          </ProCard>

          <ProCard className="pro-card !p-6">
             <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-slate-50 text-slate-600">
                    <FaCogs className="text-base" />
                </div>
                <FaArrowDown className="text-xs text-slate-300" />
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">System Efficiency</p>
             <h3 className="text-2xl font-black text-slate-800">{systemEfficiency}%</h3>
          </ProCard>
        </div>

        {/* Recipe Snapshot + Physics Outputs side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProCard className="pro-card !p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Recipe Snapshot</h3>
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200">
                {recipe.feedRateProfile}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">DVB %</p>
                <p className="text-sm font-black text-slate-800">{recipe.dvbPercent.toFixed(2)}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Initiator</p>
                <p className="text-sm font-black text-slate-800">{recipe.initiatorDosage.toFixed(2)} g/L</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">M/W Ratio</p>
                <p className="text-sm font-black text-slate-800">{recipe.monomerWaterRatio.toFixed(2)}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Target PSD</p>
                <p className="text-sm font-black text-slate-800">{recipe.targetPsdMin.toFixed(2)}–{recipe.targetPsdMax.toFixed(2)} mm</p>
              </div>
            </div>
          </ProCard>

          <ProCard className="pro-card !p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Physics Outputs</h3>
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">
                Phase 2
              </span>
            </div>
            {(() => {
              const d = activeReactor?.data;
              const physicsItems = [
                { label: 'Crosslink Density', value: d?.crosslinkDensity != null ? d.crosslinkDensity.toFixed(3) : '—', unit: '', color: d?.crosslinkDensity != null && d.crosslinkDensity > 1.2 ? 'text-amber-600' : 'text-slate-800' },
                { label: 'Swelling Index', value: d?.swellingIndex != null ? d.swellingIndex.toFixed(3) : '—', unit: '', color: d?.swellingIndex != null && d.swellingIndex > 1.15 ? 'text-red-600' : 'text-slate-800' },
                { label: 'Rigidity Index', value: d?.rigidityIndex != null ? d.rigidityIndex.toFixed(3) : '—', unit: '', color: d?.rigidityIndex != null && d.rigidityIndex < 0.55 ? 'text-amber-600' : 'text-emerald-700' },
                { label: 'PSD Spread', value: d?.psdSpread != null ? d.psdSpread.toFixed(3) : '—', unit: 'mm', color: d?.psdSpread != null && d.psdSpread > 0.30 ? 'text-red-600' : 'text-slate-800' },
                { label: 'Predicted WBC', value: d?.predictedWBC != null ? d.predictedWBC.toFixed(1) : '—', unit: '%', color: d?.predictedWBC != null && d.predictedWBC < 70 ? 'text-red-600' : 'text-emerald-700' },
                { label: 'Ion Capacity', value: d?.predictedIonCapacity != null ? d.predictedIonCapacity.toFixed(2) : '—', unit: 'meq/mL', color: d?.predictedIonCapacity != null && d.predictedIonCapacity < 1.0 ? 'text-amber-600' : 'text-slate-800' },
              ];
              return (
                <div className="grid grid-cols-2 gap-3">
                  {physicsItems.map(item => (
                    <div key={item.label} className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                      <p className={`text-sm font-black ${item.color}`}>
                        {item.value}{item.value !== '—' && item.unit ? ` ${item.unit}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </ProCard>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ProCard className="pro-card p-8">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Chemical Kinetics</h3>
                        <p className="text-[10px] text-slate-400 font-bold">Real-time Reaction Velocity Monitoring</p>
                    </div>
                </div>
                <div className="h-[300px] min-h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={simulationHistory}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="tick" hide />
                            <YAxis stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Line type="monotone" dataKey="temp" stroke="#3b82f6" strokeWidth={3} dot={false} animationDuration={1000} />
                            <Line type="monotone" dataKey="conversion" stroke="#10b981" strokeWidth={3} dot={false} animationDuration={1000} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </ProCard>

            <ProCard className="pro-card p-8">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Resin Batch Logs</h3>
                        <p className="text-[10px] text-slate-400 font-bold">Recent Production Workflows</p>
                    </div>
                </div>
                <div className="divide-y divide-slate-100">
                    {recentBatches.map(batch => (
                        <div key={batch.id} className="py-4 flex items-center justify-between group cursor-pointer hover:bg-slate-50 transition-all rounded-lg px-2">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                    <FaClock />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-widest">{batch.id}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">{batch.stage} Phase</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                                    batch.status === 'Success' ? 'bg-emerald-50 text-emerald-600' : 
                                    batch.status === 'Alert' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                                }`}>
                                    {batch.status}
                                </span>
                                <span className="text-[10px] font-mono font-bold text-slate-400">{batch.time}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </ProCard>
        </div>

        {/* PSD Table View */}
        <ProCard className="pro-card p-8 overflow-hidden">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Bead Morphology Analysis</h3>
                    <p className="text-[10px] text-slate-400 font-bold">Comprehensive Particle Size Distribution</p>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-100">
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Size Category</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Observation Count</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Visual Feedback</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Threshold Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {psdData.map((d) => (
                            <tr key={d.size} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-4 text-xs font-bold text-slate-700">{d.size}</td>
                                <td className="py-4 text-xs font-mono font-black text-slate-900">{d.count}</td>
                                <td className="py-4">
                                    <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500" style={{ width: `${(d.count / d.maxPossible) * 100}%` }} />
                                    </div>
                                </td>
                                <td className="py-4">
                                    {d.count > 100 ? (
                                        <div className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600">
                                            <FaCheckCircle /> Optimal
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-400">
                                            Nominal
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </ProCard>

      </div>
    </div>
  );
};
