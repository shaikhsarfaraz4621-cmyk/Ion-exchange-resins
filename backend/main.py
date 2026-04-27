"""
Ion Exchange Resin Simulator — FastAPI Backend
===============================================
All state is held in-memory. No database.
The frontend syncs via REST endpoints.
"""
import asyncio
import re
import random
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import uuid
from schemas import (
    PlantState, PartialPlantState, PlantNode, PlantEdge, NodePosition, NodeData, EdgeStyle,
    NodeFactoryConfig, Geometry, Agitation,
    InventoryItem, Alert, HistoryPoint, BatchStage, RecipeConfig,
    SimulateTickResponse, ChatRequest, ChatResponse,
    StructuredRecommendation, MitigationEvent,
    RunRecord, RunKPIs, RunComparison, RunStatus,
    OptimizationGoal, OptimizationConstraint,
)
from simulation import simulate_tick
from ai_advisor import get_ai_response, get_mitigation_action, generate_structured_recommendations, snapshot_mitigation_before, resolve_mitigation_after
from run_metrics import compute_run_kpis, build_comparison
from decision_service import get_run_ranking, recommend_next_recipe, explain_run

load_dotenv()

# ═══════════════════════════════════════════════════════════════════
# IN-MEMORY STATE — mirrors the frontend simulationStore.ts exactly
# ═══════════════════════════════════════════════════════════════════

INITIAL_STATE = PlantState(
    factoryConfigs=[
        NodeFactoryConfig(
            id="CATION-001",
            geometry=Geometry(diameter=4.5, height=8.0, baffleCount=6), # Huge bulk reactor
            agitation=Agitation(impellerType="Turbine", powerNumber=7.2),
        ),
        NodeFactoryConfig(
            id="ANION-002",
            geometry=Geometry(diameter=2.0, height=4.0, baffleCount=4),  # Precision small reactor
            agitation=Agitation(impellerType="Paddle", powerNumber=3.8),
        ),
    ],
    nodes=[
        # Common Feed
        PlantNode(id="tank-styrene", type="storage", position=NodePosition(x=50, y=200),
                  data=NodeData(label="Styrene Monomer Feed", materialType="Styrene", capacity=20000, currentLevel=18500)),
        PlantNode(id="tank-dvb", type="storage", position=NodePosition(x=50, y=450),
                  data=NodeData(label="DVB Crosslinker Feed", materialType="DVB", capacity=5000, currentLevel=4400)),
        
        # LINE A: Bulk Cation Line
        PlantNode(id="reactor-A", type="reactor", position=NodePosition(x=400, y=50),
                  data=NodeData(label="Bulk Cation Synthesis A", capacity=25000, temp=25, conversion=0, status="idle", configId="CATION-001", reactorMode="cation", rpm=120)),
        PlantNode(id="washer-A", type="washer", position=NodePosition(x=750, y=50),
                  data=NodeData(label="High-Speed Centrifuge Wash A", status="idle", throughput=0)),
        PlantNode(id="buffer-A", type="buffer", position=NodePosition(x=1050, y=50),
                  data=NodeData(label="Surge Buffer A", capacity=8000, currentLevel=0, status="idle")),
        
        # LINE B: Precision Anion Line
        PlantNode(id="reactor-B", type="reactor", position=NodePosition(x=400, y=420),
                  data=NodeData(label="Precision Anion Synthesis B", capacity=8000, temp=25, conversion=0, status="idle", configId="ANION-002", reactorMode="anion", rpm=80)),
        PlantNode(id="washer-B", type="washer", position=NodePosition(x=750, y=420),
                  data=NodeData(label="Precision Wash B (Slow)", status="idle", throughput=0)),
        PlantNode(id="buffer-B", type="buffer", position=NodePosition(x=1050, y=420),
                  data=NodeData(label="Surge Buffer B", capacity=8000, currentLevel=0, status="idle")),

        # MERGE POINT: Shared Dryer
        PlantNode(id="dryer-shared", type="dryer", position=NodePosition(x=1350, y=230),
                  data=NodeData(label="Master Flash Dryer", status="idle", moisture=100, temp=25)),
        
        # Packager
        PlantNode(id="packager-final", type="packager", position=NodePosition(x=1680, y=230),
                  data=NodeData(label="Final Packaging & QC", status="idle", throughput=0)),
    ],
    edges=[
        # Feed to Line A
        PlantEdge(id="e-styrene-A", source="tank-styrene", target="reactor-A", type="flowing", style=EdgeStyle(strokeWidth=3, stroke="#38bdf8")),
        PlantEdge(id="e-dvb-A", source="tank-dvb", target="reactor-A", type="flowing", style=EdgeStyle(strokeWidth=3, stroke="#38bdf8")),
        # Feed to Line B
        PlantEdge(id="e-styrene-B", source="tank-styrene", target="reactor-B", type="flowing", style=EdgeStyle(strokeWidth=3, stroke="#a855f7")),
        PlantEdge(id="e-dvb-B", source="tank-dvb", target="reactor-B", type="flowing", style=EdgeStyle(strokeWidth=3, stroke="#a855f7")),
        # Line A — Reactor → Washer → Buffer A → Dryer
        PlantEdge(id="e-A-washer", source="reactor-A", target="washer-A", type="flowing", style=EdgeStyle(strokeWidth=3, stroke="#06b6d4")),
        PlantEdge(id="e-washer-A-buf", source="washer-A", target="buffer-A", type="flowing", style=EdgeStyle(strokeWidth=3, stroke="#0ea5e9")),
        PlantEdge(id="e-buf-A-dryer", source="buffer-A", target="dryer-shared", type="flowing", style=EdgeStyle(strokeWidth=3, stroke="#f97316")),
        # Line B — Reactor → Washer → Buffer B → Dryer
        PlantEdge(id="e-B-washer", source="reactor-B", target="washer-B", type="flowing", style=EdgeStyle(strokeWidth=3, stroke="#d946ef")),
        PlantEdge(id="e-washer-B-buf", source="washer-B", target="buffer-B", type="flowing", style=EdgeStyle(strokeWidth=3, stroke="#a855f7")),
        PlantEdge(id="e-buf-B-dryer", source="buffer-B", target="dryer-shared", type="flowing", style=EdgeStyle(strokeWidth=3, stroke="#f97316")),
        # Output
        PlantEdge(id="e-dryer-packager", source="dryer-shared", target="packager-final", type="flowing", style=EdgeStyle(strokeWidth=3, stroke="#10b981")),
    ],
    inventory=[
        InventoryItem(id="styrene", name="Styrene Monomer", category="raw", unit="L",
                      currentStock=18500, maxCapacity=20000, reorderPoint=2000, costPerUnit=1.20),
        InventoryItem(id="dvb", name="DVB Crosslinker", category="raw", unit="L",
                      currentStock=4400, maxCapacity=5000, reorderPoint=500, costPerUnit=4.80),
        InventoryItem(id="h2so4", name="Sulfuric Acid (H₂SO₄)", category="raw", unit="L",
                      currentStock=1800, maxCapacity=3000, reorderPoint=400, costPerUnit=0.85),
        InventoryItem(id="naoh", name="Caustic Soda (NaOH)", category="raw", unit="kg",
                      currentStock=950, maxCapacity=2000, reorderPoint=300, costPerUnit=0.55),
        InventoryItem(id="copolymer-wip", name="Copolymer Beads (Unwashed)", category="wip", unit="kg",
                      currentStock=0, maxCapacity=10000, reorderPoint=0, costPerUnit=0),
        InventoryItem(id="washed-beads", name="Washed Beads (Clean)", category="wip", unit="kg",
                      currentStock=0, maxCapacity=8000, reorderPoint=0, costPerUnit=0),
        InventoryItem(id="cation-resin", name="Cation Resin (Finished)", category="finished", unit="kg",
                      currentStock=0, maxCapacity=5000, reorderPoint=0, costPerUnit=12.50),
        InventoryItem(id="anion-resin", name="Anion Resin (Finished)", category="finished", unit="kg",
                      currentStock=0, maxCapacity=5000, reorderPoint=0, costPerUnit=18.20),
    ],
    recipe=RecipeConfig(
        dvbPercent=7.0,
        initiatorDosage=0.8,
        monomerWaterRatio=0.33,
        feedRateProfile="balanced",
        targetPsdMin=0.3,
        targetPsdMax=1.2,
    ),
)

# Global mutable state
plant_state: PlantState = INITIAL_STATE.model_copy(deep=True)

# Phase 3 — in-memory recommendation + mitigation log
_recommendations: list[StructuredRecommendation] = []
_mitigation_log: list[MitigationEvent] = []
_MITIGATION_RESOLVE_TICKS = 15   # ticks to wait before resolving a pending event

# Phase 4 — in-memory run store
_runs: dict[str, RunRecord] = {}
_run_kpis: dict[str, RunKPIs] = {}
_active_run_id: str | None = None
_run_energy_start: float = 0.0            # energy level when run was started
_run_alert_errors: dict[str, int] = {}    # runId -> error alert count
_run_alert_warnings: dict[str, int] = {}  # runId -> warning alert count
_run_history_start_idx: dict[str, int] = {}  # runId -> history index at start


# ═══════════════════════════════════════════════════════════════════
# BACKGROUND SIMULATION LOOP
# ═══════════════════════════════════════════════════════════════════

# Redundant background loop removed to allow frontend polling (slider) to control speed.


# ═══════════════════════════════════════════════════════════════════
# APP SETUP
# ═══════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/Shutdown lifecycle."""
    print("[OK] Ion Exchange Resin Simulator Backend - Online")
    yield
    print("[STOP] Backend shutting down.")


app = FastAPI(
    title="Ion Exchange Resin Simulator API",
    description="Backend API for the BlueStream Ion Exchange Resin Plant Simulator",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server and production origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.get("/")
def health():
    return {"status": "online", "service": "Ion Exchange Simulator API", "tick": plant_state.tick}

@app.get("/ping")
def ping():
    """Minimal keep-alive endpoint for uptime probes."""
    return {"status": "ok"}

@app.head("/ping")
def ping_head():
    """HEAD keep-alive endpoint for uptime probes that require HEAD."""
    return


def _generate_alert_id() -> str:
    return ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=9))


def _get_timestamp() -> str:
    return datetime.now().strftime("%I:%M:%S %p")

def _inventory_id_for_material(material_type: str | None) -> str | None:
    mt = (material_type or "").strip().lower()
    if mt == "styrene":
        return "styrene"
    if mt == "dvb":
        return "dvb"
    return None


# ─── State Management ───────────────────────────────────────────

@app.get("/state")
def get_state():
    """Return the full plant state for frontend hydration."""
    return plant_state.model_dump()


@app.post("/state/update")
def update_state(update: PartialPlantState):
    """Sync frontend local updates to the backend master state."""
    global plant_state
    
    # Merge Nodes
    if update.nodes is not None:
        # Create a lookup mapping internally to correctly map the updated frontend nodes
        node_map = {n.id: n for n in plant_state.nodes}
        for unode in update.nodes:
            if unode.id in node_map:
                # Merge the deeply nested 'data' field manually since pydantic does full replacement
                current_data = node_map[unode.id].data.model_dump()
                current_data.update(unode.data.model_dump(exclude_unset=True))
                
                new_node = unode.model_copy(update={"data": NodeData(**current_data)})
                node_map[unode.id] = new_node
        plant_state.nodes = list(node_map.values())

    # Merge Configs
    if update.factoryConfigs is not None:
        config_map = {c.id: c for c in plant_state.factoryConfigs}
        for uconfig in update.factoryConfigs:
             config_map[uconfig.id] = uconfig # Direct overwrite is fine here
        plant_state.factoryConfigs = list(config_map.values())
        
    # Merge Edges
    if update.edges is not None:
         plant_state.edges = update.edges

    # Merge Batch Scheduling Settings
    if update.batchSize is not None:
        plant_state.batchSize = update.batchSize
    if update.interarrivalTicks is not None:
        plant_state.interarrivalTicks = update.interarrivalTicks

    # Merge Recipe Settings
    if update.recipe is not None:
        plant_state.recipe = update.recipe

    return {"status": "synced", "tick": plant_state.tick}

@app.post("/state/reset")
def reset_state():
    """Reset the plant to its initial state."""
    global plant_state
    plant_state = INITIAL_STATE.model_copy(deep=True)
    return {"status": "reset", "tick": 0}


# ─── Agentic Command Processing ──────────────────────────────────

def execute_agentic_command(command_str: str):
    """
    Parses a single command tag like [[SET_RPM:nodeId:value]]
    and modifies the global plant_state accordingly.
    """
    global plant_state
    try:
        parts = command_str.split(":")
        cmd = parts[0].upper()
        node_id = parts[1]
        
        # 1. SET_RPM
        if cmd == "SET_RPM":
            value = float(parts[2])
            for node in plant_state.nodes:
                if node.id == node_id:
                    node.data.rpm = value
                    node.data.status = "running"
                    node.data.mitigationGraceTicks = 5
                    # Apply 15C cooling delta for immediate feedback
                    node.data.temp = max(30, (node.data.temp or 25) - 15)
                    plant_state.globalAlerts = [a for a in plant_state.globalAlerts if a.nodeId != node_id]

        # 2. REPLENISH
        elif cmd == "REPLENISH":
            for node in plant_state.nodes:
                if node.id == node_id:
                    cap = node.data.capacity or 20000
                    node.data.currentLevel = cap * 0.85
                    inv_id = _inventory_id_for_material(node.data.materialType)
                    if inv_id:
                        item = next((i for i in plant_state.inventory if i.id == inv_id), None)
                        if item:
                            item.currentStock = min(item.maxCapacity, node.data.currentLevel)
                    node.data.mitigationGraceTicks = 5
                    plant_state.globalAlerts = [a for a in plant_state.globalAlerts if a.nodeId != node_id]

        # 3. RESET_STATUS
        elif cmd == "RESET_STATUS":
            for node in plant_state.nodes:
                if node.id == node_id:
                    node.data.status = "running"
                    node.data.temp = max(30, (node.data.temp or 25) - 20)
                    node.data.mitigationGraceTicks = 5
                    plant_state.globalAlerts = [a for a in plant_state.globalAlerts if a.nodeId != node_id]

        # 4. SET_TEMP
        elif cmd == "SET_TEMP":
            value = float(parts[2])
            for node in plant_state.nodes:
                if node.id == node_id:
                    node.data.temp = value
                    node.data.status = "running"
                    node.data.mitigationGraceTicks = 5
                    plant_state.globalAlerts = [a for a in plant_state.globalAlerts if a.nodeId != node_id]

        # 5. START_COOLING_MODE (sustained thermal recovery)
        elif cmd == "START_COOLING_MODE":
            for node in plant_state.nodes:
                if node.id == node_id:
                    base_rpm = node.data.rpm or 120
                    node.data.rpm = max(35, int(base_rpm * 0.4))
                    node.data.status = "running"
                    node.data.coolingMode = True
                    node.data.coolingTicksRemaining = 12
                    node.data.mitigationGraceTicks = 12
                    node.data.temp = max(28, (node.data.temp or 25) - 18)
                    plant_state.globalAlerts = [a for a in plant_state.globalAlerts if a.nodeId != node_id]

        # 5. DRAIN_BUFFER
        elif cmd == "DRAIN_BUFFER":
            for node in plant_state.nodes:
                if node.id == node_id:
                    cap = node.data.capacity or 8000
                    node.data.currentLevel = cap * 0.4
                    node.data.status = "running"
                    node.data.mitigationGraceTicks = 8 # Longer grace for buffers
                    plant_state.globalAlerts = [a for a in plant_state.globalAlerts if a.nodeId != node_id]

        # 5. SET_THROUGHPUT
        elif cmd == "SET_THROUGHPUT":
            value = float(parts[2])
            for node in plant_state.nodes:
                if node.id == node_id:
                    node.data.throughput = value
                    node.data.status = "running"
                    node.data.mitigationGraceTicks = 10
                    plant_state.globalAlerts = [a for a in plant_state.globalAlerts if a.nodeId != node_id]

    except Exception as e:
        print(f"Error executing agentic command {command_str}: {e}")


# ─── Simulation Controls ──────────────────────────────────────────

@app.post("/simulate/start")
async def start_simulation():
    """Enable simulation flag. The frontend will drive the ticks via polling."""
    global plant_state
    plant_state.isSimulating = True
    return {"status": "started", "tick": plant_state.tick}


@app.post("/simulate/stop")
async def stop_simulation():
    """Disable simulation flag."""
    global plant_state
    plant_state.isSimulating = False
    return {"status": "stopped", "tick": plant_state.tick}


@app.post("/simulate/demo-scenario")
async def apply_demo_scenario(body: dict):
    """
    Inject a demo fault/condition so operators can showcase detection and mitigation.
    Supported values for `scenario`:
      - reactor_overheat
      - feed_starvation
      - buffer_overflow
    """
    global plant_state
    scenario = str(body.get("scenario", "")).strip().lower()

    if scenario == "reactor_overheat":
        reactor = next((n for n in plant_state.nodes if n.type == "reactor"), None)
        if not reactor:
            return {"status": "skipped", "reason": "No reactor found"}
        reactor.data.temp = max(reactor.data.temp or 25.0, 108.0)
        reactor.data.conversion = max(reactor.data.conversion or 0.0, 58.0)
        reactor.data.status = "running"
        plant_state.globalAlerts.insert(0, Alert(
            id=_generate_alert_id(),
            type="error",
            message=f"DEMO FAULT: {reactor.data.label} entered exothermic runaway window",
            timestamp=_get_timestamp(),
            nodeId=reactor.id
        ))
        plant_state.globalAlerts = plant_state.globalAlerts[:10]
        return {"status": "applied", "scenario": scenario, "summary": f"Injected high thermal load on {reactor.id}"}

    if scenario == "feed_starvation":
        tank = next((n for n in plant_state.nodes if n.type == "storage" and (n.data.materialType or "").lower() == "dvb"), None)
        if not tank:
            return {"status": "skipped", "reason": "No DVB tank found"}
        tank.data.currentLevel = 0.0
        dvb_item = next((i for i in plant_state.inventory if i.id == "dvb"), None)
        if dvb_item:
            dvb_item.currentStock = 0.0
        plant_state.globalAlerts.insert(0, Alert(
            id=_generate_alert_id(),
            type="error",
            message=f"DEMO FAULT: {tank.data.label} depleted to zero",
            timestamp=_get_timestamp(),
            nodeId=tank.id
        ))
        plant_state.globalAlerts = plant_state.globalAlerts[:10]
        return {"status": "applied", "scenario": scenario, "summary": f"Forced stockout on {tank.id}"}

    if scenario == "buffer_overflow":
        buffer_node = next((n for n in plant_state.nodes if n.type == "buffer"), None)
        if not buffer_node:
            return {"status": "skipped", "reason": "No surge buffer found"}
        cap = buffer_node.data.capacity or 8000.0
        buffer_node.data.currentLevel = cap * 0.97
        buffer_node.data.status = "running"
        plant_state.globalAlerts.insert(0, Alert(
            id=_generate_alert_id(),
            type="error",
            message=f"DEMO FAULT: {buffer_node.data.label} pushed into overflow interlock region",
            timestamp=_get_timestamp(),
            nodeId=buffer_node.id
        ))
        plant_state.globalAlerts = plant_state.globalAlerts[:10]
        return {"status": "applied", "scenario": scenario, "summary": f"Forced high level on {buffer_node.id}"}

    return {"status": "ignored", "reason": "Unknown scenario", "scenario": scenario}


def _apply_mitigation_action(body: dict) -> str:
    """
    Core mitigation logic shared by /simulate/mitigate and /mitigation-log/apply.
    Returns the normalized action string.
    """
    global plant_state
    raw_action = str(body.get("action", "")).upper()
    node_id = body.get("nodeId")

    action_map = {
        "LOWER_RPM": "LOWER_RPM",
        "RPM_REDUCTION": "LOWER_RPM",
        "REDUCE_RPM": "LOWER_RPM",
        "SLOWER": "LOWER_RPM",
        "START_COOLING": "START_COOLING",
        "COOLING": "START_COOLING",
        "REDUCE_TEMP": "START_COOLING",
        "EMERGENCY_COOLING": "START_COOLING",
        "REPLENISH": "REPLENISH",
        "FILL_TANK": "REPLENISH",
        "RESTORE_INVENTORY": "REPLENISH",
        "DRAIN_BUFFER": "DRAIN_BUFFER",
        "REDUCE_BUFFER": "DRAIN_BUFFER",
        "EMPTY_BUFFER": "DRAIN_BUFFER",
    }

    action = action_map.get(raw_action, raw_action)

    if action == "LOWER_RPM" and node_id:
        reactor = next((n for n in plant_state.nodes if n.id == node_id and n.type == "reactor"), None)
        current_temp = reactor.data.temp if reactor and reactor.data.temp is not None else 25.0
        current_status = (reactor.data.status or "").lower() if reactor else ""
        if reactor and (current_temp >= 85.0 or current_status == "tripped"):
            execute_agentic_command(f"START_COOLING_MODE:{node_id}")
        else:
            execute_agentic_command(f"SET_RPM:{node_id}:60")
    elif action == "START_COOLING" and node_id:
        execute_agentic_command(f"START_COOLING_MODE:{node_id}")
    elif action == "REPLENISH" and node_id:
        execute_agentic_command(f"REPLENISH:{node_id}")
    elif action == "DRAIN_BUFFER" and node_id:
        execute_agentic_command(f"DRAIN_BUFFER:{node_id}")

    return action


@app.post("/simulate/mitigate")
async def apply_mitigation(body: dict):
    """
    Apply an AI-driven mitigation action.
    Improved with case-insensitivity and synonym support.
    """
    action = _apply_mitigation_action(body)
    node_id = body.get("nodeId")
    return {"status": "mitigated", "action": action, "nodeId": node_id}


@app.post("/simulate/tick")
def manual_tick():
    """Advance simulation by a single tick (manual step mode)."""
    global plant_state, _recommendations, _mitigation_log
    plant_state = simulate_tick(plant_state)

    # Refresh structured recommendations every tick
    _recommendations = generate_structured_recommendations(plant_state)

    # Phase 4 — count alerts for the active run
    if _active_run_id and _active_run_id in _runs:
        for alert in plant_state.globalAlerts:
            if alert.type == "error":
                _run_alert_errors[_active_run_id] = _run_alert_errors.get(_active_run_id, 0) + 1
            elif alert.type == "warning":
                _run_alert_warnings[_active_run_id] = _run_alert_warnings.get(_active_run_id, 0) + 1

    # Resolve any pending mitigation events that have aged out
    resolved_new = []
    for evt in _mitigation_log:
        if not evt.resolved and (plant_state.tick - evt.tick) >= _MITIGATION_RESOLVE_TICKS:
            resolved_new.append(resolve_mitigation_after(evt, plant_state))
        else:
            resolved_new.append(evt)
    _mitigation_log = resolved_new

    return SimulateTickResponse(
        tick=plant_state.tick,
        batchStage=plant_state.batchStage.value,
        nodes=plant_state.nodes,
        edges=plant_state.edges,
        inventory=plant_state.inventory,
        alerts=plant_state.globalAlerts,
        history=plant_state.simulationHistory[-1] if plant_state.simulationHistory else HistoryPoint(tick=0, temp=25, conversion=0, stock=0),
        recipe=plant_state.recipe,
        isSimulating=bool(plant_state.isSimulating),
        cumulativeEnergyCost=plant_state.cumulativeEnergyCost or 0.0,
        bottleneckNodeIds=list(plant_state.bottleneckNodeIds or []),
    )


# ─── Inventory ──────────────────────────────────────────────────

@app.get("/inventory")
def get_inventory():
    """Return current inventory levels."""
    return [item.model_dump() for item in plant_state.inventory]


# ─── AI Advisor ─────────────────────────────────────────────────

def _state_for_advisor_chat(req: ChatRequest) -> PlantState:
    """
    LLM system prompt is built from PlantState. By default that is the server copy.
    If the UI sends clientContext, we merge it so temperatures/conversion/tick match
    what the operator sees (eliminates one-tick / polling drift).
    """
    global plant_state
    if not req.clientContext:
        return plant_state
    try:
        base = plant_state.model_dump(mode="json")
        ctx = req.clientContext
        if "tick" in ctx and ctx["tick"] is not None:
            base["tick"] = int(ctx["tick"])
        if "batchStage" in ctx and ctx["batchStage"] is not None:
            base["batchStage"] = ctx["batchStage"]
        if "recipe" in ctx and ctx["recipe"] is not None:
            base["recipe"] = ctx["recipe"]
        if "inventory" in ctx and ctx["inventory"] is not None:
            base["inventory"] = ctx["inventory"]
        if "globalAlerts" in ctx and ctx["globalAlerts"] is not None:
            base["globalAlerts"] = ctx["globalAlerts"]
        if "nodes" in ctx and ctx["nodes"] is not None:
            base["nodes"] = ctx["nodes"]
        if "edges" in ctx and ctx["edges"] is not None:
            base["edges"] = ctx["edges"]
        if "isSimulating" in ctx and ctx["isSimulating"] is not None:
            base["isSimulating"] = bool(ctx["isSimulating"])
        if "cumulativeEnergyCost" in ctx and ctx["cumulativeEnergyCost"] is not None:
            base["cumulativeEnergyCost"] = float(ctx["cumulativeEnergyCost"])
        if "bottleneckNodeIds" in ctx and ctx["bottleneckNodeIds"] is not None:
            base["bottleneckNodeIds"] = list(ctx["bottleneckNodeIds"])
        if "simulationHistory" in ctx and ctx["simulationHistory"] is not None:
            base["simulationHistory"] = ctx["simulationHistory"]
        return PlantState.model_validate(base)
    except Exception as e:
        print(f"[advisor] clientContext merge failed ({e!r}) — using server plant_state only")
        return plant_state


@app.post("/advisor/chat", response_model=ChatResponse)
async def chat_with_advisor(req: ChatRequest):
    """
    Send a message to the AI plant advisor. 
    Parses and executes any agentic commands found in the reply.
    """
    state = _state_for_advisor_chat(req)
    reply = await get_ai_response(req.message, state)
    
    # Extract and execute tags: [[CMD:ID:VAL]]
    commands = re.findall(r"\[\[(.*?)\]\]", reply)
    for cmd in commands:
        execute_agentic_command(cmd)
        
    return ChatResponse(reply=reply)


@app.post("/advisor/mitigate")
async def get_ai_mitigation(body: dict):
    """
    Agentic Mitigation. The frontend sends the alert message and target nodeId,
    the AI analyzes plant state, and returns a structured fix.
    """
    global _mitigation_log
    alert_message = body.get("alertMessage", "")
    target_node_id = body.get("nodeId")
    result = await get_mitigation_action(alert_message, plant_state, target_node_id)

    # Record a before-snapshot mitigation event
    if target_node_id:
        evt = snapshot_mitigation_before(
            node_id=target_node_id,
            state=plant_state,
            action=result.get("action", "UNKNOWN"),
            trigger=alert_message,
        )
        _mitigation_log = [evt] + _mitigation_log[:49]   # keep latest 50

    return result


# ─── Phase 3: Structured Recommendations ────────────────────────

@app.get("/recommendations")
def get_recommendations():
    """Return latest structured recommendation cards for all plant nodes."""
    global _recommendations
    # Always regenerate to capture freshest state (instant call from UI)
    _recommendations = generate_structured_recommendations(plant_state)
    return [r.model_dump() for r in _recommendations]


@app.get("/mitigation-log")
def get_mitigation_log():
    """Return the history of applied mitigations with before/after snapshots."""
    return [e.model_dump() for e in _mitigation_log]


@app.post("/mitigation-log/apply")
def apply_mitigation_from_recommendation(body: dict):
    """
    Execute a recommendation's command and record the before-snapshot.
    Body: { "command": "LOWER_RPM", "nodeId": "reactor-A", "condition": "..." }
    """
    global _mitigation_log
    command   = body.get("command", "")
    node_id   = body.get("nodeId", "")
    condition = body.get("condition", "Applied via recommendation card")

    if command and node_id:
        evt = snapshot_mitigation_before(
            node_id=node_id,
            state=plant_state,
            action=command,
            trigger=condition,
        )
        _mitigation_log = [evt] + _mitigation_log[:49]
        _apply_mitigation_action({"action": command, "nodeId": node_id})

    return {"status": "applied", "nodeId": node_id, "command": command}


# ─── Phase 4: Run Records ────────────────────────────────────────

@app.post("/runs/start")
def start_run(body: dict):
    """
    Create a new RunRecord and mark it active.
    Body: { "label": "My Run", "scenarioTag": "baseline" }
    """
    global _active_run_id, _run_energy_start, plant_state

    if _active_run_id and _active_run_id in _runs and _runs[_active_run_id].status == RunStatus.active:
        return {"status": "error", "reason": "Another run is already active. End or abort it first.", "activeRunId": _active_run_id}

    run_id = str(uuid.uuid4())[:8]
    label = str(body.get("label", f"Run {len(_runs)+1}")).strip() or f"Run {len(_runs)+1}"
    scenario_tag = body.get("scenarioTag") or None

    run = RunRecord(
        id=run_id,
        label=label,
        status=RunStatus.active,
        createdAt=datetime.now().isoformat(),
        tickStart=plant_state.tick,
        batchStageAtStart=plant_state.batchStage.value,
        recipeAtStart=plant_state.recipe.model_copy(deep=True),
        scenarioTag=scenario_tag,
    )
    _runs[run_id] = run
    _active_run_id = run_id
    _run_energy_start = plant_state.cumulativeEnergyCost or 0.0
    _run_alert_errors[run_id] = 0
    _run_alert_warnings[run_id] = 0
    _run_history_start_idx[run_id] = max(0, len(plant_state.simulationHistory) - 1)

    return {"status": "started", "runId": run_id, "label": label, "tickStart": run.tickStart}


@app.post("/runs/{run_id}/end")
def end_run(run_id: str):
    """Finalise an active run and compute its KPIs."""
    global _active_run_id, plant_state

    run = _runs.get(run_id)
    if not run:
        return {"status": "error", "reason": "Run not found"}
    if run.status != RunStatus.active:
        return {"status": "error", "reason": "Run is not active"}

    run.status = RunStatus.completed
    run.endedAt = datetime.now().isoformat()
    run.tickEnd = plant_state.tick
    run.batchStageAtEnd = plant_state.batchStage.value
    if _active_run_id == run_id:
        _active_run_id = None

    # Collect history slice
    hist_start = _run_history_start_idx.get(run_id, 0)
    history_slice = list(plant_state.simulationHistory[hist_start:])

    kpis = compute_run_kpis(
        run=run,
        state_at_end=plant_state,
        history_slice=history_slice,
        energy_start=_run_energy_start,
        alert_errors=_run_alert_errors.get(run_id, 0),
        alert_warnings=_run_alert_warnings.get(run_id, 0),
    )
    _run_kpis[run_id] = kpis

    return {"status": "completed", "runId": run_id, "kpis": kpis.model_dump()}


@app.post("/runs/{run_id}/abort")
def abort_run(run_id: str):
    """Mark a run as aborted and compute partial KPIs up to abort tick."""
    global _active_run_id, plant_state

    run = _runs.get(run_id)
    if not run:
        return {"status": "error", "reason": "Run not found"}
    run.status = RunStatus.aborted
    run.endedAt = datetime.now().isoformat()
    run.tickEnd = plant_state.tick
    if _active_run_id == run_id:
        _active_run_id = None

    # Phase 4 enhancement — compute partial KPIs for aborted runs too.
    hist_start = _run_history_start_idx.get(run_id, 0)
    history_slice = list(plant_state.simulationHistory[hist_start:])

    kpis = compute_run_kpis(
        run=run,
        state_at_end=plant_state,
        history_slice=history_slice,
        energy_start=_run_energy_start,
        alert_errors=_run_alert_errors.get(run_id, 0),
        alert_warnings=_run_alert_warnings.get(run_id, 0),
    )
    _run_kpis[run_id] = kpis

    return {"status": "aborted", "runId": run_id, "kpis": kpis.model_dump()}


@app.get("/runs")
def list_runs():
    """Return all run records in reverse chronological order."""
    result = []
    for run in reversed(list(_runs.values())):
        kpis = _run_kpis.get(run.id)
        result.append({
            "run": run.model_dump(),
            "kpis": kpis.model_dump() if kpis else None,
        })
    return result


@app.get("/runs/active")
def get_active_run():
    """Return the currently active run (if any)."""
    if _active_run_id and _active_run_id in _runs:
        run = _runs[_active_run_id]
        return {"active": True, "runId": _active_run_id, "run": run.model_dump()}
    return {"active": False, "runId": None}


@app.get("/runs/{run_id}")
def get_run(run_id: str):
    """Get a specific run record with its KPIs."""
    run = _runs.get(run_id)
    if not run:
        return {"status": "error", "reason": "Run not found"}
    kpis = _run_kpis.get(run_id)
    return {"run": run.model_dump(), "kpis": kpis.model_dump() if kpis else None}


@app.post("/runs/compare")
def compare_runs(body: dict):
    """
    Compare two completed runs.
    Body: { "runIdA": "...", "runIdB": "..." }
    Returns RunComparison with delta and narrative.
    """
    id_a = body.get("runIdA", "")
    id_b = body.get("runIdB", "")

    run_a = _runs.get(id_a)
    run_b = _runs.get(id_b)
    kpis_a = _run_kpis.get(id_a)
    kpis_b = _run_kpis.get(id_b)

    if not run_a or not run_b:
        return {"status": "error", "reason": "One or both run IDs not found"}
    if not kpis_a or not kpis_b:
        return {"status": "error", "reason": "KPIs not available for both runs — ensure both are completed"}

    comparison = build_comparison(run_a, run_b, kpis_a, kpis_b)
    return comparison.model_dump()


@app.post("/run-actions/bulk-delete")
def delete_runs(body: dict):
    """
    Delete multiple runs by IDs.
    Body: { "runIds": ["id1", "id2"] }
    Active run cannot be deleted until ended/aborted.
    """
    global _runs, _run_kpis, _run_alert_errors, _run_alert_warnings, _run_history_start_idx
    run_ids = body.get("runIds", [])
    if not isinstance(run_ids, list):
        return {"status": "error", "reason": "runIds must be a list"}

    deleted: list[str] = []
    skipped: list[dict] = []

    for run_id in run_ids:
        rid = str(run_id)
        run = _runs.get(rid)
        if not run:
            skipped.append({"runId": rid, "reason": "not_found"})
            continue
        if _active_run_id == rid or run.status == RunStatus.active:
            skipped.append({"runId": rid, "reason": "active_run"})
            continue

        _runs.pop(rid, None)
        _run_kpis.pop(rid, None)
        _run_alert_errors.pop(rid, None)
        _run_alert_warnings.pop(rid, None)
        _run_history_start_idx.pop(rid, None)
        deleted.append(rid)

    return {"status": "ok", "deleted": deleted, "skipped": skipped}


@app.get("/runs/{run_id}/export")
def export_run(run_id: str):
    """Export a run record + KPIs as a JSON payload for download."""
    run = _runs.get(run_id)
    if not run:
        return {"status": "error", "reason": "Run not found"}
    kpis = _run_kpis.get(run_id)
    return {
        "exportedAt": datetime.now().isoformat(),
        "run": run.model_dump(),
        "kpis": kpis.model_dump() if kpis else None,
    }


@app.get("/debug/version")
def debug_version():
    return {"version": "phase5-decision-intelligence-v1"}


# ═══════════════════════════════════════════════════════════════════
# PHASE 5 — DECISION INTELLIGENCE & EXPLAINABILITY
# ═══════════════════════════════════════════════════════════════════

@app.get("/decisions/run-ranking")
def decisions_run_ranking():
    """
    Rank all completed / aborted runs by weighted KPI score.
    Optional query param: weights as JSON in body (not yet exposed on frontend).
    """
    all_runs = list(_runs.values())
    response = get_run_ranking(all_runs, _run_kpis)
    return response.model_dump()


@app.post("/decisions/optimize")
def decisions_optimize(body: dict):
    """
    Generate top-N recommended recipe candidates for a given goal + constraints.
    Body:
      {
        "goal": { "targetWBCMin": 90, "prioritize": "balanced", ... },
        "constraints": { "dvbMin": 5, "dvbMax": 12, ... },
        "topN": 3
      }
    """
    try:
        goal_data = body.get("goal", {})
        constraint_data = body.get("constraints", {})
        top_n = int(body.get("topN", 3))

        goal = OptimizationGoal(**goal_data)
        constraints = OptimizationConstraint(**constraint_data)
    except Exception as e:
        return {"status": "error", "reason": str(e)}

    all_runs = list(_runs.values())
    response = recommend_next_recipe(all_runs, _run_kpis, goal, constraints, top_n=top_n)
    return response.model_dump()


@app.get("/decisions/recommend-next")
def decisions_recommend_next():
    """
    Return a single best next recipe using default balanced goal and default constraints.
    No body required — uses current run evidence directly.
    """
    goal = OptimizationGoal(prioritize="balanced")
    constraints = OptimizationConstraint()
    all_runs = list(_runs.values())
    response = recommend_next_recipe(all_runs, _run_kpis, goal, constraints, top_n=3)
    return response.model_dump()


@app.post("/decisions/explain")
def decisions_explain(body: dict):
    """
    Return a single best candidate + explainability trace for a specific run.
    Body: { "runId": "...", "goal": {...}, "constraints": {...} }
    """
    run_id = body.get("runId", "")
    if not run_id:
        return {"status": "error", "reason": "runId is required"}

    try:
        goal = OptimizationGoal(**(body.get("goal") or {}))
        constraints = OptimizationConstraint(**(body.get("constraints") or {}))
    except Exception as e:
        return {"status": "error", "reason": str(e)}

    all_runs = list(_runs.values())
    candidate = explain_run(run_id, all_runs, _run_kpis, goal, constraints)
    if candidate is None:
        return {"status": "error", "reason": "Run not found or no candidate generated"}
    return {"status": "ok", "candidate": candidate.model_dump()}


# ═══════════════════════════════════════════════════════════════════
# RUN
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
