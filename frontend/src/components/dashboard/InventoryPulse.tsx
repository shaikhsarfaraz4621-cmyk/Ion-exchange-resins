import React from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { FaBoxes, FaCubes, FaTruck, FaExclamationTriangle } from 'react-icons/fa';

export const InventoryPulse: React.FC = () => {
  const { inventory } = useSimulationStore();

  const rawMaterials = inventory.filter(i => i.category === 'raw');
  const wipItems = inventory.filter(i => i.category === 'wip');
  const finishedGoods = inventory.filter(i => i.category === 'finished');

  const totalRawStock = rawMaterials.reduce((acc, i) => acc + i.currentStock, 0);
  const totalFinishedStock = finishedGoods.reduce((acc, i) => acc + i.currentStock, 0);

  const InventoryBar = ({ item }: { item: typeof inventory[0] }) => {
    const pct = (item.currentStock / item.maxCapacity) * 100;
    const isLow = item.currentStock <= item.reorderPoint && item.reorderPoint > 0;
    return (
      <div className={`p-4 rounded-xl border transition-all hover:shadow-sm ${isLow ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <p className="text-xs font-black text-slate-800 truncate">{item.name}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.unit}</p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-black font-mono ${isLow ? 'text-red-600' : 'text-slate-800'}`}>
              {item.currentStock.toLocaleString()}
            </p>
            <p className="text-[8px] font-bold text-slate-400">/ {item.maxCapacity.toLocaleString()}</p>
          </div>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 rounded-full ${
              isLow ? 'bg-red-500' : pct > 60 ? 'bg-emerald-500' : 'bg-blue-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {isLow && (
          <div className="flex items-center gap-1 mt-2 text-[8px] font-black text-red-600 uppercase tracking-widest">
            <FaExclamationTriangle /> Below Reorder Point
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Value Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="pro-card !p-6 bg-white border-l-4 border-blue-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Raw Materials</p>
          <h3 className="text-xl font-black text-slate-800 font-mono">{totalRawStock.toLocaleString()} <span className="text-xs text-slate-400">L/kg</span></h3>
        </div>
        <div className="pro-card !p-6 bg-white border-l-4 border-orange-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Work-in-Progress</p>
          <h3 className="text-xl font-black text-slate-800 font-mono">{wipItems.reduce((a,i) => a + i.currentStock, 0).toLocaleString()} <span className="text-xs text-slate-400">kg</span></h3>
        </div>
        <div className="pro-card !p-6 bg-white border-l-4 border-emerald-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Finished Goods</p>
          <h3 className="text-xl font-black text-emerald-600 font-mono">{totalFinishedStock.toLocaleString()} <span className="text-xs text-slate-400">kg</span></h3>
        </div>
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Raw Materials */}
        <div className="pro-card p-6 bg-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><FaBoxes /></div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Raw Materials</h3>
          </div>
          <div className="space-y-3">
            {rawMaterials.map(item => <InventoryBar key={item.id} item={item} />)}
          </div>
        </div>

        {/* WIP */}
        <div className="pro-card p-6 bg-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-orange-50 text-orange-600"><FaCubes /></div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Work-in-Progress</h3>
          </div>
          <div className="space-y-3">
            {wipItems.map(item => <InventoryBar key={item.id} item={item} />)}
          </div>
        </div>

        {/* Finished Goods */}
        <div className="pro-card p-6 bg-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><FaTruck /></div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Finished Goods</h3>
          </div>
          <div className="space-y-3">
            {finishedGoods.map(item => <InventoryBar key={item.id} item={item} />)}
          </div>
        </div>

      </div>
    </div>
  );
};
