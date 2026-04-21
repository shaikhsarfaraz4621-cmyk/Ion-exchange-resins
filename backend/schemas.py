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
    isSimulating: bool = False
    # COGS & Sequence Optimization
    cumulativeEnergyCost: Optional[float] = 0.0
    bottleneckNodeIds: list[str] = []
    # Batch Scheduling
    batchSize: float = 2000.0
    interarrivalTicks: int = 60
    interarrivalCounter: int = 0

class PartialPlantState(BaseModel):
    """Used for syncing frontend state updates back to the backend."""
    nodes: Optional[list[PlantNode]] = None
    factoryConfigs: Optional[list[NodeFactoryConfig]] = None
    edges: Optional[list[PlantEdge]] = None
    batchSize: Optional[float] = None
    interarrivalTicks: Optional[int] = None


# ─── API Request/Response Models ────────────────────────────────

class SimulateTickResponse(BaseModel):
    tick: int
    batchStage: str
    nodes: list[PlantNode]
    edges: list[PlantEdge]
    inventory: list[InventoryItem]
    alerts: list[Alert]
    history: HistoryPoint


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
