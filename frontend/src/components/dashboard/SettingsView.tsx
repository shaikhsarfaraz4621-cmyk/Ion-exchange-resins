import React from 'react';
import { 
  FaCogs, 
  FaRulerCombined, 
  FaThermometerHalf, 
  FaShieldAlt, 
  FaSave,
  FaCalendarAlt,
  FaFlask
} from 'react-icons/fa';
import { useSimulationStore } from '../../store/simulationStore';
import RecipePresetsPanel from './RecipePresetsPanel';

export const SettingsView: React.FC = () => {
  const { batchSize, interarrivalTicks, setSimulationSettings, recipe, setRecipe } = useSimulationStore();
  return (
    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                <FaCogs />
                <span>System</span>
                <span>/</span>
                <span className="text-slate-600">Enterprise Configurations</span>
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Plant Global Standards</h2>
          </div>
          <button className="flex items-center gap-2 bg-blue-600 px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
             <FaSave /> Save Global Config
          </button>
        </div>

        {/* Setting Groups */}
        <div className="space-y-6 pb-12">
            
            {/* Reactor Geometry */}
            <div className="pro-card bg-white p-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 rounded-xl bg-slate-50 text-slate-400 border border-slate-100">
                        <FaRulerCombined className="text-xl" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Reactor Geometry Baseline</h3>
                        <p className="text-[10px] text-slate-400 font-bold">Standard physical dimensions for newly deployed units.</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Standard Vessel Diameter (m)</label>
                        <input type="number" defaultValue={2.4} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-800" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Standard Height (m)</label>
                        <input type="number" defaultValue={5.0} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-800" />
                    </div>
                </div>
            </div>

            {/* Threshold Configuration */}
            <div className="pro-card bg-white p-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 rounded-xl bg-orange-50 text-orange-400 border border-orange-100">
                        <FaThermometerHalf className="text-xl" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Safety Thresholds</h3>
                        <p className="text-[10px] text-slate-400 font-bold">Critical triggers for automated emergency shutdowns.</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Temp High Alert (°C)</label>
                        <input type="number" defaultValue={80} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-800" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Level Critical Low (L)</label>
                        <input type="number" defaultValue={500} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-800" />
                    </div>
                </div>
            </div>

            {/* Recipe & Batch Setup */}
            <div className="pro-card bg-blue-50/40 border border-blue-100 p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 rounded-xl bg-white text-blue-600 border border-blue-100 shadow-sm">
                        <FaFlask className="text-xl" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">Recipe & Batch Setup</h3>
                        <p className="text-[10px] text-blue-500 font-bold">Define chemistry baseline before starting a batch run.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest">DVB Percentage (%)</label>
                        <input
                            type="number"
                            min={1}
                            max={20}
                            step={0.1}
                            value={recipe.dvbPercent}
                            onChange={(e) => setRecipe({ dvbPercent: Number(e.target.value) })}
                            className="w-full bg-white border border-blue-100 rounded-lg px-4 py-3 text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Initiator Dosage (% or g/L)</label>
                        <input
                            type="number"
                            min={0.1}
                            max={5}
                            step={0.1}
                            value={recipe.initiatorDosage}
                            onChange={(e) => setRecipe({ initiatorDosage: Number(e.target.value) })}
                            className="w-full bg-white border border-blue-100 rounded-lg px-4 py-3 text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Monomer / Water Ratio</label>
                        <input
                            type="number"
                            min={0.1}
                            max={1}
                            step={0.01}
                            value={recipe.monomerWaterRatio}
                            onChange={(e) => setRecipe({ monomerWaterRatio: Number(e.target.value) })}
                            className="w-full bg-white border border-blue-100 rounded-lg px-4 py-3 text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Feed Profile</label>
                        <select
                            value={recipe.feedRateProfile}
                            onChange={(e) => setRecipe({ feedRateProfile: e.target.value as typeof recipe.feedRateProfile })}
                            className="w-full bg-white border border-blue-100 rounded-lg px-4 py-3 text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 transition-all"
                        >
                            <option value="conservative">Conservative</option>
                            <option value="balanced">Balanced</option>
                            <option value="aggressive">Aggressive</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Target PSD Min (mm)</label>
                        <input
                            type="number"
                            min={0.1}
                            max={2}
                            step={0.01}
                            value={recipe.targetPsdMin}
                            onChange={(e) => setRecipe({ targetPsdMin: Number(e.target.value) })}
                            className="w-full bg-white border border-blue-100 rounded-lg px-4 py-3 text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Target PSD Max (mm)</label>
                        <input
                            type="number"
                            min={0.1}
                            max={3}
                            step={0.01}
                            value={recipe.targetPsdMax}
                            onChange={(e) => setRecipe({ targetPsdMax: Number(e.target.value) })}
                            className="w-full bg-white border border-blue-100 rounded-lg px-4 py-3 text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* Recipe Presets — save/load named recipes */}
                <RecipePresetsPanel />
            </div>

            {/* Production Scheduling */}
            <div className="pro-card bg-indigo-50/30 border border-indigo-100 p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 rounded-xl bg-white text-indigo-500 border border-indigo-100 shadow-sm">
                        <FaCalendarAlt className="text-xl" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest">Production Scheduling Calibration</h3>
                        <p className="text-[10px] text-indigo-400 font-bold">Configure batch sizing and inter-arrival timing logistics.</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Standard Batch Volume (L)</label>
                        <input 
                            type="number" 
                            value={batchSize}
                            onChange={(e) => setSimulationSettings({ batchSize: Number(e.target.value) })}
                            className="w-full bg-white border border-indigo-100 rounded-lg px-4 py-3 text-sm font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 transition-all" 
                        />
                        <p className="text-[8px] text-indigo-400 font-bold">Defines the total monomer charge volume per reactor cycle.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Batch Gap / Interarrival (Ticks)</label>
                        <input 
                            type="number" 
                            value={interarrivalTicks}
                            onChange={(e) => setSimulationSettings({ interarrivalTicks: Number(e.target.value) })}
                            className="w-full bg-white border border-indigo-100 rounded-lg px-4 py-3 text-sm font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 transition-all" 
                        />
                        <p className="text-[8px] text-indigo-400 font-bold">Wait time between a batch completion and the next initialization.</p>
                    </div>
                </div>
            </div>

            {/* Compliance & Auth */}
            <div className="pro-card bg-white p-8 border-l-4 border-blue-600">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                        <FaShieldAlt className="text-xl" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Enterprise Compliance</h3>
                        <p className="text-[10px] text-slate-400 font-bold">Global authentication and reporting standards.</p>
                    </div>
                </div>
                
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 transition-all hover:bg-white hover:shadow-sm">
                        <div>
                           <p className="text-xs font-black text-slate-800">CFR Part 11 Compliance Mode</p>
                           <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Automated Audit Trails active</p>
                        </div>
                        <div className="w-10 h-6 bg-blue-600 rounded-full cursor-pointer relative shadow-inner">
                           <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 transition-all hover:bg-white hover:shadow-sm">
                        <div>
                           <p className="text-xs font-black text-slate-800">Auto-Archiving (Production Logs)</p>
                           <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Cloud-sync every 24 hours</p>
                        </div>
                        <div className="w-10 h-6 bg-slate-200 rounded-full cursor-pointer relative shadow-inner">
                           <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-4">
                <button className="px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Restore Defaults</button>
            </div>

        </div>

      </div>
    </div>
  );
};
