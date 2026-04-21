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

from schemas import (
    PlantState, PartialPlantState, PlantNode, PlantEdge, NodePosition, NodeData, EdgeStyle,
    NodeFactoryConfig, Geometry, Agitation,
    InventoryItem, Alert, HistoryPoint, BatchStage,
    SimulateTickResponse, ChatRequest, ChatResponse,
)
from simulation import simulate_tick
from ai_advisor import get_ai_response, get_mitigation_action

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
)

# Global mutable state
plant_state: PlantState = INITIAL_STATE.model_copy(deep=True)


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


@app.post("/simulate/mitigate")
async def apply_mitigation(body: dict):
    """
    Apply an AI-driven mitigation action. 
    Improved with case-insensitivity and synonym support.
    """
    raw_action = str(body.get("action", "")).upper()
    node_id = body.get("nodeId")

    # Mapping common AI synonyms to valid system actions
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
        "EMPTY_BUFFER": "DRAIN_BUFFER"
    }
    
    action = action_map.get(raw_action, raw_action)

    # Use the atomic command engine for consistency
    if action == "LOWER_RPM":
        reactor = next((n for n in plant_state.nodes if n.id == node_id and n.type == "reactor"), None)
        current_temp = reactor.data.temp if reactor and reactor.data.temp is not None else 25.0
        current_status = (reactor.data.status or "").lower() if reactor else ""
        # Escalate thermal mitigation to sustained cooling for overheated/tripped reactors.
        if reactor and (current_temp >= 85.0 or current_status == "tripped"):
            execute_agentic_command(f"START_COOLING_MODE:{node_id}")
        else:
            execute_agentic_command(f"SET_RPM:{node_id}:60")
    elif action == "START_COOLING":
        # Start sustained cooling with reduced reaction intensity and hysteresis exit.
        execute_agentic_command(f"START_COOLING_MODE:{node_id}")
    elif action == "REPLENISH":
        execute_agentic_command(f"REPLENISH:{node_id}")
    elif action == "DRAIN_BUFFER":
        execute_agentic_command(f"DRAIN_BUFFER:{node_id}")

    return {"status": "mitigated", "action": action, "nodeId": node_id}


@app.post("/simulate/tick")
def manual_tick():
    """Advance simulation by a single tick (manual step mode)."""
    global plant_state
    plant_state = simulate_tick(plant_state)
    return SimulateTickResponse(
        tick=plant_state.tick,
        batchStage=plant_state.batchStage.value,
        nodes=plant_state.nodes,
        edges=plant_state.edges,
        inventory=plant_state.inventory,
        alerts=plant_state.globalAlerts,
        history=plant_state.simulationHistory[-1] if plant_state.simulationHistory else HistoryPoint(tick=0, temp=25, conversion=0, stock=0),
    )


# ─── Inventory ──────────────────────────────────────────────────

@app.get("/inventory")
def get_inventory():
    """Return current inventory levels."""
    return [item.model_dump() for item in plant_state.inventory]


# ─── AI Advisor ─────────────────────────────────────────────────

@app.post("/advisor/chat", response_model=ChatResponse)
async def chat_with_advisor(req: ChatRequest):
    """
    Send a message to the AI plant advisor. 
    Parses and executes any agentic commands found in the reply.
    """
    reply = await get_ai_response(req.message, plant_state)
    
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
    alert_message = body.get("alertMessage", "")
    target_node_id = body.get("nodeId")
    result = await get_mitigation_action(alert_message, plant_state, target_node_id)
    return result


# ═══════════════════════════════════════════════════════════════════
# RUN
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
