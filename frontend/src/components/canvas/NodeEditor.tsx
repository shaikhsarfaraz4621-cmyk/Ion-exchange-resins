import React, { useState } from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { FaTimes, FaSave, FaMicrochip } from 'react-icons/fa';

interface NodeEditorProps {
  nodeId: string;
  onClose: () => void;
}

import { api } from '../../services/api';

export const NodeEditor: React.FC<NodeEditorProps> = ({ nodeId, onClose }) => {
  const { nodes, setNodes } = useSimulationStore();
  const node = nodes.find(n => n.id === nodeId);
  
  const [editData, setEditData] = useState<Record<string, any>>(node?.data || {});

  if (!node) return null;

  const handleSave = () => {
    const updatedNodes = nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...editData } } : n);
    setNodes(updatedNodes);
    
    // Explicit API sync logic for node data changes
    const updatedNode = updatedNodes.find(n => n.id === nodeId);
    if(updatedNode) api.updateState({ nodes: [updatedNode] });
    
    onClose();
  };

  const updateField = (key: string, value: any) => {
    setEditData(prev => ({ ...prev, [key]: value }));
  };

  const renderFields = () => {
    switch (node.type) {
      case 'reactor':
        return (
          <>
            <Field label="Unit Name" value={editData.label} onChange={(v) => updateField('label', v)} type="text" />
            <Field label="Capacity (L)" value={editData.capacity} onChange={(v) => updateField('capacity', Number(v))} type="number" />
            <Field label="Initial Temperature (°C)" value={editData.temp} onChange={(v) => updateField('temp', Number(v))} type="number" />
            <Field label="Conversion (%)" value={editData.conversion} onChange={(v) => updateField('conversion', Number(v))} type="number" />
            <Field label="Config ID" value={editData.configId || ''} onChange={(v) => updateField('configId', v)} type="text" />
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Reactor Mode</label>
              <div className="flex gap-2">
                {['cation', 'anion', 'hybrid'].map(m => (
                  <button key={m} onClick={() => updateField('reactorMode', m)}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                      editData.reactorMode === m || (!editData.reactorMode && m === 'cation')
                        ? 'bg-blue-50 text-blue-600 border-blue-200'
                        : 'bg-white text-slate-300 border-slate-100 hover:text-slate-500'
                    }`}
                  >{m}</button>
                ))}
              </div>
            </div>
          </>
        );
      case 'storage':
        return (
          <>
            <Field label="Tank Name" value={editData.label} onChange={(v) => updateField('label', v)} type="text" />
            <Field label="Material Type" value={editData.materialType} onChange={(v) => updateField('materialType', v)} type="text" />
            <Field label="Max Capacity (L)" value={editData.capacity} onChange={(v) => updateField('capacity', Number(v))} type="number" />
            <Field label="Current Level (L)" value={editData.currentLevel} onChange={(v) => updateField('currentLevel', Number(v))} type="number" />
          </>
        );
      case 'washer':
        return (
          <>
            <Field label="Unit Name" value={editData.label} onChange={(v) => updateField('label', v)} type="text" />
            <Field label="Throughput (kg/h)" value={editData.throughput} onChange={(v) => updateField('throughput', Number(v))} type="number" />
          </>
        );
      case 'dryer':
        return (
          <>
            <Field label="Unit Name" value={editData.label} onChange={(v) => updateField('label', v)} type="text" />
            <Field label="Dryer Temp (°C)" value={editData.temp} onChange={(v) => updateField('temp', Number(v))} type="number" />
            <Field label="Moisture (%)" value={editData.moisture} onChange={(v) => updateField('moisture', Number(v))} type="number" />
          </>
        );
      case 'packager':
        return (
          <>
            <Field label="Unit Name" value={editData.label} onChange={(v) => updateField('label', v)} type="text" />
            <Field label="Output (kg)" value={editData.throughput} onChange={(v) => updateField('throughput', Number(v))} type="number" />
          </>
        );
      default:
        return (
          <>
            <Field label="Unit Name" value={editData.label} onChange={(v) => updateField('label', v)} type="text" />
          </>
        );
    }
  };

  const typeLabels: Record<string, string> = {
    reactor: 'Reactor Unit',
    storage: 'Storage Tank',
    washer: 'Wash Unit',
    dryer: 'Dryer Unit',
    packager: 'Packaging Unit',
    process: 'Process Unit',
  };

  return (
    <div className="absolute inset-0 z-[60] bg-slate-900/30 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200 w-[440px] max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <FaMicrochip className="text-white text-sm" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{typeLabels[node.type || 'process'] || 'Unit'}</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ID: {node.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all">
            <FaTimes className="text-xs" />
          </button>
        </div>

        {/* Fields */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[50vh] custom-scrollbar">
          {renderFields()}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all">
            Cancel
          </button>
          <button onClick={handleSave} className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95">
            <FaSave className="text-xs" /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// Reusable Field Component
const Field: React.FC<{
  label: string;
  value: any;
  onChange: (value: string) => void;
  type: 'text' | 'number';
}> = ({ label, value, onChange, type }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{label}</label>
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 ring-blue-500/20 focus:border-blue-400 transition-all"
    />
  </div>
);
