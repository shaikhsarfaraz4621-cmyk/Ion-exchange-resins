import { create } from 'zustand';
import type { NodeFactoryConfig, InventoryItem } from '../types';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import type { Node, Edge, Connection, OnNodesChange, OnEdgesChange } from 'reactflow';
import { api } from '../services/api';

// ─── Mitigation Action Descriptor ───────────────────────────────────────────
export interface MitigationAction {
  nodeId: string;
  action: 'LOWER_RPM' | 'START_COOLING' | 'REPLENISH' | 'DRAIN_BUFFER';
  label: string;
  description: string;
}

// ─── Store Interface ────────────────────────────────────────────────────────
interface SimulationStore {
  factoryConfigs: NodeFactoryConfig[];
  nodes: Node[];
  edges: Edge[];
  batchStage: 'setup' | 'polymerization' | 'functionalization' | 'hydration' | 'complete';
  globalAlerts: { id: string, type: 'warning' | 'error' | 'info', message: string, timestamp: string }[];
  currentView: 'dashboard' | 'designer' | 'logs' | 'alerts' | 'settings' | 'inventory' | 'advisor';
  simulationHistory: { tick: number, temp: number, conversion: number, stock: number }[];
  inventory: InventoryItem[];
  tick: number;
  isSimulating: boolean;
  // Chat Control
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  isFactoryOpen: boolean;
  setIsFactoryOpen: (open: boolean) => void;
  // AI Mitigation
  activeMitigation: MitigationAction | null;
  setActiveMitigation: (m: MitigationAction | null) => void;
  // Setters
  setIsSimulating: (sim: boolean) => void;
  setTick: (tick: number) => void;
  addConfig: (config: NodeFactoryConfig) => void;
  updateConfig: (id: string, config: Partial<NodeFactoryConfig>) => void;
  activeConfigId: string | null;
  setActiveConfigId: (id: string | null) => void;
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
  setBatchStage: (stage: 'setup' | 'polymerization' | 'functionalization' | 'hydration' | 'complete') => void;
  addAlert: (alert: { type: 'warning' | 'error' | 'info', message: string }) => void;
  clearAlerts: () => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (params: Connection | Edge) => void;
  setCurrentView: (view: 'dashboard' | 'designer' | 'logs' | 'alerts' | 'settings' | 'inventory' | 'advisor') => void;
  pushHistory: (snapshot: { tick: number, temp: number, conversion: number, stock: number }) => void;
  updateInventory: (id: string, delta: number) => void;
  pollInterval: number;
  setPollInterval: (interval: number) => void;
  batchSize: number;
  interarrivalTicks: number;
  setSimulationSettings: (settings: { batchSize?: number, interarrivalTicks?: number }) => void;
  isBackendConnected: boolean;
  setIsBackendConnected: (connected: boolean) => void;
}

// ─── Default Topology with Surge Buffers ────────────────────────────────────
const DEFAULT_NODES: Node[] = [
  { id: 'tank-styrene', type: 'storage', position: { x: 50, y: 200 },
    data: { label: 'Styrene Monomer Feed', materialType: 'Styrene', capacity: 20000, currentLevel: 18500 } },
  { id: 'tank-dvb', type: 'storage', position: { x: 50, y: 450 },
    data: { label: 'DVB Crosslinker Feed', materialType: 'DVB', capacity: 5000, currentLevel: 4400 } },

  // Line A — Bulk Cation
  { id: 'reactor-A', type: 'reactor', position: { x: 400, y: 50 },
    data: { label: 'Bulk Cation Synthesis A', capacity: 25000, temp: 25, conversion: 0, status: 'idle', configId: 'CATION-001', reactorMode: 'cation', rpm: 120 } },
  { id: 'washer-A', type: 'washer', position: { x: 750, y: 50 },
    data: { label: 'High-Speed Centrifuge Wash A', status: 'idle', throughput: 0 } },
  { id: 'buffer-A', type: 'buffer', position: { x: 1050, y: 50 },
    data: { label: 'Surge Buffer A', capacity: 8000, currentLevel: 0, status: 'idle' } },

  // Line B — Precision Anion
  { id: 'reactor-B', type: 'reactor', position: { x: 400, y: 420 },
    data: { label: 'Precision Anion Synthesis B', capacity: 8000, temp: 25, conversion: 0, status: 'idle', configId: 'ANION-002', reactorMode: 'anion', rpm: 80 } },
  { id: 'washer-B', type: 'washer', position: { x: 750, y: 420 },
    data: { label: 'Precision Wash B (Slow)', status: 'idle', throughput: 0 } },
  { id: 'buffer-B', type: 'buffer', position: { x: 1050, y: 420 },
    data: { label: 'Surge Buffer B', capacity: 8000, currentLevel: 0, status: 'idle' } },

  // Shared downstream
  { id: 'dryer-shared', type: 'dryer', position: { x: 1350, y: 230 },
    data: { label: 'Master Flash Dryer', status: 'idle', moisture: 100, temp: 25 } },
  { id: 'packager-final', type: 'packager', position: { x: 1680, y: 230 },
    data: { label: 'Final Packaging & QC', status: 'idle', throughput: 0 } },
];

const DEFAULT_EDGES: Edge[] = [
  // Feed → Reactors
  { id: 'e-styrene-A', source: 'tank-styrene', target: 'reactor-A', type: 'flowing', style: { strokeWidth: 3, stroke: '#38bdf8' } },
  { id: 'e-dvb-A', source: 'tank-dvb', target: 'reactor-A', type: 'flowing', style: { strokeWidth: 3, stroke: '#38bdf8' } },
  { id: 'e-styrene-B', source: 'tank-styrene', target: 'reactor-B', type: 'flowing', style: { strokeWidth: 3, stroke: '#a855f7' } },
  { id: 'e-dvb-B', source: 'tank-dvb', target: 'reactor-B', type: 'flowing', style: { strokeWidth: 3, stroke: '#a855f7' } },
  // Line A — Reactor → Washer → Buffer → Dryer
  { id: 'e-A-washer', source: 'reactor-A', target: 'washer-A', type: 'flowing', style: { strokeWidth: 3, stroke: '#06b6d4' } },
  { id: 'e-washer-A-buf', source: 'washer-A', target: 'buffer-A', type: 'flowing', style: { strokeWidth: 3, stroke: '#0ea5e9' } },
  { id: 'e-buf-A-dryer', source: 'buffer-A', target: 'dryer-shared', type: 'flowing', style: { strokeWidth: 3, stroke: '#f97316' } },
  // Line B — Reactor → Washer → Buffer → Dryer
  { id: 'e-B-washer', source: 'reactor-B', target: 'washer-B', type: 'flowing', style: { strokeWidth: 3, stroke: '#d946ef' } },
  { id: 'e-washer-B-buf', source: 'washer-B', target: 'buffer-B', type: 'flowing', style: { strokeWidth: 3, stroke: '#a855f7' } },
  { id: 'e-buf-B-dryer', source: 'buffer-B', target: 'dryer-shared', type: 'flowing', style: { strokeWidth: 3, stroke: '#f97316' } },
  // Output
  { id: 'e-dryer-packager', source: 'dryer-shared', target: 'packager-final', type: 'flowing', style: { strokeWidth: 3, stroke: '#10b981' } },
];

// ─── Store Creation ──────────────────────────────────────────────────────────
export const useSimulationStore = create<SimulationStore>((set, get) => ({
  factoryConfigs: [
    { id: 'CATION-001', geometry: { diameter: 4.5, height: 8.0, baffleCount: 6 }, agitation: { impellerType: 'Turbine', powerNumber: 7.2 } },
    { id: 'ANION-002', geometry: { diameter: 2.0, height: 4.0, baffleCount: 4 }, agitation: { impellerType: 'Paddle', powerNumber: 3.8 } }
  ],
  nodes: DEFAULT_NODES,
  edges: DEFAULT_EDGES,
  batchStage: 'setup',
  globalAlerts: [],
  currentView: 'designer',
  simulationHistory: [],
  inventory: [
    { id: 'styrene', name: 'Styrene Monomer', category: 'raw', unit: 'L', currentStock: 18500, maxCapacity: 20000, reorderPoint: 2000, costPerUnit: 1.20 },
    { id: 'dvb', name: 'DVB Crosslinker', category: 'raw', unit: 'L', currentStock: 4400, maxCapacity: 5000, reorderPoint: 500, costPerUnit: 4.80 },
    { id: 'h2so4', name: 'Sulfuric Acid (H₂SO₄)', category: 'raw', unit: 'L', currentStock: 1800, maxCapacity: 3000, reorderPoint: 400, costPerUnit: 0.85 },
    { id: 'naoh', name: 'Caustic Soda (NaOH)', category: 'raw', unit: 'kg', currentStock: 950, maxCapacity: 2000, reorderPoint: 300, costPerUnit: 0.55 },
    { id: 'copolymer-wip', name: 'Copolymer Beads (Unwashed)', category: 'wip', unit: 'kg', currentStock: 0, maxCapacity: 10000, reorderPoint: 0, costPerUnit: 0 },
    { id: 'washed-beads', name: 'Washed Beads (Clean)', category: 'wip', unit: 'kg', currentStock: 0, maxCapacity: 8000, reorderPoint: 0, costPerUnit: 0 },
    { id: 'cation-resin', name: 'Cation Resin (Finished)', category: 'finished', unit: 'kg', currentStock: 0, maxCapacity: 5000, reorderPoint: 0, costPerUnit: 12.50 },
    { id: 'anion-resin', name: 'Anion Resin (Finished)', category: 'finished', unit: 'kg', currentStock: 0, maxCapacity: 5000, reorderPoint: 0, costPerUnit: 18.20 },
  ],
  tick: 0,
  isSimulating: false,
  isBackendConnected: true,
  setIsBackendConnected: (connected) => set({ isBackendConnected: connected }),

  // Chat / Mitigation
  isChatOpen: false,
  setIsChatOpen: (open) => set({ isChatOpen: open }),
  isFactoryOpen: false,
  setIsFactoryOpen: (open) => set({ isFactoryOpen: open }),
  activeMitigation: null,
  setActiveMitigation: (m) => set({ activeMitigation: m }),

  // Simulation control
  setIsSimulating: (sim) => set({ isSimulating: sim }),
  setTick: (tick) => set({ tick }),

  addConfig: (config) => {
    set((state) => ({ factoryConfigs: [...state.factoryConfigs, config] }));
    api.updateState({ factoryConfigs: get().factoryConfigs });
  },
  updateConfig: (id, updatedFields) => {
    set((state) => ({
      factoryConfigs: state.factoryConfigs.map(c => c.id === id ? { ...c, ...updatedFields } : c)
    }));
    api.updateState({ factoryConfigs: get().factoryConfigs });
  },
  activeConfigId: 'CATION-001',
  setActiveConfigId: (id) => set({ activeConfigId: id }),
  setNodes: (nodes) => set((state) => ({ nodes: typeof nodes === 'function' ? nodes(state.nodes) : nodes })),
  setEdges: (edges) => set((state) => ({ edges: typeof edges === 'function' ? edges(state.edges) : edges })),
  setBatchStage: (stage) => set({ batchStage: stage }),
  addAlert: (alert) => set((state) => ({
    globalAlerts: [
      { ...alert, id: Math.random().toString(36).substr(2, 9), timestamp: new Date().toLocaleTimeString() },
      ...state.globalAlerts
    ].slice(0, 10)
  })),
  clearAlerts: () => set({ globalAlerts: [] }),
  onNodesChange: (changes) => {
    set((state) => {
      const newNodes = applyNodeChanges(changes, state.nodes);
      const updatedNodes = newNodes.filter((n, i) => n.position !== state.nodes[i]?.position || n.data !== state.nodes[i]?.data);
      if (updatedNodes.length > 0 && !get().isSimulating) {
        api.updateState({ nodes: updatedNodes });
      }
      return { nodes: newNodes };
    });
  },
  onEdgesChange: (changes) => {
    set((state) => {
      const newEdges = applyEdgeChanges(changes, state.edges);
      if (!get().isSimulating) api.updateState({ edges: newEdges });
      return { edges: newEdges };
    });
  },
  onConnect: (params) => {
    set((state) => {
      const newEdges = addEdge({
        ...params,
        type: 'flowing',
        animated: true,
        style: { strokeWidth: 3, stroke: '#38bdf8' }
      }, state.edges);
      if (!get().isSimulating) api.updateState({ edges: newEdges });
      return { edges: newEdges };
    });
  },
  setCurrentView: (view) => set({ currentView: view }),
  pushHistory: (snapshot) => set((state) => ({
    simulationHistory: [...state.simulationHistory, snapshot].slice(-50)
  })),
  updateInventory: (id, delta) => set((state) => ({
    inventory: state.inventory.map(item =>
      item.id === id ? { ...item, currentStock: Math.max(0, Math.min(item.maxCapacity, item.currentStock + delta)) } : item
    )
  })),
  pollInterval: 2000,
  setPollInterval: (interval: number) => set({ pollInterval: interval }),
  batchSize: 2000,
  interarrivalTicks: 60,
  setSimulationSettings: (settings) => {
    set((state) => ({ ...state, ...settings }));
    api.updateState(settings);
  }
}));
