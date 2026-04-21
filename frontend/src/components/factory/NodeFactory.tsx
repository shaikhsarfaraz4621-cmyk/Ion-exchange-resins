import React, { useState } from 'react';
import { FaCogs, FaProjectDiagram, FaVial, FaTimes, FaSave, FaMicrochip } from 'react-icons/fa';
import { useSimulationStore } from '../../store/simulationStore';

export const NodeFactory: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { factoryConfigs, updateConfig, activeConfigId, setActiveConfigId } = useSimulationStore();
  
  // Local state to handle config switching in the factory
  const config = factoryConfigs.find(c => c.id === activeConfigId) || factoryConfigs[0];
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      onClose();
    }, 800);
  };

  return (
    <div className="absolute inset-0 z-[100] bg-slate-100/60 backdrop-blur-md p-12 flex items-center justify-center">
      <div className="max-w-5xl w-full bg-white rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95 duration-300">
        
        {/* Enterprise Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-10 py-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <FaCogs className="text-white text-3xl" />
            </div>
            <div>
               <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">
                  <FaMicrochip />
                  <span>Asset Engineering Console</span>
               </div>
               <h2 className="text-3xl font-black text-slate-800 tracking-tight">Node Design Factory</h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all"
          >
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          
          {/* Config Sidebar */}
          <aside className="w-72 bg-slate-50 border-r border-slate-200 p-6 space-y-4">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-4">Active Blueprints</h3>
             {factoryConfigs.map(c => (
               <button 
                key={c.id}
                onClick={() => setActiveConfigId(c.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  activeConfigId === c.id 
                  ? 'bg-white border-blue-500 shadow-sm shadow-blue-500/10' 
                  : 'bg-transparent border-transparent text-slate-500 hover:bg-white hover:border-slate-200'
                }`}
               >
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">Design ID</p>
                  <p className={`text-xs font-black ${activeConfigId === c.id ? 'text-blue-600' : 'text-slate-700'}`}>{c.id}</p>
               </button>
             ))}
          </aside>

          {/* Main Config Area */}
          <main className="flex-1 p-10 overflow-y-auto custom-scrollbar">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                
                {/* Physical Geometry */}
                <div className="space-y-8">
                   <div className="flex items-center gap-3">
                      <FaProjectDiagram className="text-blue-600" />
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Physical Geometry</h3>
                   </div>
                   
                   <div className="space-y-8 px-2">
                       <div className="space-y-4">
                          <label className="flex justify-between text-[11px] text-slate-500 font-bold uppercase">
                             Vessel Diameter (m)
                             <span className="text-blue-600 font-black">{config.geometry.diameter}m</span>
                          </label>
                          <input 
                            type="range" min="0.5" max="10" step="0.1"
                            value={config.geometry.diameter}
                            onChange={(e) => updateConfig(config.id, { geometry: { ...config.geometry, diameter: parseFloat(e.target.value) } })}
                            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                          />
                       </div>

                       <div className="space-y-4">
                          <label className="flex justify-between text-[11px] text-slate-500 font-bold uppercase">
                             Vessel Height (m)
                             <span className="text-blue-600 font-black">{config.geometry.height}m</span>
                          </label>
                          <input 
                            type="range" min="1" max="15" step="0.5"
                            value={config.geometry.height}
                            onChange={(e) => updateConfig(config.id, { geometry: { ...config.geometry, height: parseFloat(e.target.value) } })}
                            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                          />
                       </div>

                       <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Baffle Matrix</p>
                          <div className="flex gap-2">
                             {[2, 4, 6].map(val => (
                               <button 
                                key={val}
                                onClick={() => updateConfig(config.id, { geometry: { ...config.geometry, baffleCount: val } })}
                                className={`flex-1 py-3 rounded-xl border-2 text-xs font-black transition-all ${
                                  config.geometry.baffleCount === val
                                  ? 'bg-white border-blue-500 text-blue-600 shadow-sm'
                                  : 'bg-transparent border-transparent text-slate-400 hover:bg-white hover:border-slate-100'
                                }`}
                               >
                                 {val} BAFFLES
                               </button>
                             ))}
                          </div>
                       </div>
                   </div>
                </div>

                {/* Agitation Dynamics */}
                <div className="space-y-8">
                   <div className="flex items-center gap-3">
                      <FaVial className="text-blue-600" />
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Agitation Dynamics</h3>
                   </div>

                   <div className="space-y-8 px-2">
                       <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Power Number (Np)</p>
                          <div className="flex items-end gap-3">
                             <input 
                              type="number" step="0.1" value={config.agitation.powerNumber}
                              onChange={(e) => updateConfig(config.id, { agitation: { ...config.agitation, powerNumber: parseFloat(e.target.value) } })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-5 py-4 text-3xl font-black font-mono text-slate-800 focus:ring-2 ring-blue-500/20 outline-none"
                             />
                             <span className="text-xs font-bold text-slate-400 mb-3 uppercase">Calibrated</span>
                          </div>
                          <p className="text-[9px] text-slate-400 font-bold leading-tight italic">Higher Power Numbers significantly accelerate reaction kinetics but increase TCO.</p>
                       </div>

                       <div className="grid grid-cols-2 gap-3">
                          {['Paddle', 'Anchor', 'Turbine', 'Propeller'].map(type => (
                             <button 
                              key={type}
                              onClick={() => updateConfig(config.id, { agitation: { ...config.agitation, impellerType: type } })}
                              className={`p-4 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                                config.agitation.impellerType === type
                                ? 'bg-blue-600 border-blue-700 text-white shadow-lg shadow-blue-600/20'
                                : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white hover:border-slate-200'
                              }`}
                             >
                               {type}
                             </button>
                          ))}
                       </div>
                   </div>
                </div>

             </div>
          </main>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-8 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center bg-white text-blue-600 font-black text-sm">?</div>
              <p className="text-[10px] text-slate-500 font-bold max-w-sm leading-relaxed">Changes to these engineered specifications will propagate across all linked Twin instances upon synchronization.</p>
            </div>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-slate-900 hover:bg-slate-800 text-white px-12 py-5 rounded-2xl font-black text-xs tracking-[0.2em] uppercase transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center gap-3"
            >
                {isSaving ? (
                  <>Synchronizing Assets...</>
                ) : (
                  <><FaSave className="text-lg" /> Synchronize Digital Twin</>
                )}
            </button>
        </div>

      </div>
    </div>
  );
};
