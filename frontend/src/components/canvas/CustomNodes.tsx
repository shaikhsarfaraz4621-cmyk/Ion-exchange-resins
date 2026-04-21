import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { FaSync, FaTint, FaMicrochip, FaShower, FaFire, FaBoxOpen } from 'react-icons/fa';
import { useSimulationStore } from '../../store/simulationStore';

const NodeWrapper: React.FC<{ children: React.ReactNode; label: string; type: string; selected?: boolean; status?: string; accentColor?: string; isBottleneck?: boolean }> = ({ children, label, type, selected, status, accentColor, isBottleneck }) => (
  <div className={`bg-white border-2 rounded-xl shadow-xl min-w-[240px] overflow-hidden transition-all duration-300 ${
    isBottleneck
      ? 'border-amber-400 ring-4 ring-amber-400/30 shadow-amber-200'
      : selected ? 'border-blue-500 ring-4 ring-blue-500/10 scale-105' : 'border-slate-300 shadow-slate-200/50'
  }`}>
    {/* Bottleneck banner */}
    {isBottleneck && (
      <div className="bg-amber-400 px-3 py-1 flex items-center gap-2 animate-pulse">
        <div className="w-1.5 h-1.5 rounded-full bg-white" />
        <span className="text-[8px] font-black uppercase tracking-widest text-white">Bottleneck Detected</span>
      </div>
    )}
    {/* Top Accent Bar */}
    <div className={`h-1 w-full ${
      isBottleneck ? 'bg-amber-400' :
      status === 'running' ? (accentColor || 'bg-blue-500') + ' animate-pulse' : 'bg-slate-300'
    }`} />
    
    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
      <div className="flex items-center gap-2">
         <FaMicrochip className={`text-[10px] ${isBottleneck ? 'text-amber-500' : status === 'running' ? 'text-blue-500' : 'text-slate-400'}`} />
         <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">{type}</span>
            <span className="text-[7px] font-black uppercase text-blue-500/60 tracking-widest">{status === 'running' ? 'Linked Asset' : 'Idle Asset'}: {label.split(' ')[0]}</span>
         </div>
      </div>
      <div className={`w-2 h-2 rounded-full ${
        isBottleneck ? 'bg-amber-400 shadow-[0_0_10px_#fbbf24] animate-pulse' :
        status === 'running' ? 'bg-blue-500 shadow-[0_0_10px_#3b82f6]' : 'bg-slate-300'
      }`} />
    </div>
    <div className="p-5 bg-white relative">
      <h3 className="text-sm font-black text-slate-800 mb-4 tracking-tight uppercase truncate">{label}</h3>
      {children}
    </div>
    <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-blue-400 !border-white !border-2" />
    <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-blue-600 !border-white !border-2" />
  </div>
);


export const ReactorNode = memo(({ data, selected, id }: any) => {
  const isRunning = data.status === 'running';
  const mode = data.reactorMode || 'cation';
  const modeColors: Record<string, { bg: string, text: string, accent: string, fill: string }> = {
    cation: { bg: 'bg-blue-50/30', text: 'text-blue-600', accent: 'border-blue-100/50', fill: 'bg-blue-600/10' },
    anion: { bg: 'bg-purple-50/30', text: 'text-purple-600', accent: 'border-purple-100/50', fill: 'bg-purple-600/10' },
    hybrid: { bg: 'bg-amber-50/30', text: 'text-amber-600', accent: 'border-amber-100/50', fill: 'bg-amber-600/10' },
  };
  const mc = modeColors[mode] || modeColors.cation;

  const handleModeSwitch = (newMode: string) => {
    const { setNodes } = useSimulationStore.getState();
    setNodes((nds: any[]) => nds.map((n: any) => n.id === id ? { ...n, data: { ...n.data, reactorMode: newMode } } : n));
  };

  return (
    <NodeWrapper label={data.label} type="Reactor Unit" selected={selected} status={data.status} isBottleneck={data.isBottleneck}>
      {/* Mode Toggle */}
      <div className="flex gap-1 mb-3">
        {['cation', 'anion', 'hybrid'].map(m => (
          <button
            key={m}
            onClick={(e) => { e.stopPropagation(); handleModeSwitch(m); }}
            className={`flex-1 py-1.5 rounded-lg text-[7px] font-black uppercase tracking-widest transition-all border ${
              mode === m
                ? `${modeColors[m].bg} ${modeColors[m].text} ${modeColors[m].accent}`
                : 'bg-white border-slate-100 text-slate-300 hover:text-slate-500'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-6">
        <div className="relative">
          <div className="w-16 h-20 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center relative overflow-hidden shadow-inner">
               <div className={`absolute bottom-0 w-full ${mc.fill} transition-all`} style={{ height: `${data.conversion || 0}%`, transitionDuration: 'var(--sim-transition-duration)' }} />
               <div className="absolute top-0 w-full h-1 bg-blue-600/5" />
               <FaSync className={`text-slate-300 text-xl ${isRunning ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
          </div>
        </div>
        <div className="space-y-3 flex-1">
          <div className="space-y-2">
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Process Temp</p>
                <p className={`text-base font-black font-mono leading-none ${data.temp > 80 ? 'text-red-600' : 'text-slate-800'}`}>
                    {data.temp?.toFixed(1) || 25}<span className="text-[10px] ml-0.5">°C</span>
                </p>
            </div>
            <div className={`${mc.bg} border ${mc.accent} rounded-lg p-2.5`}>
                <p className={`text-[8px] font-black ${mc.text} uppercase tracking-[0.15em] mb-1`}>Conversion</p>
                <p className={`text-base font-black font-mono leading-none ${mc.text}`}>
                    {data.conversion?.toFixed(1) || 0}<span className="text-[10px] ml-0.5">%</span>
                </p>
            </div>
          </div>
        </div>
      </div>
    </NodeWrapper>
  );
});


export const StorageNode = memo(({ data, selected }: any) => {
  const levelPct = ((data.currentLevel || 0) / (data.capacity || 5000)) * 100;
  return (
    <NodeWrapper label={data.label} type="Storage Asset" selected={selected} isBottleneck={data.isBottleneck}>
      <div className="flex items-center gap-6">
        <div className="w-12 h-20 bg-slate-50 border border-slate-200 rounded-lg relative overflow-hidden flex flex-col justify-end shadow-inner">
          <div 
            className={`w-full transition-all ${levelPct < 20 ? 'bg-red-500' : 'bg-blue-600 text-white'}`}
            style={{ height: `${levelPct}%`, transitionDuration: 'var(--sim-transition-duration)' }}
          >
             <div className="w-full h-full opacity-5 bg-slate-900" />
          </div>
        </div>
        <div className="space-y-3 flex-1">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{data.materialType}</p>
            <p className="text-xl font-black text-slate-800 leading-none">
                {Math.round(data.currentLevel || 0)}
                <span className="text-[10px] text-slate-400 ml-1 font-bold">L</span>
            </p>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
                className={`h-full transition-all duration-1000 ${levelPct < 20 ? 'bg-red-500' : 'bg-blue-500'}`} 
                style={{ width: `${levelPct}%` }} 
            />
          </div>
          <p className="text-[9px] font-black text-slate-400 uppercase text-right">{Math.round(levelPct)}% Capacity</p>
        </div>
      </div>
    </NodeWrapper>
  );
});

export const ProcessNode = memo(({ data, selected }: any) => {
  const isRunning = data.status === 'running';
  return (
    <NodeWrapper label={data.label} type="Process Unit" selected={selected} status={data.status} isBottleneck={data.isBottleneck}>
      <div className="flex flex-col items-center">
        <div className="w-full h-20 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center mb-4 relative overflow-hidden group shadow-inner">
          <div className={`text-4xl transition-all duration-500 ${isRunning ? 'text-blue-600 drop-shadow-lg' : 'text-slate-200'}`}>
            {data.label.toLowerCase().includes('centrifuge') ? <FaSync className={isRunning ? 'animate-spin' : ''} /> : <FaTint className={isRunning ? 'animate-pulse' : ''} />}
          </div>
          <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="w-full flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Efficiency</span>
          <span className={`text-[10px] font-black ${isRunning ? 'text-emerald-600' : 'text-slate-400'}`}>
            {isRunning ? '99.8%' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </NodeWrapper>
  );
});

// ─── DOWNSTREAM PROCESS NODES ─────────────────────────────────

export const WasherNode = memo(({ data, selected }: any) => {
  const isRunning = data.status === 'running';
  return (
    <NodeWrapper label={data.label} type="Wash Unit" selected={selected} status={data.status} accentColor="bg-cyan-500" isBottleneck={data.isBottleneck}>
      <div className="flex flex-col gap-3">
        <div className="w-full h-16 bg-cyan-50 border border-cyan-100 rounded-xl flex items-center justify-center relative overflow-hidden shadow-inner">
          <FaShower className={`text-3xl transition-all duration-500 ${isRunning ? 'text-cyan-600 animate-pulse' : 'text-slate-200'}`} />
          {isRunning && <div className="absolute inset-0 bg-gradient-to-t from-cyan-100/50 to-transparent animate-pulse" />}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Throughput</p>
            <p className="text-sm font-black font-mono text-slate-800">
              {(data.throughput || 0).toFixed(0)}<span className="text-[9px] ml-0.5">kg/h</span>
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Status</p>
            <p className={`text-sm font-black ${isRunning ? 'text-cyan-600' : 'text-slate-400'}`}>
              {isRunning ? 'ACTIVE' : 'IDLE'}
            </p>
          </div>
        </div>
      </div>
    </NodeWrapper>
  );
});

export const DryerNode = memo(({ data, selected }: any) => {
  const isRunning = data.status === 'running';
  const moisture = data.moisture ?? 100;
  return (
    <NodeWrapper label={data.label} type="Dryer Unit" selected={selected} status={data.status} accentColor="bg-orange-500" isBottleneck={data.isBottleneck}>
      <div className="flex flex-col gap-3">
        <div className="w-full h-16 bg-orange-50 border border-orange-100 rounded-xl flex items-center justify-center relative overflow-hidden shadow-inner">
          <FaFire className={`text-3xl transition-all duration-500 ${isRunning ? 'text-orange-500 animate-pulse' : 'text-slate-200'}`} />
          {isRunning && <div className="absolute bottom-0 w-full h-1 bg-gradient-to-r from-orange-400 to-red-400 animate-pulse" />}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Dryer Temp</p>
            <p className={`text-sm font-black font-mono ${(data.temp || 25) > 100 ? 'text-orange-600' : 'text-slate-800'}`}>
              {(data.temp || 25).toFixed(0)}<span className="text-[9px] ml-0.5">°C</span>
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Moisture</p>
            <p className={`text-sm font-black font-mono ${moisture < 10 ? 'text-emerald-600' : 'text-blue-600'}`}>
              {moisture.toFixed(1)}<span className="text-[9px] ml-0.5">%</span>
            </p>
          </div>
        </div>
        {/* Moisture Progress Bar */}
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange-400 to-emerald-500 transition-all" style={{ width: `${100 - moisture}%`, transitionDuration: 'var(--sim-transition-duration)' }} />
        </div>
      </div>
    </NodeWrapper>
  );
});

export const PackagerNode = memo(({ data, selected }: any) => {
  const isRunning = data.status === 'running';
  return (
    <NodeWrapper label={data.label} type="Packaging" selected={selected} status={data.status} accentColor="bg-emerald-500" isBottleneck={data.isBottleneck}>
      <div className="flex flex-col gap-3">
        <div className="w-full h-16 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center relative overflow-hidden shadow-inner">
          <FaBoxOpen className={`text-3xl transition-all duration-500 ${isRunning ? 'text-emerald-600 animate-bounce' : 'text-slate-200'}`} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Output</p>
            <p className="text-sm font-black font-mono text-slate-800">
              {(data.throughput || 0).toFixed(0)}<span className="text-[9px] ml-0.5">kg</span>
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5">
            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.15em] mb-1">QC Grade</p>
            <p className={`text-sm font-black ${
              data.qualityGrade === 'Fail' ? 'text-red-600' :
              data.qualityGrade === 'B' ? 'text-amber-600' :
              data.qualityGrade === 'AA' ? 'text-blue-600' : 'text-emerald-600'
            }`}>
              {isRunning ? (data.qualityGrade || 'AAA') : '---'}
            </p>
          </div>
        </div>
      </div>
    </NodeWrapper>
  );
});

export const SurgeBufferNode = memo(({ data, selected }: any) => {
  const levelPct = ((data.currentLevel || 0) / (data.capacity || 8000)) * 100;
  
  return (
    <NodeWrapper label={data.label} type="Surge Buffer" selected={selected} status={data.status} accentColor="bg-indigo-500" isBottleneck={data.isBottleneck}>
      <div className="flex flex-col gap-3">
        <div className="w-full h-16 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-center relative overflow-hidden shadow-inner">
           <div className={`absolute bottom-0 w-full bg-indigo-600/20 transition-all ${levelPct > 85 ? 'bg-red-500/30 animate-pulse' : ''}`} style={{ height: `${levelPct}%`, transitionDuration: 'var(--sim-transition-duration)' }} />
           <div className="font-mono text-xl font-black text-indigo-800 z-10 z-10 drop-shadow-md">
               {Math.floor(data.currentLevel || 0)} <span className="text-[10px]">L</span>
           </div>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div className={`h-full transition-all ${levelPct > 85 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${levelPct}%`, transitionDuration: 'var(--sim-transition-duration)' }} />
        </div>
        <div className="flex justify-between items-center px-1">
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-left">WIP Slurry</span>
          <span className={`text-[9px] font-black uppercase tracking-widest text-right ${levelPct > 85 ? 'text-red-600 animate-pulse' : 'text-slate-400'}`}>{Math.round(levelPct)}% Fill</span>
        </div>
      </div>
    </NodeWrapper>
  );
});
