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

export type FeedRateProfile = 'conservative' | 'balanced' | 'aggressive';

export type RecipeConfig = {
  dvbPercent: number;
  initiatorDosage: number;
  monomerWaterRatio: number;
  feedRateProfile: FeedRateProfile;
  targetPsdMin: number;
  targetPsdMax: number;
};

// ─── Phase 3: Structured Recommendation types ────────────────────

export type RecommendationSeverity = 'safe' | 'watch' | 'risk' | 'critical';

export type StructuredRecommendation = {
  id: string;
  nodeId?: string;
  nodeLabel?: string;
  severity: RecommendationSeverity;
  domain: string;         // "thermal" | "psd" | "crosslink" | "quality" | "feed" | "buffer"
  condition: string;
  rootCause: string;
  action: string;
  expectedImpact: string;
  command?: string;       // e.g. "LOWER_RPM"
  commandValue?: string;  // e.g. "reactor-A"
  timestamp: string;
};

export type MitigationEvent = {
  id: string;
  tick: number;
  timestamp: string;
  nodeId: string;
  nodeLabel: string;
  action: string;
  triggerCondition: string;
  beforeTemp?: number;
  beforeRpm?: number;
  beforePsdSpread?: number;
  beforeWBC?: number;
  beforeQuality?: string;
  afterTemp?: number;
  afterRpm?: number;
  afterPsdSpread?: number;
  afterWBC?: number;
  afterQuality?: string;
  resolved: boolean;
};

// ─── Phase 4: Run Records & Evidence types ─────────────────────

export type RunStatus = 'active' | 'completed' | 'aborted';

export type RunRecord = {
  id: string;
  label: string;
  status: RunStatus;
  createdAt: string;
  endedAt?: string;
  tickStart: number;
  tickEnd?: number;
  batchStageAtStart: string;
  batchStageAtEnd?: string;
  recipeAtStart: RecipeConfig;
  scenarioTag?: string;
};

export type RunKPIs = {
  runId: string;
  maxReactorTemp: number;
  maxPeakTemp: number;
  minPredictedWBC?: number;
  avgConversion: number;
  finalConversion: number;
  totalEnergyCostDelta: number;
  errorAlertCount: number;
  warningAlertCount: number;
  qualityGradeFinal: string;
  tickDuration: number;
  offSpecProxyScore: number;
  avgPsdSpread?: number;
  avgIonCapacity?: number;
};

export type RunComparisonDelta = {
  maxReactorTemp: number;
  maxPeakTemp: number;
  minPredictedWBC?: number;
  avgConversion: number;
  finalConversion: number;
  totalEnergyCostDelta: number;
  errorAlertCount: number;
  warningAlertCount: number;
  tickDuration: number;
  offSpecProxyScore: number;
};

export type RunComparison = {
  runA: RunRecord;
  runB: RunRecord;
  kpisA: RunKPIs;
  kpisB: RunKPIs;
  delta: RunComparisonDelta;
  narrative: string;
};

export type RunWithKPIs = {
  run: RunRecord;
  kpis: RunKPIs | null;
};

// ─── Phase 5: Decision Intelligence & Explainability types ──────

export type OptimizationPriority = 'quality' | 'energy' | 'throughput' | 'balanced';

export type OptimizationGoal = {
  targetWBCMin?: number;
  targetConversionMin?: number;
  targetMaxTemp?: number;
  targetMaxEnergyDelta?: number;
  prioritize: OptimizationPriority;
};

export type OptimizationConstraint = {
  dvbMin?: number;
  dvbMax?: number;
  initiatorMin?: number;
  initiatorMax?: number;
  monomerWaterMin?: number;
  monomerWaterMax?: number;
  allowedFeedProfiles?: FeedRateProfile[];
};

export type ExplainabilityTrace = {
  triggeredSignals: string[];
  causeHypothesis: string[];
  expectedImpact: string[];
  tradeoffs: string[];
};

export type RecipeCandidate = {
  rank: number;
  recipe: RecipeConfig;
  predictedKPIs: RunKPIs;
  confidence: number;
  score: number;
  trace: ExplainabilityTrace;
};

export type OptimizationResponse = {
  baselineRunId?: string;
  goal: OptimizationGoal;
  candidates: RecipeCandidate[];
  summary: string;
};

export type RunRankItem = {
  runId: string;
  label: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
};

export type RunRankingResponse = {
  ranking: RunRankItem[];
  scoringWeights: Record<string, number>;
};
