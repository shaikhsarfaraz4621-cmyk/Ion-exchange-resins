import React from 'react';
import { FaPause, FaPlay, FaSync } from 'react-icons/fa';
import { useSimulationStore } from '../../store/simulationStore';
import { useSimulation } from '../../hooks/useSimulation';

export const Header: React.FC = () => {
  const tick = useSimulationStore(state => state.tick);
  const isSimulating = useSimulationStore(state => state.isSimulating);
  const stage = useSimulationStore(state => state.batchStage);
  const isBackendConnected = useSimulationStore(state => state.isBackendConnected);
  const { toggleSimulation, resetSimulation } = useSimulation();
  const onToggle = toggleSimulation;
  const onReset = resetSimulation;
  const stages = [
    { id: 'setup', label: 'Preparation' },
    { id: 'polymerization', label: 'Polymerization' },
    { id: 'functionalization', label: 'Functionalization' },
    { id: 'hydration', label: 'Hydration' }
  ];

  const currentStageIndex = stages.findIndex(s => s.id === stage);
  const isComplete = stage === 'complete';

  return (
    <nav className="h-16 border-b border-slate-200 flex items-center justify-between px-8 z-20 relative bg-white gap-12 shrink-0">
      
      {/* Title / Breadcrumbs */}
      <div className="flex items-center gap-4 shrink-0 overflow-hidden">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span className="text-slate-400 font-medium">Digital Twin</span>
            <span className="text-slate-300">/</span>
            <span className="truncate">Active Process Simulator</span>
        </h2>
        <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
            isSimulating ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200'
        }`}>
            {isSimulating ? 'Operational' : 'Idle'}
        </div>
        {!isBackendConnected && (
          <div className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-red-50 text-red-600 border border-red-200 animate-pulse">
            Backend Offline
          </div>
        )}
      </div>

      {/* NEW Phase Timeline (Professionalized) */}
      <div className="flex-1 max-w-xl hidden lg:flex items-center justify-between relative px-4">
        <div className="absolute h-[1px] bg-slate-200 w-full top-1/2 -translate-y-1/2 left-0" />
        <div 
          className="absolute h-[1px] bg-blue-500 top-1/2 -translate-y-1/2 left-0 transition-all duration-1000" 
          style={{ width: isComplete ? '100%' : `${(currentStageIndex / (stages.length - 1)) * 100}%` }}
        />
        
        {stages.map((s, idx) => {
          const isActive = s.id === stage;
          const isPassed = stages.findIndex(st => st.id === stage) > idx || isComplete;
          
          return (
            <div key={s.id} className="relative z-10 flex items-center justify-center p-1 bg-white">
              <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
                isActive ? 'bg-blue-500 ring-4 ring-blue-500/10' : 
                isPassed ? 'bg-blue-600' : 'bg-slate-200'
              }`} />
              {isActive && (
                <span className="absolute -bottom-6 whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-blue-600">
                    {s.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest leading-none mb-1">Sim Time</span>
            <span className="font-mono text-sm font-black text-slate-800">T + {tick}M</span>
          </div>
          
          {/* Reset Button */}
          <button
            onClick={onReset}
            title="Reset Simulation"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-300 hover:bg-red-50 transition-all"
          >
            <FaSync className={isSimulating ? 'opacity-50' : ''} />
            <span className="hidden xl:inline">Reset</span>
          </button>

          {/* Start / Stop Button */}
          <button 
            onClick={onToggle}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              isSimulating 
                ? 'bg-slate-900 text-white hover:bg-black shadow-lg shadow-black/10'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20'
            }`}
          >
            {isSimulating ? <><FaPause /> Stop Batch</> : <><FaPlay /> Initiate Batch</>}
          </button>
        </div>
    </nav>
  );
};
