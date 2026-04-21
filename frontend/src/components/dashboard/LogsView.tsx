import React from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { 
  FaClipboardList, 
  FaSearch, 
  FaFilter, 
  FaFileExport, 
  FaCalendarAlt
} from 'react-icons/fa';

export const LogsView: React.FC = () => {
  const { globalAlerts, batchStage } = useSimulationStore();

  return (
    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* View Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                <FaClipboardList />
                <span>Operations</span>
                <span>/</span>
                <span className="text-slate-600">Production Log Matrix</span>
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Batch History & Traceability</h2>
          </div>
          <div className="flex gap-3">
             <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
                <FaFileExport /> Export CSV
             </button>
             <button className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
                Generate Report
             </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="pro-card p-2 flex items-center gap-4 bg-white">
           <div className="flex-1 relative">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search batch UID, material, or operator..." 
                className="w-full pl-10 pr-4 py-3 text-xs font-medium text-slate-800 bg-transparent border-none focus:ring-0"
              />
           </div>
           <div className="h-8 w-[1px] bg-slate-100" />
           <button className="flex items-center gap-2 px-4 py-2 text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-lg">
              <FaFilter /> Filter
           </button>
           <button className="flex items-center gap-2 px-4 py-2 text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-lg">
              <FaCalendarAlt /> Date Range
           </button>
        </div>

        {/* Main Log Table */}
        <div className="pro-card bg-white overflow-hidden shadow-xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Event ID</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Event Message</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Batch Stage</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Severity</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {globalAlerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-slate-50/80 transition-all group cursor-pointer">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                          <FaClipboardList className="text-sm" />
                       </div>
                       <span className="text-xs font-black text-slate-800 uppercase tracking-widest">{alert.id}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-xs font-bold text-slate-700">{alert.message}</p>
                  </td>
                  <td className="px-8 py-6 text-center text-xs font-mono font-black text-slate-500 uppercase">
                    {batchStage}
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${
                      alert.type === 'info' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                      alert.type === 'warning' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-red-50 text-red-600 border-red-100'
                    }`}>
                      {alert.type}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex flex-col items-end">
                       <span className="text-xs font-bold text-slate-800">{alert.timestamp}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {globalAlerts.length === 0 && (
                <tr>
                   <td colSpan={5} className="text-center py-12 text-slate-400 text-xs font-bold uppercase tracking-widest">
                       No events in current simulation history
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">
           <span>Displaying {globalAlerts.length} recorded events</span>
           <div className="flex gap-4">
              <button className="hover:text-slate-800 disabled:opacity-30" disabled>Previous Page</button>
              <button className="hover:text-slate-800">Next Page</button>
           </div>
        </div>

      </div>
    </div>
  );
};
