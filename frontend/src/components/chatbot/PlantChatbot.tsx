import React, { useState, useRef, useEffect } from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { FaRobot, FaChevronDown, FaPaperPlane, FaShieldAlt, FaCheckCircle } from 'react-icons/fa';
import { api } from '../../services/api';

type ChatMessage = {
  role: 'user' | 'bot';
  text: string;
  timestamp: string;
};

type ProactiveInsight = { key: string; text: string } | null;

// ─── Local Fallback AI ───────────────────────────────────────────────────────
const generateBotResponse = (query: string, state: ReturnType<typeof useSimulationStore.getState>): string => {
  const q = query.toLowerCase();
  const { nodes, inventory, batchStage, globalAlerts } = state;
  const reactors = nodes.filter(n => n.type === 'reactor');
  const storages = nodes.filter(n => n.type === 'storage');
  const dryer = nodes.find(n => n.type === 'dryer');
  const buffers = nodes.filter(n => n.type === 'buffer');
  const runningReactors = reactors.filter(r => r.data.status === 'running');
  const emptyTanks = storages.filter(s => (s.data.currentLevel || 0) <= 0);

  if (q.includes('status') || (q.includes('how') && q.includes('plant'))) {
    return `Plant Status: ${runningReactors.length}/${reactors.length} reactors active. Batch stage: ${batchStage.toUpperCase()}.\n\nBuffers:\n${buffers.map(b => `• ${b.data.label}: ${((b.data.currentLevel || 0) / (b.data.capacity || 8000) * 100).toFixed(0)}% full`).join('\n')}\n\n${emptyTanks.length > 0 ? `⚠️ ${emptyTanks.length} feed tank(s) depleted.` : 'All feed tanks operational.'}`;
  }
  if (q.includes('buffer')) {
    return `Surge Buffers:\n${buffers.map(b => `• ${b.data.label}: ${(b.data.currentLevel || 0).toFixed(0)} kg / ${b.data.capacity || 8000} kg (${((b.data.currentLevel || 0) / (b.data.capacity || 8000) * 100).toFixed(0)}%) — Status: ${b.data.status}`).join('\n')}\n\nBuffers decouple reactors from downstream dryers. If a buffer is at 90%+, reduce upstream washer throughput.`;
  }
  if (q.includes('inventory') || q.includes('stock') || q.includes('material')) {
    const raw = inventory.filter(i => i.category === 'raw');
    const low = raw.filter(i => i.currentStock <= i.reorderPoint && i.reorderPoint > 0);
    return `Inventory Summary:\n${raw.map(i => `• ${i.name}: ${i.currentStock.toLocaleString()} ${i.unit} (${Math.round((i.currentStock / i.maxCapacity) * 100)}%)`).join('\n')}${low.length > 0 ? `\n\n⚠️ LOW STOCK: ${low.map(i => i.name).join(', ')} — below reorder threshold.` : '\n\nAll materials within safe stock levels.'}`;
  }
  if (q.includes('conversion') || q.includes('performance') || q.includes('progress')) {
    return `Reactor Performance:\n${reactors.map(r => `• ${r.data.label} [${r.data.reactorMode || 'cation'}]: ${(r.data.conversion || 0).toFixed(1)}% conversion, ${(r.data.temp || 25).toFixed(1)}°C — ${r.data.status}`).join('\n')}`;
  }
  if (q.includes('temp') || q.includes('heat') || q.includes('thermal')) {
    return `Thermal Summary:\n${reactors.map(r => `• ${r.data.label}: ${(r.data.temp || 25).toFixed(1)}°C ${(r.data.temp || 25) > 80 ? '🔴 EXOTHERMIC RISK' : '🟢 NORMAL'}`).join('\n')}${dryer ? `\n• ${dryer.data.label}: ${(dryer.data.temp || 25).toFixed(0)}°C` : ''}`;
  }
  if (q.includes('alert') || q.includes('warning') || q.includes('error')) {
    if (globalAlerts.length === 0) return 'No active alerts. Plant is operating normally.';
    return `Active Alerts (${globalAlerts.length}):\n${globalAlerts.slice(0, 5).map(a => `• [${a.type.toUpperCase()}] ${a.message} (${a.timestamp})`).join('\n')}`;
  }
  return `I can help with: plant status, buffer levels, reactor performance, inventory, temperature, and alerts. Try "What is the plant status?" or "How are the surge buffers?"`;
};

const getProactiveInsight = (state: ReturnType<typeof useSimulationStore.getState>): ProactiveInsight => {
  const reactors = state.nodes.filter(n => n.type === 'reactor');
  const buffers = state.nodes.filter(n => n.type === 'buffer');
  const storages = state.nodes.filter(n => n.type === 'storage');

  const hot = reactors
    .filter(r => (r.data.temp || 25) >= 85)
    .sort((a, b) => (b.data.temp || 25) - (a.data.temp || 25))[0];
  if (hot) {
    return {
      key: `hot-${hot.id}-${Math.floor((hot.data.temp || 25) / 5)}`,
      text: `📈 PROACTIVE INSIGHT: ${hot.data.label} is at ${(hot.data.temp || 25).toFixed(1)}°C, approaching thermal trip territory.\n\nBusiness impact: unexpected shutdown risk and unstable batch quality.\nRecommended action: apply cooling mitigation now to keep throughput stable.`,
    };
  }

  const highBuffer = buffers
    .filter(b => ((b.data.currentLevel || 0) / (b.data.capacity || 8000)) >= 0.85)
    .sort((a, b) => ((b.data.currentLevel || 0) / (b.data.capacity || 8000)) - ((a.data.currentLevel || 0) / (a.data.capacity || 8000)))[0];
  if (highBuffer) {
    const pct = ((highBuffer.data.currentLevel || 0) / (highBuffer.data.capacity || 8000)) * 100;
    return {
      key: `buffer-${highBuffer.id}-${Math.floor(pct / 5)}`,
      text: `📈 PROACTIVE INSIGHT: ${highBuffer.data.label} has reached ${pct.toFixed(0)}% capacity.\n\nBusiness impact: near-overflow can pause both lines and create downstream dryer starvation after interlock.\nRecommended action: drain buffer or reduce upstream load before overflow trigger.`,
    };
  }

  const emptyTank = storages.find(s => (s.data.currentLevel || 0) <= 0);
  if (emptyTank) {
    return {
      key: `tank-empty-${emptyTank.id}`,
      text: `📈 PROACTIVE INSIGHT: ${emptyTank.data.label} is depleted.\n\nBusiness impact: feed starvation will halt polymerization and reduce effective utilization.\nRecommended action: replenish feed immediately to avoid batch discontinuity.`,
    };
  }

  // Even when no hard fault exists, provide value-driving operational suggestions.
  const runningReactors = reactors.filter(r => (r.data.status || "").toLowerCase() === "running");
  const avgConversion = runningReactors.length > 0
    ? runningReactors.reduce((acc, r) => acc + (r.data.conversion || 0), 0) / runningReactors.length
    : 0;
  const stage = (state.batchStage || "setup").toUpperCase();
  const bucket = Math.floor((state.tick || 0) / 10);

  if ((state.tick || 0) > 0) {
    return {
      key: `nominal-${stage}-${bucket}`,
      text: `💡 PROACTIVE OPTIMIZATION: System is stable in ${stage} phase.\n\nCurrent average reactor conversion is ${avgConversion.toFixed(1)}%.\nSuggested action: maintain this operating window and monitor buffer fill trend to prevent dryer-side congestion.`,
    };
  }

  return {
    key: "nominal-start",
    text: "💡 PROACTIVE OPTIMIZATION: Simulation initialized. Start the batch to receive live AI insights and interventions in real time.",
  };
};

// ─── Component ───────────────────────────────────────────────────────────────
export const PlantChatbot: React.FC = () => {
  const isChatOpen = useSimulationStore(state => state.isChatOpen);
  const setIsChatOpen = useSimulationStore(state => state.setIsChatOpen);
  const activeMitigation = useSimulationStore(state => state.activeMitigation);
  const setActiveMitigation = useSimulationStore(state => state.setActiveMitigation);
  const setIsSimulating = useSimulationStore(state => state.setIsSimulating);
  const isSimulating = useSimulationStore(state => state.isSimulating);
  const tick = useSimulationStore(state => state.tick);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: 'AUTONEX AI Advisor online. I monitor all plant systems including surge buffers and reactor thermodynamics. Ask me anything.', timestamp: new Date().toLocaleTimeString() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mitigating, setMitigating] = useState(false);
  const [injectingScenario, setInjectingScenario] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastInsightRef = useRef<{ key: string; tick: number } | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // When interlock triggers (activeMitigation set), prepend a bot message
  useEffect(() => {
    if (activeMitigation && isChatOpen) {
      const alertMsg: ChatMessage = {
        role: 'bot',
        text: `🚨 SAFETY INTERLOCK TRIGGERED\n\nSimulation paused due to a critical fault.\n\n${activeMitigation.description}\n\nClick "Implement Mitigation" below to apply the fix and resume the simulation.`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, alertMsg]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMitigation, isChatOpen]);

  // Proactive AI assistant: periodically surfaces actionable insight while simulation is running.
  useEffect(() => {
    if (!isChatOpen || !isSimulating) return;

    const id = window.setInterval(() => {
      const state = useSimulationStore.getState();
      const insight = getProactiveInsight(state);
      if (!insight) return;

      const last = lastInsightRef.current;
      const nowTick = state.tick || 0;
      const sameKey = last?.key === insight.key;
      const tooSoon = last ? nowTick - last.tick < 8 : false;
      if (sameKey && tooSoon) return;

      lastInsightRef.current = { key: insight.key, tick: nowTick };
      setMessages(prev => [...prev, {
        role: 'bot',
        text: insight.text,
        timestamp: new Date().toLocaleTimeString(),
      }]);
    }, 12000);

    return () => window.clearInterval(id);
  }, [isChatOpen, isSimulating]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: ChatMessage = { role: 'user', text: input.trim(), timestamp: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    try {
      const { reply } = await api.chatWithAdvisor(userMsg.text);
      setMessages(prev => [...prev, { role: 'bot', text: reply, timestamp: new Date().toLocaleTimeString() }]);
    } catch {
      const state = useSimulationStore.getState();
      const response = generateBotResponse(userMsg.text, state);
      setMessages(prev => [...prev, { role: 'bot', text: response, timestamp: new Date().toLocaleTimeString() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImplementMitigation = async () => {
    if (!activeMitigation || mitigating) return;
    setMitigating(true);
    try {
      await api.mitigate(activeMitigation.action, activeMitigation.nodeId);
      
      // Small pause to allow backend state to stabilize before resuming polling
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await api.startSimulation();
      setIsSimulating(true);
      setActiveMitigation(null);
      
      setMessages(prev => [...prev, {
        role: 'bot',
        text: `✅ Mitigation applied: ${activeMitigation.label}\n\nSimulation resumed. Stabilization grace period active (5 ticks).`,
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: '⚠️ Mitigation failed to apply. Please check backend connection and try again.',
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } finally {
      setMitigating(false);
    }
  };

  const handleInjectScenario = async (scenario: 'reactor_overheat' | 'feed_starvation' | 'buffer_overflow') => {
    if (injectingScenario) return;
    setInjectingScenario(true);
    try {
      const result = await api.triggerDemoScenario(scenario);
      setMessages(prev => [...prev, {
        role: 'bot',
        text: `🧪 DEMO SCENARIO APPLIED: ${scenario.replace('_', ' ').toUpperCase()}\n\n${result.summary || 'Scenario injected successfully.'}\n\nThe system will detect this condition and recommend corrective mitigation in real time.`,
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: '⚠️ Failed to inject demo scenario. Please verify backend connectivity.',
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } finally {
      setInjectingScenario(false);
    }
  };

  // ─── Collapsed State — Floating Button ───────────────────────────────────
  if (!isChatOpen) {
    return (
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-2xl shadow-slate-900/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
      >
        <FaRobot className="text-xl" />
      </button>
    );
  }

  // ─── Expanded State — Full Chat Window ───────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[440px] h-[600px] bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200 flex flex-col overflow-hidden">
      
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <FaRobot className="text-sm" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest">AUTONEX AI</h3>
            <p className="text-[9px] text-slate-400 font-bold">Plant Intelligence Advisor</p>
          </div>
        </div>
        <button onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1">
          <FaChevronDown />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-slate-900 text-white rounded-br-md'
                : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
            }`}>
              <p className="text-[11px] leading-relaxed whitespace-pre-line font-medium">{msg.text}</p>
              <p className={`text-[8px] font-bold mt-1 ${msg.role === 'user' ? 'text-slate-400' : 'text-slate-300'}`}>{msg.timestamp}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="text-[9px] text-slate-400 font-bold ml-2">AI thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Mitigation Action Card (shows when interlock is triggered) ── */}
      {activeMitigation && (
        <div className="mx-4 mb-3 rounded-xl border-2 border-red-400 bg-red-50 overflow-hidden shrink-0">
          <div className="bg-red-500 px-4 py-2 flex items-center gap-2">
            <FaShieldAlt className="text-white text-xs" />
            <span className="text-white text-[10px] font-black uppercase tracking-widest">Safety Interlock Active</span>
          </div>
          <div className="p-4">
            <p className="text-[11px] font-black text-red-700 mb-1">{activeMitigation.label}</p>
            <p className="text-[10px] text-red-500 font-semibold leading-relaxed mb-3">{activeMitigation.description}</p>
            <button
              onClick={handleImplementMitigation}
              disabled={mitigating}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                mitigating
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white active:scale-95 shadow-lg shadow-red-500/30'
              }`}
            >
              {mitigating ? (
                <>Applying Fix...</>
              ) : (
                <><FaCheckCircle /> Implement Mitigation & Resume</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Demo Controls */}
      <div className="mx-4 mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 shrink-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-blue-700 mb-2">Demo Scenarios</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleInjectScenario('reactor_overheat')}
            disabled={injectingScenario}
            className="py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 transition-all disabled:opacity-50"
          >
            Overheat
          </button>
          <button
            onClick={() => handleInjectScenario('feed_starvation')}
            disabled={injectingScenario}
            className="py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 transition-all disabled:opacity-50"
          >
            Stockout
          </button>
          <button
            onClick={() => handleInjectScenario('buffer_overflow')}
            disabled={injectingScenario}
            className="py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 transition-all disabled:opacity-50"
          >
            Overflow
          </button>
        </div>
        <p className="text-[8px] text-blue-600 font-bold mt-2">Live tick: T+{tick}m • Auto insights every 12s while running</p>
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={isLoading ? 'Waiting for AI...' : 'Ask about plant status, surge buffers, alerts...'}
            disabled={isLoading}
            className={`flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-slate-800 outline-none focus:ring-2 ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-slate-300 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className={`w-11 h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <FaPaperPlane className="text-xs" />
          </button>
        </div>
      </div>
    </div>
  );
};
