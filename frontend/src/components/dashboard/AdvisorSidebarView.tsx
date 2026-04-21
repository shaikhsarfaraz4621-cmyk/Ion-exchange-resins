import React, { useState, useRef, useEffect } from 'react';
import { FaRobot, FaPaperPlane, FaBolt, FaShieldAlt, FaMicrochip } from 'react-icons/fa';
import { useSimulationStore } from '../../store/simulationStore';
import { api } from '../../services/api';

export const AdvisorSidebarView: React.FC = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
    { role: 'assistant', content: "Systems initialized. I am your BlueStream Plant Intelligence Advisor. I monitor real-time kinetics, thermal loads, and inventory interlocks across your digital twin. How can I assist with your process optimization today?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeAlerts = useSimulationStore(state => state.globalAlerts);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const res = await api.chatWithAdvisor(userMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Connectivity issue detected with the Intelligence Core. Please verify backend status." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      
      {/* View Header */}
      <div className="p-8 pb-4">
        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
          <span>Systems Intelligence</span><span>/</span><span className="text-slate-600">Cognitive Plant Advisor</span>
        </div>
        <div className="flex items-center justify-between">
           <h2 className="text-3xl font-black text-slate-800 tracking-tight">AI Process Advisor</h2>
           <div className="flex gap-2">
              <div className="px-3 py-1 rounded-full bg-blue-100 text-blue-600 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                 Neural Core Active
              </div>
              <div className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-600 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                 Interlock Synchronized
              </div>
           </div>
        </div>
      </div>

      <div className="flex-1 flex gap-8 p-8 overflow-hidden">
        
        {/* Chat Interface */}
        <div className="flex-1 bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-200 flex flex-col overflow-hidden">
          
          <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-5 rounded-2xl text-sm font-semibold leading-relaxed shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-slate-900 text-white rounded-tr-none' 
                    : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-none'
                }`}>
                  {m.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center mb-3 shadow-lg shadow-blue-600/20">
                       <FaRobot className="text-white text-xs" />
                    </div>
                  )}
                  {m.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-slate-50 p-4 rounded-2xl flex gap-1">
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" />
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce delay-75" />
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce delay-150" />
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-200">
             <div className="relative">
                <input 
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about reaction kinetics, bottlenecks, or safety protocols..."
                  className="w-full bg-white border-2 border-slate-200 rounded-2xl px-6 py-5 pr-16 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-blue-500 outline-none transition-all shadow-sm"
                />
                <button 
                  onClick={handleSend}
                  className="absolute right-3 top-3 w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/10"
                >
                  <FaPaperPlane className="text-xs" />
                </button>
             </div>
          </div>
        </div>

        {/* Intelligence Context Sidebar */}
        <div className="w-80 flex flex-col gap-6">
           
           <div className="p-6 bg-slate-900 rounded-[2rem] text-white space-y-4">
              <div className="flex items-center gap-3">
                 <FaBolt className="text-yellow-400 text-xl" />
                 <h3 className="text-xs font-black uppercase tracking-[0.2em]">Contextual Insights</h3>
              </div>
              <p className="text-[10px] text-slate-400 font-bold leading-relaxed">The Advisor leverages a multi-agentic reasoning engine to cross-reference sensor data with thermodynamic models.</p>
              
              <div className="space-y-3 pt-4">
                 <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Focus</p>
                    <p className="text-xs font-bold text-slate-200">Exothermic Control Loop</p>
                 </div>
                 <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Recommendation</p>
                    <p className="text-xs font-bold text-slate-200">Optimize Agitation Sparging</p>
                 </div>
              </div>
           </div>

           <div className="flex-1 p-6 bg-white border border-slate-200 rounded-[2rem] overflow-hidden flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                 <FaShieldAlt className="text-blue-600 text-xl" />
                 <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">Live Safety Feed</h3>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                 {activeAlerts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 opacity-50">
                       <FaMicrochip className="text-4xl" />
                       <p className="text-[10px] font-black uppercase tracking-widest">No Active Interlocks</p>
                    </div>
                 ) : (
                    activeAlerts.map(alert => (
                       <div key={alert.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                          <p className={`text-[9px] font-black uppercase tracking-widest ${alert.type === 'error' ? 'text-red-500' : 'text-blue-500'}`}>
                             {alert.type} • {alert.timestamp}
                          </p>
                          <p className="text-[11px] font-bold text-slate-700 leading-tight">{alert.message}</p>
                       </div>
                    ))
                 )}
              </div>
           </div>

        </div>

      </div>

    </div>
  );
};
