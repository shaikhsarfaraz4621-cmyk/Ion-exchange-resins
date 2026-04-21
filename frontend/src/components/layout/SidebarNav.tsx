import React from 'react';
import { 
  FaChartLine, 
  FaWaveSquare, 
  FaClipboardList, 
  FaExclamationCircle, 
  FaCogs, 
  FaUserCircle,
  FaSignOutAlt,
  FaBoxes,
  FaMicrochip,
  FaRobot
} from 'react-icons/fa';
import { useSimulationStore } from '../../store/simulationStore';

export const SidebarNav: React.FC = () => {
  const currentView = useSimulationStore(state => state.currentView);
  const setCurrentView = useSimulationStore(state => state.setCurrentView);
  const setIsFactoryOpen = useSimulationStore(state => state.setIsFactoryOpen);

  const primaryNav = [
    { id: 'dashboard', icon: FaChartLine, label: 'Live Dashboard' },
    { id: 'designer', icon: FaWaveSquare, label: 'Plant Twin (Designer)' },
  ];

  const operationsNav = [
    { id: 'logs', icon: FaClipboardList, label: 'Production Logs' },
    { id: 'alerts', icon: FaExclamationCircle, label: 'Alert Matrix' },
    { id: 'inventory', icon: FaBoxes, label: 'Inventory Pulse' },
    { id: 'advisor', icon: FaRobot, label: 'AI Advisor' },
  ];

  const NavItem = ({ item }: { item: typeof primaryNav[0] }) => {
    const isActive = currentView === item.id;
    return (
      <button
        onClick={() => setCurrentView(item.id as any)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-all duration-200 border-l-4 ${
          isActive 
            ? 'bg-blue-600/10 text-blue-500 border-blue-600' 
            : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-slate-200'
        }`}
      >
        <item.icon className={`text-lg ${isActive ? 'text-blue-500' : 'text-slate-500 group-hover:text-slate-300'}`} />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <nav className="w-64 bg-slate-950 flex flex-col h-full z-50 shadow-2xl shrink-0">
      
      {/* Brand Section */}
      <div className="p-6 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)]">
            <div className="w-4 h-4 border-2 border-white rounded-sm rotate-45" />
          </div>
          <div>
            <h1 className="text-white font-black tracking-tight text-lg">BLUE<span className="text-blue-500">STREAM</span></h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Enterprise Twin</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-8">
        
        {/* Main Section */}
        <div>
          <h2 className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">Monitoring</h2>
          <div className="space-y-1">
            {primaryNav.map(item => <NavItem key={item.id} item={item} />)}
          </div>
        </div>

        {/* Operations Section */}
        <div>
          <h2 className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">Operations</h2>
          <div className="space-y-1">
            {operationsNav.map(item => <NavItem key={item.id} item={item} />)}
          </div>
        </div>

        {/* Configuration Section */}
        <div>
          <h2 className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">System Console</h2>
          <div className="space-y-1">
            <button 
              onClick={() => setIsFactoryOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-all duration-200 border-l-4 text-slate-400 border-transparent hover:bg-white/5 hover:text-slate-200 group"
            >
              <FaCogs className="text-lg text-slate-500 group-hover:text-blue-500 transition-colors" />
              <span>Asset Engineering</span>
            </button>
            <button 
              onClick={() => setCurrentView('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-all duration-200 border-l-4 ${
                currentView === 'settings' 
                  ? 'bg-blue-600/10 text-blue-500 border-blue-600' 
                  : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <FaMicrochip className={`text-lg ${currentView === 'settings' ? 'text-blue-500' : 'text-slate-500'}`} />
              <span>Plant Configuration</span>
            </button>
          </div>
        </div>

      </div>

      {/* User Footer */}
      <div className="p-4 mt-auto border-t border-white/5 bg-slate-900/50">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 overflow-hidden">
             <FaUserCircle className="text-2xl text-slate-600" />
          </div>
          <div className="hidden lg:block overflow-hidden">
            <p className="text-xs font-bold text-slate-200 truncate">Sarfaraz Ahmed</p>
            <p className="text-[10px] text-slate-500 font-bold truncate">Systems Operator</p>
          </div>
        </div>
        <button className="w-full flex items-center gap-3 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-400/70 hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all">
          <FaSignOutAlt />
          <span>Exit Session</span>
        </button>
      </div>

    </nav>
  );
};
