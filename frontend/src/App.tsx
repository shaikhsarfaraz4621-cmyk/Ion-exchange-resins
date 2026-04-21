import { Header } from './components/layout/Header';
import { ControlSidebar } from './components/sidebar/ControlSidebar';
import { AnalyticsSidebar } from './components/sidebar/AnalyticsSidebar';
import { PlantCanvas } from './components/canvas/PlantCanvas';
import { NodeFactory } from './components/factory/NodeFactory';
import { SidebarNav } from './components/layout/SidebarNav';
import { DashboardView } from './components/dashboard/DashboardView';
import { LogsView } from './components/dashboard/LogsView';
import { AlertsView } from './components/dashboard/AlertsView';
import { SettingsView } from './components/dashboard/SettingsView';
import { InventoryPulse } from './components/dashboard/InventoryPulse';
import { AdvisorSidebarView } from './components/dashboard/AdvisorSidebarView';
import { PlantChatbot } from './components/chatbot/PlantChatbot';
import { useSimulationStore } from './store/simulationStore';

function App() {
  const currentView = useSimulationStore(state => state.currentView);
  const isFactoryOpen = useSimulationStore(state => state.isFactoryOpen);
  const setIsFactoryOpen = useSimulationStore(state => state.setIsFactoryOpen);

  // ... (rest of renderView remains same but update the button)
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'logs':
        return <LogsView />;
      case 'alerts':
        return <AlertsView />;
      case 'settings':
        return <SettingsView />;
      case 'inventory':
        return (
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="mb-8">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  <span>Operations</span><span>/</span><span className="text-slate-600">Inventory Management</span>
                </div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Material & Stock Ledger</h2>
              </div>
              <InventoryPulse />
            </div>
          </div>
        );
      case 'advisor':
        return <AdvisorSidebarView />;
      case 'designer':
      default:
        return (
          <div className="flex-1 flex overflow-hidden p-6 gap-6">
               {/* Left Modular Sidebar */}
              <aside className="w-72 h-full flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar pb-12">
                  <ControlSidebar />
                  <button 
                      onClick={() => setIsFactoryOpen(true)}
                      className="bg-white border-2 border-slate-200 p-6 rounded-xl text-blue-600 font-black text-[10px] tracking-[0.2em] uppercase text-center transition-all hover:bg-slate-50 shadow-sm"
                  >
                      Open Node Factory
                  </button>
              </aside>

              {/* Center Canvas */}
              <main className="flex-1 h-full relative group pro-card !border-slate-200 overflow-hidden">
                <PlantCanvas />
              </main>

              {/* Right Modular Sidebar */}
              <aside className="w-80 h-full flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar pb-12">
              <AnalyticsSidebar />
              </aside>
          </div>
        );
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-50 flex overflow-hidden text-slate-900 font-sans selection:bg-blue-600/20">
      
      {/* ... (SVG assets remain same) */}
      <svg className="hidden">
        <defs>
          <filter id="glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feColorMatrix 
               in="coloredBlur" 
               type="matrix" 
               values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.8 0" 
               result="intenseBlur"
            />
            <feMerge>
              <feMergeNode in="intenseBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <SidebarNav />

      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <Header />
        <div className="flex-1 flex overflow-hidden relative z-10">
           {renderView()}
        </div>
      </div>

      {/* Factory Configuration Overlay */}
      {isFactoryOpen && <NodeFactory onClose={() => setIsFactoryOpen(false)} />}

      {/* AI Chatbot */}
      <PlantChatbot />
    </div>
  );
}

export default App;
