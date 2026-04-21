"""
Simulation Engine — High-Fidelity Physics & Sequence Optimization.

Physics models implemented:
  1. Reactor kinetics: Sigmoidal S-curve conversion
  2. Thermodynamics: Exothermic heat balance with jacket cooling  
  3. Agitation Power: P = Np * rho * N^3 * D^5
  4. Drying kinetics: Exponential moisture decay

Sequence optimization:
  - Per-node idle time (waitTime) tracking
  - Bottleneck identification: node with highest idle/wait time
  - QC grade tracking: AAA / AA / B / Fail
  - Energy cost accumulation (COGS)
"""
import math
import random
from schemas import (
    PlantState, PlantNode, Alert, HistoryPoint, BatchStage
)


# ─── Physical Constants ─────────────────────────────────────────
FLUID_DENSITY_KG_M3 = 1050.0       # Styrene-DVB monomer mix (~1050 kg/m³)
ELECTRICITY_PRICE_PER_KWH = 0.12   # USD per kWh
REACTION_HEAT_SCALE = 1.5          # Smoothed heat rise for stable demonstration
JACKET_TEMP = 30.0                 # Cooling jacket setpoint (°C)
JACKET_COOLING_RATE = 0.15         # Aggressive cooling for stability
EXOTHERMIC_TRIP_TEMP = 110.0       # Hard trip at 110°C
HIGH_TEMP_ALERT_THRESHOLD = 80.0   # Soft alert at 80°C
COOLING_EXIT_TEMP = 65.0

# Dryer constants
DRYER_DECAY_K = 0.06               # Exponential decay rate for moisture
DRYER_TEMP_MAX = 120.0

# Sigmoidal kinetics constants
SIG_K_BASE = 0.12                  # Base sigmoid steepness
SIG_T0 = 30                        # Slightly delayed inflection for "Normal" period


# ─── Helpers ────────────────────────────────────────────────────

def _generate_alert_id() -> str:
    return ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=9))


def _get_timestamp() -> str:
    from datetime import datetime
    return datetime.now().strftime("%I:%M:%S %p")


def _find_node(nodes: list[PlantNode], node_id: str) -> PlantNode | None:
    for n in nodes:
        if n.id == node_id:
            return n
    return None


def _calc_agitation_power_kw(power_number: float, diameter_m: float, rpm: float) -> float:
    """
    Power number formula: P = Np * rho * N^3 * D^5
    N = rotational speed in rev/second (rpm / 60)
    Returns power in kW.
    """
    N = rpm / 60.0  # rev/s
    P_watts = power_number * FLUID_DENSITY_KG_M3 * (N ** 3) * (diameter_m ** 5)
    return P_watts / 1000.0  # convert to kW


def _sigmoidal_conversion(current_conversion: float, tick: int, power_factor: float) -> float:
    """
    S-curve model: C(t) = 100 / (1 + e^(-k*(t - t0)))
    Returns the RATE of conversion per tick (delta C), not the absolute.
    We infer an effective tick that matches the current conversion level,
    then step forward by 1 tick with scaled k.
    """
    k = SIG_K_BASE * power_factor

    # Handle edge case: k=0 or power off
    if k <= 0:
        return 0.0

    # Infer effective tick from current conversion (inverse of sigmoid)
    c = max(0.01, min(99.99, current_conversion))
    # c = 100 / (1 + e^(-k*(t_eff - t0)))  =>  t_eff = t0 - ln(100/c - 1) / k
    try:
        t_eff = SIG_T0 - math.log(100.0 / c - 1.0) / k
    except (ValueError, ZeroDivisionError):
        t_eff = SIG_T0

    # Advance by 1 tick
    c_next = 100.0 / (1.0 + math.exp(-k * (t_eff + 1 - SIG_T0)))
    delta = c_next - current_conversion
    return max(0.0, delta)


def _calc_qc_grade(max_temp_seen: float, final_moisture: float, power_adequate: bool) -> str:
    """
    Grade Assignment:
      AAA: All parameters in spec
      AA:  Temp exceeded 90°C but stayed under 100°C, or minor moisture issue
      B:   Temp exceeded 100°C or moisture > 10% at packager input 
      Fail: Temp exceeded trip point or severe moisture breach
    """
    if max_temp_seen >= EXOTHERMIC_TRIP_TEMP:
        return "Fail"
    if final_moisture > 15.0:
        return "Fail"
    if max_temp_seen >= 100.0 or final_moisture > 10.0:
        return "B"
    if max_temp_seen >= 90.0 or not power_adequate:
        return "AA"
    return "AAA"


# ─── Main Tick Function ─────────────────────────────────────────

def simulate_tick(state: PlantState) -> PlantState:
    """
    Advance simulation by one tick with full physics engine.
    """
    new_alerts: list[Alert] = []
    tick = state.tick + 1

    # ─── 1. Update Batch Stage & Scheduling ─────────────────────
    next_stage = state.batchStage
    if tick > 200:
        next_stage = BatchStage.complete
    elif tick > 120:
        next_stage = BatchStage.hydration
    elif tick > 60:
        next_stage = BatchStage.functionalization
    elif tick > 10:
        next_stage = BatchStage.polymerization

    if next_stage == BatchStage.complete:
        state.interarrivalCounter += 1
        if state.interarrivalCounter >= state.interarrivalTicks:
            # Setup for next batch
            tick = 0
            next_stage = BatchStage.setup
            state.interarrivalCounter = 0
            state.tick = 0

    # ─── 2. Process Each Node ──────────────────────────────────
    updated_nodes: list[PlantNode] = []
    edges = state.edges
    inventory = {item.id: item.model_copy() for item in state.inventory}

    # Track energy cost delta for this tick (for COGS)
    tick_energy_kwh = 0.0

    # We will collect idle flags for bottleneck detection
    node_idle_flags: dict[str, bool] = {}

    for node in state.nodes:
        nd = node.data.model_copy()

        # Handle Grace Period for Mitigation
        is_in_grace = False
        if (nd.mitigationGraceTicks or 0) > 0:
            nd.mitigationGraceTicks -= 1
            is_in_grace = True

        # ── Storage Tanks ────────────────────────────────────
        if node.type == "storage":
            is_feeding = any(
                e.source == node.id
                and _find_node(state.nodes, e.target) is not None
                and _find_node(state.nodes, e.target).type == "reactor"
                for e in edges
            )
            nd.status = "running" if is_feeding and state.batchStage == BatchStage.setup else "idle"
            current_level = nd.currentLevel or 0

            # Low stock alert
            msg_low = f"LOW STOCK: {nd.label} below 500L"
            if current_level <= 500 and current_level > 0:
                if not any(a.message == msg_low for a in state.globalAlerts + new_alerts):
                    new_alerts.append(Alert(
                        id=_generate_alert_id(),
                        type="warning",
                        message=msg_low,
                        timestamp=_get_timestamp(),
                        nodeId=node.id
                    ))
            else:
                state.globalAlerts = [a for a in state.globalAlerts if a.message != msg_low]

            # Stockout alert
            msg_out = f"SUPPLY CHAIN SHORTAGE: {nd.label} is EMPTY — downstream reactors entering STANDBY"
            if current_level <= 0:
                if not any(a.message == msg_out for a in state.globalAlerts + new_alerts):
                    new_alerts.append(Alert(
                        id=_generate_alert_id(),
                        type="error",
                        message=msg_out,
                        timestamp=_get_timestamp(),
                        nodeId=node.id
                    ))
            else:
                state.globalAlerts = [a for a in state.globalAlerts if a.message != msg_out]

            # Consume material in Batches using dynamic config
            if is_feeding and next_stage == BatchStage.polymerization and state.batchStage == BatchStage.setup:
                mat_id = "styrene" if (nd.materialType or "").lower() == "styrene" else "dvb"
                batch_vol = state.batchSize if mat_id == "styrene" else state.batchSize * 0.07 # 7% DVB
                if mat_id in inventory:
                    inventory[mat_id].currentStock = max(0, inventory[mat_id].currentStock - batch_vol)
                nd.currentLevel = max(0, current_level - batch_vol)

            node_idle_flags[node.id] = not is_feeding

        # ── Reactors ─────────────────────────────────────────
        elif node.type == "reactor":
            has_incoming = any(
                e.target == node.id
                and _find_node(state.nodes, e.source) is not None
                and _find_node(state.nodes, e.source).type == "storage"
                and (_find_node(state.nodes, e.source).data.currentLevel or 0) > 0
                for e in edges
            )

            if has_incoming:
                # Get factory config for physical dimensions
                config = next(
                    (c for c in state.factoryConfigs if c.id == nd.configId),
                    None
                )
                power_number = config.agitation.powerNumber if config else 5.0
                diameter_m = config.geometry.diameter if config else 2.0
                rpm = nd.rpm or 120.0
                power_factor = power_number / 5.0
                cooling_mode = bool(nd.coolingMode)
                cooling_ticks_remaining = max(0, nd.coolingTicksRemaining or 0)
                if cooling_mode and cooling_ticks_remaining > 0:
                    cooling_ticks_remaining -= 1
                nd.coolingTicksRemaining = cooling_ticks_remaining

                # ── Agitation Power ──────────────────────────
                power_kw = _calc_agitation_power_kw(power_number, diameter_m, rpm)
                # Convert tick (1 sec) to hours for kWh
                tick_energy_kwh += power_kw / 3600.0
                nd.powerKw = round(power_kw, 2)

                # ── Conversion (S-curve) ─────────────────────
                current_conv = nd.conversion or 0.0
                effective_power_factor = power_factor * (0.45 if cooling_mode else 1.0)
                delta_conv = _sigmoidal_conversion(current_conv, tick, effective_power_factor)
                next_conversion = min(100.0, current_conv + delta_conv)

                # ── Thermodynamics: Non-Linear Exothermic Heat ──────────
                current_temp = nd.temp or 25.0
                
                # Exothermic rise Peaks dramatically between 40% and 70% conversion 
                auto_accel_factor = 1.0
                if 40.0 < next_conversion < 70.0:
                    auto_accel_factor = 2.5 + math.sin((next_conversion - 40) / 30 * math.pi) * 1.5
                
                exothermic_rise = REACTION_HEAT_SCALE * delta_conv * auto_accel_factor 
                cooling = JACKET_COOLING_RATE * (current_temp - JACKET_TEMP)
                if cooling_mode:
                    # Emergency cooling profile during thermal recovery.
                    cooling += 0.45 * max(0.0, current_temp - JACKET_TEMP) + 2.5
                
                # Deterministic thermal update (no random jitter) for smooth playback.
                next_temp = current_temp + exothermic_rise - cooling
                next_temp = max(JACKET_TEMP, next_temp)

                # Exit cooling mode only after minimum duration and below safe hysteresis threshold.
                if cooling_mode and cooling_ticks_remaining <= 0 and next_temp < COOLING_EXIT_TEMP:
                    nd.coolingMode = False
                    nd.coolingTicksRemaining = 0
                    recovery_msg = f"THERMAL RECOVERY COMPLETE: {nd.label} stabilized below {int(COOLING_EXIT_TEMP)}°C"
                    if not any(a.message == recovery_msg for a in state.globalAlerts + new_alerts):
                        new_alerts.append(Alert(
                            id=_generate_alert_id(),
                            type="info",
                            message=recovery_msg,
                            timestamp=_get_timestamp(),
                            nodeId=node.id
                        ))
                else:
                    nd.coolingMode = cooling_mode

                # ── Safety Trip ──────────────────────────────
                if next_temp >= EXOTHERMIC_TRIP_TEMP and not is_in_grace:
                    nd.status = "tripped"
                    new_alerts.append(Alert(
                        id=_generate_alert_id(),
                        type="error",
                        message=f"SAFETY TRIP: {nd.label} exceeded {EXOTHERMIC_TRIP_TEMP}°C — reactor shut down",
                        timestamp=_get_timestamp(),
                        nodeId=node.id
                    ))
                    node_idle_flags[node.id] = True
                    updated_nodes.append(node.model_copy(update={"data": nd}))
                    continue

                # ── High Temp Alert ───────────────────────────
                msg_temp = f"EXOTHERMIC RISK: {nd.label} exceeds {HIGH_TEMP_ALERT_THRESHOLD}°C"
                if next_temp > HIGH_TEMP_ALERT_THRESHOLD:
                    if not cooling_mode and not any(a.message == msg_temp for a in state.globalAlerts + new_alerts):
                        new_alerts.append(Alert(
                            id=_generate_alert_id(),
                            type="error",
                            message=msg_temp,
                            timestamp=_get_timestamp(),
                            nodeId=node.id
                        ))
                else:
                    state.globalAlerts = [a for a in state.globalAlerts if a.message != msg_temp]

                # ── QC Tracking ───────────────────────────────
                # Update peak temp seen on this reactor
                nd.peakTemp = max(nd.peakTemp or 25.0, next_temp)

                # Check agitation adequacy
                power_adequate = power_kw >= 0.5  # minimum 0.5 kW threshold
                nd.qualityGrade = _calc_qc_grade(
                    nd.peakTemp,
                    nd.moisture if nd.moisture is not None else 2.0,
                    power_adequate
                )

                # ── WIP Production at 50% conversion ─────────
                if next_conversion >= 50 and current_conv < 50:
                    if "copolymer-wip" in inventory:
                        inventory["copolymer-wip"].currentStock = min(
                            inventory["copolymer-wip"].maxCapacity,
                            inventory["copolymer-wip"].currentStock + 200
                        )
                    new_alerts.append(Alert(
                        id=_generate_alert_id(),
                        type="info",
                        message=f"Copolymer WIP batch released from {nd.label}",
                        timestamp=_get_timestamp(),
                        nodeId=node.id
                    ))

                # ── Real Diagnostics & PSD Bins ──────────────
                nd.exothermicDelta = round(exothermic_rise, 2)
                nd.pressure = round(1.0 + (power_kw * 0.1) + (current_temp - 25.0)*0.02, 2)
                
                # PSD Math model (7 bins)
                psd_mean = 0.62 + (current_temp - 60.0) * 0.005 if current_temp > 60.0 else 0.62
                nd.psdMean = round(psd_mean, 3)

                # Generate bell curve bins centered around psd_mean
                # As temp rises, distribution flattens
                spread = 1.0 + max(0, (current_temp - 60.0) / 40.0)
                base_curve = [
                    12 + spread*10, 
                    28 + spread*5, 
                    85 - spread*10, 
                    142 - spread*20, 
                    95 - spread*10, 
                    32 + spread*15, 
                    8 + spread*10
                ]
                nd.psdBins = [max(0, int(b)) for b in base_curve]

                nd.status = "running"
                nd.temp = round(next_temp, 2)
                nd.conversion = round(next_conversion, 4)
                node_idle_flags[node.id] = False

            else:
                nd.status = "idle"
                node_idle_flags[node.id] = True

        # ── Washer ───────────────────────────────────────────
        # Washer processing logic moved to single consolidated block below.

        # ── Surge Buffer ────────────────────────────────────
        elif node.type == "buffer":
            upstream_washer_running = any(
                e.target == node.id
                and _find_node(state.nodes, e.source) is not None
                and _find_node(state.nodes, e.source).type == "washer"
                and _find_node(state.nodes, e.source).data.status == "running"
                for e in edges
            )
            downstream_dryer_ready = any(
                e.source == node.id
                and _find_node(state.nodes, e.target) is not None
                and _find_node(state.nodes, e.target).type == "dryer"
                for e in edges
            )
            
            capacity = nd.capacity or 8000.0
            current_level = nd.currentLevel or 0.0

            # Inflow follows upstream washer throughput (L/tick equivalent).
            upstream_washers = [
                _find_node(state.nodes, e.source)
                for e in edges
                if e.target == node.id
                and _find_node(state.nodes, e.source) is not None
                and _find_node(state.nodes, e.source).type == "washer"
                and _find_node(state.nodes, e.source).data.status == "running"
            ]
            inflow = sum(((w.data.throughput or 0.0) * 0.06) for w in upstream_washers if w is not None)
            if inflow > 0:
                current_level = min(capacity, current_level + inflow)

            # Outflow matches shared dryer pull; split capacity if both buffers are active.
            active_buffers = sum(
                1 for n in state.nodes
                if n.type == "buffer" and (n.data.currentLevel or 0) > 2.0
            )
            per_buffer_outflow = 14.0 if active_buffers <= 1 else 9.0
            outflow = per_buffer_outflow if downstream_dryer_ready and current_level > 2.0 else 0.0
            if outflow > 0:
                current_level = max(0.0, current_level - outflow)
                nd.status = "running"
                node_idle_flags[node.id] = False
            else:
                nd.status = "idle"
                node_idle_flags[node.id] = not upstream_washer_running
                
            # Capacity Alarming
            if current_level >= capacity * 0.95 and not is_in_grace:
                 msg_overflow = f"CRITICAL BUFFER OVERFLOW: {nd.label} is at maximum capacity — interlock triggered."
                 if not any(a.message == msg_overflow for a in state.globalAlerts + new_alerts):
                    new_alerts.append(Alert(
                        id=_generate_alert_id(),
                        type="error",
                        message=msg_overflow,
                        timestamp=_get_timestamp(),
                        nodeId=node.id
                    ))
            elif current_level >= capacity * 0.85:
                if not any(a.message.startswith(f"BUFFER OVERFLOW WARNING: {nd.label}") for a in state.globalAlerts + new_alerts):
                    new_alerts.append(Alert(
                        id=_generate_alert_id(),
                        type="warning",
                        message=f"BUFFER OVERFLOW WARNING: {nd.label} at 85% capacity. Slow down upstream reactors.",
                        timestamp=_get_timestamp(),
                        nodeId=node.id
                    ))
            else:
                 # Clear overflow related alerts if we drop below 80%
                 if current_level < capacity * 0.8:
                    state.globalAlerts = [a for a in state.globalAlerts if f"BUFFER OVERFLOW" not in a.message]
            
            nd.currentLevel = max(0.0, current_level)
        elif node.type == "washer":
            upstream_ready = any(
                e.target == node.id
                and _find_node(state.nodes, e.source) is not None
                and _find_node(state.nodes, e.source).type == "reactor"
                and (_find_node(state.nodes, e.source).data.conversion or 0) > 30
                for e in edges
            )
            if upstream_ready:
                new_throughput = min(500, (nd.throughput or 0) + 8)
                if new_throughput >= 200 and (nd.throughput or 0) < 200:
                    if "copolymer-wip" in inventory:
                        inventory["copolymer-wip"].currentStock = max(
                            0, inventory["copolymer-wip"].currentStock - 100
                        )
                    if "washed-beads" in inventory:
                        inventory["washed-beads"].currentStock = min(
                            inventory["washed-beads"].maxCapacity,
                            inventory["washed-beads"].currentStock + 95
                        )
                nd.status = "running"
                nd.throughput = new_throughput
                # Power for washer centrifuge (~3 kW typical)
                tick_energy_kwh += 3.0 / 3600.0
                node_idle_flags[node.id] = False
            else:
                nd.status = "idle"
                node_idle_flags[node.id] = True

        # ── Dryer ─────────────────────────────────────────────
        elif node.type == "dryer":
            # Accept feed from Buffers OR directly from Washers (backwards compat)
            active_upstream = sum(
                1 for e in edges
                if e.target == node.id
                and _find_node(state.nodes, e.source) is not None
                and _find_node(state.nodes, e.source).type in ("washer", "buffer")
                and _find_node(state.nodes, e.source).data.status == "running"
            )
            
            upstream_running = active_upstream > 0

            msg_dryer_bot = "CAPACITY BOTTLENECK: Master Flash Dryer overloaded by multiple active lines."
            if active_upstream > 1:
                if not any(a.message == msg_dryer_bot for a in state.globalAlerts + new_alerts):
                    new_alerts.append(Alert(id=_generate_alert_id(), type="warning", message=msg_dryer_bot, timestamp=_get_timestamp()))
                DRYER_EFFECTIVE_K = DRYER_DECAY_K * 0.5
            else:
                state.globalAlerts = [a for a in state.globalAlerts if a.message != msg_dryer_bot]
                DRYER_EFFECTIVE_K = DRYER_DECAY_K

            if upstream_running:
                current_moisture = nd.moisture if nd.moisture is not None else 100.0
                current_temp = nd.temp or 25.0

                next_moisture = max(2.0, current_moisture * math.exp(-DRYER_EFFECTIVE_K))
                next_temp = min(DRYER_TEMP_MAX, current_temp + (2.0 if active_upstream == 1 else 3.0))

                if next_moisture <= 10.0 and current_moisture > 10.0:
                    new_alerts.append(Alert(
                        id=_generate_alert_id(),
                        type="info",
                        message=f"Drying complete — moisture target reached at {nd.label}",
                        timestamp=_get_timestamp(),
                        nodeId=node.id
                    ))

                nd.status = "running"
                nd.moisture = round(next_moisture, 2)
                nd.temp = round(next_temp, 1)
                tick_energy_kwh += 10.0 / 3600.0
                node_idle_flags[node.id] = False
            else:
                nd.status = "idle"
                node_idle_flags[node.id] = True

        # ── Packager ─────────────────────────────────────────
        elif node.type == "packager":
            upstream_dryer_dry = any(
                e.target == node.id
                and _find_node(state.nodes, e.source) is not None
                and _find_node(state.nodes, e.source).type == "dryer"
                and (_find_node(state.nodes, e.source).data.moisture
                     if _find_node(state.nodes, e.source).data.moisture is not None else 100) < 15
                for e in edges
            )
            if upstream_dryer_dry:
                new_throughput = (nd.throughput or 0) + 5
                old_throughput = nd.throughput or 0
                if int(new_throughput // 100) > int(old_throughput // 100):
                    if "washed-beads" in inventory:
                        inventory["washed-beads"].currentStock = max(
                            0, inventory["washed-beads"].currentStock - 50
                        )
                    # Find active washers to determine yield split
                    washers = [n for n in state.nodes if n.type == "washer" and n.data.status == "running"]
                    if not washers:
                        washers = [n for n in state.nodes if n.type == "washer"]

                    split_weight = 1.0 / max(1, len(washers))
                    
                    for w in washers:
                        prod_key = "cation-resin" if "cation" in (w.data.label or "").lower() or "wash a" in (w.data.label or "").lower() else "anion-resin"
                        inc_amt = 48 * split_weight
                        
                        if prod_key in inventory:
                            inventory[prod_key].currentStock = min(
                                inventory[prod_key].maxCapacity,
                                inventory[prod_key].currentStock + inc_amt
                            )
                        
                        new_alerts.append(Alert(
                            id=_generate_alert_id(),
                            type="info",
                            message=f"Finished goods batch packaged — {inc_amt:.0f}kg {prod_key.replace('-', ' ').title()}",
                            timestamp=_get_timestamp(),
                            nodeId=node.id
                        ))
                nd.status = "running"
                nd.throughput = new_throughput
                tick_energy_kwh += 1.5 / 3600.0
                node_idle_flags[node.id] = False
            else:
                nd.status = "idle"
                node_idle_flags[node.id] = True

        updated_nodes.append(node.model_copy(update={"data": nd}))

    # ─── 3. Sequence Optimization: Bottleneck Detection ─────────
    # Update wait times and collect all nodes causing delays
    bottleneck_ids = []

    candidate_nodes = [n for n in updated_nodes if n.type not in ("storage",)]

    for node in candidate_nodes:
        nid = node.id
        is_idle = node_idle_flags.get(nid, False)
        current_wait = node.data.waitTime or 0.0

        # Wait time accumulates when a machine is IDLE (starvation)
        # and decays when RUNNING.
        if is_idle:
            new_wait = current_wait + 1.0
        else:
            new_wait = max(0, current_wait - 2.0)

        is_bottleneck = False
        # A node is a BOTTLENECK if it is RUNNING and the node UPSTREAM has high wait time
        # For simplicity: mark nodes as bottlenecks if they are slow/running while others wait
        if not is_idle and (node.data.conversion or 0) < 90:
             # If it's a reactor running for a long time, it's a bottleneck
             if new_wait < 5.0 and node.type == "reactor":
                 is_bottleneck = False # Temporary placeholder logic
        
        # ACTUALLY: Let's follow a simpler industrial heuristic:
        # If a machine is RUNNING and its conversion is < 80, but it's been running a while, 
        # it's the current "Work in Progress" bottleneck.
        if not is_idle and node.type in ("reactor", "washer", "dryer"):
             # Heuristic: A machine is a bottleneck if it's in its slow/critical processing phase.
             # This prevents nodes from being flagged as bottlenecks at 0% or 100% conversion.
             if node.type == "reactor":
                 is_bottleneck = 40.0 <= (node.data.conversion or 0) <= 85.0
             elif node.type == "washer":
                 is_bottleneck = 20.0 <= (node.data.throughput or 0) <= 400.0
             else:
                 is_bottleneck = False

        # Update in updated_nodes
        for i, n in enumerate(updated_nodes):
            if n.id == nid:
                nd_new = n.data.model_copy()
                nd_new.waitTime = round(new_wait, 1)
                nd_new.isBottleneck = is_bottleneck
                updated_nodes[i] = n.model_copy(update={"data": nd_new})
                break

    # ─── 4. COGS: Accumulate Energy Cost ─────────────────────────
    tick_energy_cost = tick_energy_kwh * ELECTRICITY_PRICE_PER_KWH
    new_energy_cost = (state.cumulativeEnergyCost or 0.0) + tick_energy_cost

    # ─── 5. Build History Point ───────────────────────────────────
    active_reactor = next((n for n in updated_nodes if n.type == "reactor"), None)
    total_stock = sum((n.data.currentLevel or 0) for n in updated_nodes if n.type == "storage")
    history_point = HistoryPoint(
        tick=tick,
        temp=active_reactor.data.temp if active_reactor else 25.0,
        conversion=active_reactor.data.conversion if active_reactor else 0.0,
        stock=total_stock,
        powerKw=active_reactor.data.powerKw if active_reactor and active_reactor.data.powerKw else 0.0,
        energyCost=round(new_energy_cost, 4)
    )

    # ─── 6. Assemble Updated State ───────────────────────────────
    all_alerts = new_alerts + state.globalAlerts
    all_alerts = all_alerts[:10]

    history = state.simulationHistory + [history_point]
    history = history[-50:]

    return state.model_copy(update={
        "tick": tick,
        "batchStage": next_stage,
        "nodes": updated_nodes,
        "inventory": list(inventory.values()),
        "globalAlerts": all_alerts,
        "simulationHistory": history,
        "cumulativeEnergyCost": round(new_energy_cost, 4),
        "bottleneckNodeIds": bottleneck_ids,
    })
