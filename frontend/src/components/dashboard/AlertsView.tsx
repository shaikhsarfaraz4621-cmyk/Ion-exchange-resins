import React from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { 
  FaExclamationCircle, 
  FaExclamationTriangle, 
  FaInfoCircle, 
  FaCheckCircle,
  FaRedo
} from 'react-icons/fa';

export const AlertsView: React.FC = () => {
  const { globalAlerts, clearAlerts } = useSimulationStore();

  const getAlertStyles = (type: string) => {
    switch(type) {
      case 'error': return 'border-red-200 bg-red-50 text-red-900 icon-red';
      case 'warning': return 'border-amber-200 bg-amber-50 text-amber-900 icon-amber';
      default: return 'border-blue-200 bg-blue-50 text-blue-900 icon-blue';
    }
  };

  const getSeverityLabel = (type: string) => {
     switch(type) {
        case 'error': return 'Critical Threat';
        case 'warning': return 'Process Variance';
        default: return 'Information';
     }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                <FaExclamationCircle />
                <span>Operations</span>
                <span>/</span>
                <span className="text-slate-600">Incident Matrix</span>
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Real-time Safety Telemetry</h2>
          </div>
          <button 
            onClick={clearAlerts}
            className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-red-600 hover:border-red-200 transition-all shadow-sm group"
          >
             <FaRedo className="group-hover:rotate-180 transition-transform duration-500" /> Clear Alert History
          </button>
        </div>

        {/* Global Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="pro-card p-6 border-l-4 border-red-500 bg-white">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Criticals</p>
                <h3 className="text-2xl font-black text-red-600">{globalAlerts.filter(a => a.type === 'error').length}</h3>
            </div>
            <div className="pro-card p-6 border-l-4 border-amber-500 bg-white">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Process Warnings</p>
                <h3 className="text-2xl font-black text-amber-600">{globalAlerts.filter(a => a.type === 'warning').length}</h3>
            </div>
            <div className="pro-card p-6 border-l-4 border-blue-500 bg-white">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Resolution Rate</p>
                <h3 className="text-2xl font-black text-blue-600">94.2%</h3>
            </div>
        </div>

        {/* Alerts Matrix */}
        <div className="space-y-4 pb-12">
          {globalAlerts.length === 0 ? (
            <div className="pro-card p-20 bg-white flex flex-col items-center justify-center border-dashed border-2 border-slate-200">
               <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 mb-6 border-2 border-slate-100">
                  <FaCheckCircle className="text-4xl" />
               </div>
               <h3 className="text-lg font-black text-slate-800">Workspace Clear</h3>
               <p className="text-xs text-slate-400 font-bold max-w-xs text-center mt-2">No active incidents or safety threshold violations detected in current batch telemetry.</p>
            </div>
          ) : (
            globalAlerts.map((alert) => (
              <div key={alert.id} className={`pro-card p-6 border-2 flex items-center justify-between transition-all hover:translate-x-1 duration-300 ${getAlertStyles(alert.type)}`}>
                 <div className="flex items-center gap-6">
                    <div className={`p-4 rounded-xl border flex items-center justify-center text-xl`}>
                       {alert.type === 'error' ? <FaExclamationCircle className="animate-pulse" /> : alert.type === 'warning' ? <FaExclamationTriangle /> : <FaInfoCircle />}
                    </div>
                    <div>
                       <div className="flex items-center gap-3 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                             {getSeverityLabel(alert.type)}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-slate-400 opacity-30" />
                          <span className="text-[10px] font-mono font-bold opacity-60">ID: {alert.id}</span>
                       </div>
                       <h4 className="text-sm font-black tracking-tight">{alert.message}</h4>
                    </div>
                 </div>
                 <div className="text-right flex flex-col items-end">
                    <span className="text-xs font-black font-mono opacity-60">{alert.timestamp}</span>
                    <button className="text-[9px] font-black uppercase tracking-widest mt-2 px-3 py-1 bg-white/50 border border-slate-900/10 rounded-md hover:bg-white transition-all">
                       Acknowledge
                    </button>
                 </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
