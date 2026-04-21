import React from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { FaDatabase, FaWarehouse } from 'react-icons/fa';

export const ControlSidebar: React.FC = () => {
  const { nodes } = useSimulationStore();
  
  const components = [
    { name: 'Polymer Reactor', type: 'reactor', color: 'blue' },
    { name: 'Monomer Tank', type: 'storage', color: 'cyan' },
    { name: 'Acid Reservoir', type: 'storage', color: 'indigo' },
    { name: 'Centrifuge', type: 'process', color: 'slate' },
    { name: 'Hydration Unit', type: 'process', color: 'teal' },
    { name: 'Surge Buffer', type: 'buffer', color: 'indigo' }
  ];

  const storageNodes = nodes.filter(n => n.type === 'storage');

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Component Palette */}
      <div className="pro-card !p-6">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Component Assets</h2>
          <FaDatabase className="text-slate-300" />
        </div>
        
        <div className="space-y-3">
          {components.map((comp) => (
            <div 
              key={comp.name} 
              className="group cursor-grab active:cursor-grabbing"
              onDragStart={(event) => onDragStart(event, comp.type, comp.name)}
              draggable
            >
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 transition-all duration-200 group-hover:border-blue-300 group-hover:bg-blue-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                     <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 group-hover:text-blue-700 transition-colors">
                    {comp.name}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* NEW Material Inventory Dashboard */}
      <div className="pro-card !p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Inventory Levels</h2>
          <FaWarehouse className="text-slate-300" />
        </div>
        
        <div className="space-y-4">
          {storageNodes.length === 0 ? (
             <div className="text-center p-4 border-2 border-dashed border-slate-100 rounded-xl">
                <p className="text-[9px] text-slate-400 font-bold uppercase italic tracking-widest leading-loose">No Storage Assets<br/>Deployed</p>
             </div>
          ) : (
            storageNodes.map(node => {
               const levelPct = ((node.data.currentLevel || 0) / (node.data.capacity || 5000)) * 100;
               return (
                  <div key={node.id} className="bg-white border border-slate-100 rounded-xl p-4 space-y-3 shadow-sm">
                     <div className="flex justify-between items-start">
                        <div>
                           <p className="text-[11px] font-black text-slate-800 leading-tight">{node.data.label}</p>
                           <p className="text-[8px] text-slate-400 font-black uppercase">{node.data.materialType}</p>
                        </div>
                        <span className="font-mono text-[10px] text-blue-600 font-black">{Math.round(node.data.currentLevel || 0)} L</span>
                     </div>
                     <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                           className={`h-full transition-all duration-1000 ${levelPct < 20 ? 'bg-red-500' : 'bg-blue-500'}`}
                           style={{ width: `${levelPct}%` }}
                        />
                     </div>
                  </div>
               );
            })
          )}
        </div>
      </div>

    </div>
  );
};
