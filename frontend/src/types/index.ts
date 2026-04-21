export interface SimulationNodeData {
  label: string;
  type: 'reactor' | 'storage' | 'process' | 'washer' | 'dryer' | 'packager';
  status: 'idle' | 'running' | 'warning' | 'error';
  capacity?: number;
  currentLevel?: number;
  materialType?: string;
  temp?: number;
  conversion?: number;
  rpm?: number;
  configId?: string;
  moisture?: number;
  throughput?: number;
  pressure?: number;
  psdMean?: number;
  exothermicDelta?: number;
  psdBins?: number[];
}

export interface SimulationState {
  isSimulating: boolean;
  tick: number;
  batchStage: 'setup' | 'polymerization' | 'functionalization' | 'hydration' | 'complete';
  globalAlerts: { id: string, type: 'warning' | 'error' | 'info', message: string, timestamp: string }[];
}

export type InventoryItem = {
  id: string;
  name: string;
  category: 'raw' | 'wip' | 'finished';
  unit: string;
  currentStock: number;
  maxCapacity: number;
  reorderPoint: number;
  costPerUnit: number;
};

export type NodeFactoryConfig = {
    id: string;
    geometry: {
        diameter: number;
        height: number;
        baffleCount: number;
    };
    agitation: {
        impellerType: string;
        powerNumber: number;
    };
};
