"""
Pydantic schemas mirroring the frontend simulationStore.ts types exactly.
No database — these are pure data models for API validation.
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum


# ─── Node Data Models ───────────────────────────────────────────

class NodePosition(BaseModel):
    x: float
    y: float


class NodeData(BaseModel):
    """Union of all possible node data fields across node types."""
    label: str
    # Storage fields
    materialType: Optional[str] = None
    capacity: Optional[float] = None
    currentLevel: Optional[float] = None
    # Reactor fields
    temp: Optional[float] = None
    conversion: Optional[float] = None
    status: Optional[str] = None
    configId: Optional[str] = None
    reactorMode: Optional[str] = None
    rpm: Optional[float] = None
    # Washer / Packager fields
    throughput: Optional[float] = None
    # Dryer fields
    moisture: Optional[float] = None
    # Physics engine outputs
    powerKw: Optional[float] = None        # Agitation power draw (kW)
    peakTemp: Optional[float] = None       # Max temperature seen (for QC)
    # Sequence optimization
    waitTime: Optional[float] = 0.0        # Cumulative idle ticks
    isBottleneck: Optional[bool] = False   # True if this node is the current bottleneck
    nodeId: Optional[str] = None           # Internal reference
    # QC
    qualityGrade: Optional[str] = "AAA"   # AAA / AA / B / Fail
    pressure: Optional[float] = None
    psdMean: Optional[float] = None
    exothermicDelta: Optional[float] = None
    psdBins: Optional[list[int]] = None
    mitigationGraceTicks: Optional[int] = 0 # Ticks to ignore safety stops after a mitigation
    coolingMode: Optional[bool] = False
    coolingTicksRemaining: Optional[int] = 0
    # Phase 2 — Recipe-driven physics outputs
    crosslinkDensity: Optional[float] = None
    swellingIndex: Optional[float] = None
    rigidityIndex: Optional[float] = None
    psdSpread: Optional[float] = None
    predictedWBC: Optional[float] = None
    predictedIonCapacity: Optional[float] = None


class PlantNode(BaseModel):
    id: str
    type: str  # 'storage' | 'reactor' | 'washer' | 'dryer' | 'packager'
    position: NodePosition
    data: NodeData


# ─── Edge Model ─────────────────────────────────────────────────

class EdgeStyle(BaseModel):
    strokeWidth: Optional[float] = 3
    stroke: Optional[str] = "#38bdf8"


class PlantEdge(BaseModel):
    id: str
    source: str
    target: str
    type: Optional[str] = "flowing"
    animated: Optional[bool] = True
    style: Optional[EdgeStyle] = None


# ─── Factory Config ─────────────────────────────────────────────

class Geometry(BaseModel):
    diameter: float
    height: float
    baffleCount: int


class Agitation(BaseModel):
    impellerType: str
    powerNumber: float


class NodeFactoryConfig(BaseModel):
    id: str
    geometry: Geometry
    agitation: Agitation


# ─── Inventory ──────────────────────────────────────────────────

class InventoryItem(BaseModel):
    id: str
    name: str
    category: Literal["raw", "wip", "finished"]
    unit: str
    currentStock: float
    maxCapacity: float
    reorderPoint: float
    costPerUnit: float


# ─── Recipe Configuration ────────────────────────────────────────

class RecipeConfig(BaseModel):
    dvbPercent: float = 7.0
    initiatorDosage: float = 0.8
    monomerWaterRatio: float = 0.33
    feedRateProfile: Literal["conservative", "balanced", "aggressive"] = "balanced"
    targetPsdMin: float = 0.3
    targetPsdMax: float = 1.2


# ─── Alert ──────────────────────────────────────────────────────

class Alert(BaseModel):
    id: str
    type: Literal["warning", "error", "info"]
    message: str
    timestamp: str
    nodeId: Optional[str] = None  # The ID of the specific asset causing the alert


# ─── Simulation History Point ───────────────────────────────────

class HistoryPoint(BaseModel):
    tick: int
    temp: float
    conversion: float
    stock: float
    powerKw: Optional[float] = 0.0         # Agitation power at this tick
    energyCost: Optional[float] = 0.0      # Cumulative energy cost at this tick (USD)


# ─── Full Plant State (matches simulationStore.ts) ──────────────

class BatchStage(str, Enum):
    setup = "setup"
    polymerization = "polymerization"
    functionalization = "functionalization"
    hydration = "hydration"
    complete = "complete"


class PlantState(BaseModel):
    """Complete in-memory plant state — the single source of truth."""
    factoryConfigs: list[NodeFactoryConfig]
    nodes: list[PlantNode]
    edges: list[PlantEdge]
    batchStage: BatchStage = BatchStage.setup
    globalAlerts: list[Alert] = []
    simulationHistory: list[HistoryPoint] = []
    inventory: list[InventoryItem]
    tick: int = 0
    batchStartTick: int = 0   # Monotonic tick value when the current batch cycle began
    isSimulating: bool = False
    # COGS & Sequence Optimization
    cumulativeEnergyCost: Optional[float] = 0.0
    bottleneckNodeIds: list[str] = []
    # Batch Scheduling
    batchSize: float = 2000.0
    interarrivalTicks: int = 60
    interarrivalCounter: int = 0
    recipe: RecipeConfig = Field(default_factory=RecipeConfig)

class PartialPlantState(BaseModel):
    """Used for syncing frontend state updates back to the backend."""
    nodes: Optional[list[PlantNode]] = None
    factoryConfigs: Optional[list[NodeFactoryConfig]] = None
    edges: Optional[list[PlantEdge]] = None
    batchSize: Optional[float] = None
    interarrivalTicks: Optional[int] = None
    recipe: Optional[RecipeConfig] = None


# ─── API Request/Response Models ────────────────────────────────

class SimulateTickResponse(BaseModel):
    tick: int
    batchStage: str
    nodes: list[PlantNode]
    edges: list[PlantEdge]
    inventory: list[InventoryItem]
    alerts: list[Alert]
    history: HistoryPoint
    recipe: RecipeConfig
    # Included so the UI and /advisor stay aligned with the same run metrics
    isSimulating: bool = True
    cumulativeEnergyCost: Optional[float] = 0.0
    bottleneckNodeIds: list[str] = []


class ChatRequest(BaseModel):
    message: str
    # Optional: latest UI snapshot (merged over server state for the LLM system prompt)
    clientContext: Optional[dict] = None


# ─── Phase 4: Run Records & Evidence ────────────────────────────

class RunStatus(str, Enum):
    active    = "active"
    completed = "completed"
    aborted   = "aborted"


class RunRecord(BaseModel):
    id: str
    label: str
    status: RunStatus = RunStatus.active
    createdAt: str
    endedAt: Optional[str] = None
    tickStart: int
    tickEnd: Optional[int] = None
    batchStageAtStart: str = "setup"
    batchStageAtEnd: Optional[str] = None
    recipeAtStart: RecipeConfig
    scenarioTag: Optional[str] = None


class RunKPIs(BaseModel):
    runId: str
    maxReactorTemp: float = 0.0
    maxPeakTemp: float = 0.0
    minPredictedWBC: Optional[float] = None
    avgConversion: float = 0.0
    finalConversion: float = 0.0
    totalEnergyCostDelta: float = 0.0
    errorAlertCount: int = 0
    warningAlertCount: int = 0
    qualityGradeFinal: str = "Pending"
    tickDuration: int = 0
    offSpecProxyScore: float = 0.0     # 0-1, lower is better
    avgPsdSpread: Optional[float] = None
    avgIonCapacity: Optional[float] = None


class RunComparisonDelta(BaseModel):
    maxReactorTemp: float = 0.0
    maxPeakTemp: float = 0.0
    minPredictedWBC: Optional[float] = None
    avgConversion: float = 0.0
    finalConversion: float = 0.0
    totalEnergyCostDelta: float = 0.0
    errorAlertCount: float = 0.0
    warningAlertCount: float = 0.0
    tickDuration: float = 0.0
    offSpecProxyScore: float = 0.0


class RunComparison(BaseModel):
    runA: RunRecord
    runB: RunRecord
    kpisA: RunKPIs
    kpisB: RunKPIs
    delta: RunComparisonDelta           # kpisB - kpisA (positive = B improved)
    narrative: str                      # short human-readable summary


class ChatResponse(BaseModel):
    reply: str


# ─── Phase 3: Structured Recommendations ───────────────────────

class RecommendationSeverity(str, Enum):
    safe = "safe"
    watch = "watch"
    risk = "risk"
    critical = "critical"


class StructuredRecommendation(BaseModel):
    id: str
    nodeId: Optional[str] = None
    nodeLabel: Optional[str] = None
    severity: RecommendationSeverity
    domain: str                     # e.g. "thermal", "psd", "hydration", "feed"
    condition: str                  # What the sensor / proxy shows right now
    rootCause: str                  # Why it is happening
    action: str                     # What to do (plain text + optional command)
    expectedImpact: str             # What improves and how much
    command: Optional[str] = None   # Agentic command e.g. "LOWER_RPM"
    commandValue: Optional[str] = None
    timestamp: str


class MitigationEvent(BaseModel):
    id: str
    tick: int
    timestamp: str
    nodeId: str
    nodeLabel: str
    action: str
    triggerCondition: str
    # Snapshot before
    beforeTemp: Optional[float] = None
    beforeRpm: Optional[float] = None
    beforePsdSpread: Optional[float] = None
    beforeWBC: Optional[float] = None
    beforeQuality: Optional[str] = None
    # Snapshot after (filled in on next relevant tick)
    afterTemp: Optional[float] = None
    afterRpm: Optional[float] = None
    afterPsdSpread: Optional[float] = None
    afterWBC: Optional[float] = None
    afterQuality: Optional[str] = None
    resolved: bool = False


# ─── Phase 5: Decision Intelligence & Explainability ─────────────

FeedRateProfile = Literal["conservative", "balanced", "aggressive"]


class OptimizationGoal(BaseModel):
    targetWBCMin: Optional[float] = None
    targetConversionMin: Optional[float] = None
    targetMaxTemp: Optional[float] = None
    targetMaxEnergyDelta: Optional[float] = None
    prioritize: Literal["quality", "energy", "throughput", "balanced"] = "balanced"


class OptimizationConstraint(BaseModel):
    dvbMin: float = 1.0
    dvbMax: float = 20.0
    initiatorMin: float = 0.1
    initiatorMax: float = 5.0
    monomerWaterMin: float = 0.1
    monomerWaterMax: float = 1.0
    allowedFeedProfiles: list[str] = ["conservative", "balanced", "aggressive"]


class ExplainabilityTrace(BaseModel):
    triggeredSignals: list[str]
    causeHypothesis: list[str]
    expectedImpact: list[str]
    tradeoffs: list[str]


class RecipeCandidate(BaseModel):
    rank: int
    recipe: RecipeConfig
    predictedKPIs: RunKPIs
    confidence: float          # 0.0 – 1.0
    score: float               # weighted objective score (higher = better)
    trace: ExplainabilityTrace


class OptimizationResponse(BaseModel):
    baselineRunId: Optional[str] = None
    goal: OptimizationGoal
    candidates: list[RecipeCandidate]
    summary: str


class RunRankItem(BaseModel):
    runId: str
    label: str
    score: float
    strengths: list[str]
    weaknesses: list[str]


class RunRankingResponse(BaseModel):
    ranking: list[RunRankItem]
    scoringWeights: dict[str, float]
