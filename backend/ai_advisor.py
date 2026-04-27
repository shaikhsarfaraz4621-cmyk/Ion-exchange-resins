"""
AI Advisor — DeepSeek LLM integration for plant intelligence.
Injects real-time simulation context into the prompt so the AI
can give actionable, context-aware recommendations.
"""
import os
import uuid
from datetime import datetime
from openai import AsyncOpenAI
from schemas import PlantState, StructuredRecommendation, RecommendationSeverity, MitigationEvent


# DeepSeek uses an OpenAI-compatible API
_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("DEEPSEEK_API_KEY", "")
        if not api_key:
            raise ValueError("DEEPSEEK_API_KEY not set in environment")
        _client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com"
        )
    return _client


def _recipe_physics_signals(state: PlantState) -> list[str]:
    """Generate rule-based advisory signals from Phase 2 physics outputs."""
    signals = []
    reactors = [n for n in state.nodes if n.type == "reactor"]
    for r in reactors:
        d = r.data
        if (d.psdSpread or 0) > 0.30:
            signals.append(f"{r.id}: PSD spread high ({d.psdSpread:.2f}) — turbulence/stability imbalance, consider LOWER_RPM")
        if (d.swellingIndex or 0) > 1.15:
            signals.append(f"{r.id}: swelling risk elevated ({d.swellingIndex:.2f}) — DVB% may be too low")
        if (d.rigidityIndex or 0) < 0.55:
            signals.append(f"{r.id}: rigidity index low ({d.rigidityIndex:.2f}) — bead integrity risk, increase DVB% or initiator")
        if (d.predictedWBC or 100) < 70:
            signals.append(f"{r.id}: predicted WBC low ({d.predictedWBC:.1f}%) — check thermal peak and swelling index")
        if (d.predictedIonCapacity or 2.0) < 1.0:
            signals.append(f"{r.id}: ion-exchange capacity below threshold ({d.predictedIonCapacity:.2f} meq/mL)")
        if (d.temp or 25) > 85 and state.recipe.feedRateProfile == "aggressive":
            signals.append(f"{r.id}: thermal risk amplified by aggressive feed profile — consider START_COOLING or switch to balanced")
    return signals


def _now_ts() -> str:
    return datetime.utcnow().strftime("%H:%M:%S")


# ─── Phase 3: Decision Boundaries ───────────────────────────────

# Thermal
THERMAL_WATCH = 75.0
THERMAL_RISK  = 85.0
THERMAL_CRIT  = 100.0

# PSD spread
PSD_WATCH = 0.22
PSD_RISK  = 0.30

# Swelling index
SWELL_WATCH = 1.05
SWELL_RISK  = 1.15

# WBC
WBC_WATCH = 85.0
WBC_RISK  = 70.0

# Ion capacity
ION_CAP_WATCH = 1.2
ION_CAP_RISK  = 1.0

# Feed fill ratio
FEED_WATCH = 0.20
FEED_RISK  = 0.08

# Buffer fill ratio
BUF_WATCH = 0.75
BUF_RISK  = 0.90


def _severity(watch_thresh: float, risk_thresh: float, value: float, higher_is_worse: bool = True) -> RecommendationSeverity:
    """Return severity enum based on whether the value crosses watch/risk thresholds."""
    if higher_is_worse:
        if value >= risk_thresh:
            return RecommendationSeverity.risk
        if value >= watch_thresh:
            return RecommendationSeverity.watch
    else:
        if value <= risk_thresh:
            return RecommendationSeverity.risk
        if value <= watch_thresh:
            return RecommendationSeverity.watch
    return RecommendationSeverity.safe


def generate_structured_recommendations(state: PlantState) -> list[StructuredRecommendation]:
    """
    Phase 3 rule engine — produces structured condition→cause→action→impact cards.
    Each card carries a severity band (safe / watch / risk / critical) and an optional
    agentic command so the frontend can execute it directly.
    """
    recs: list[StructuredRecommendation] = []
    reactors = [n for n in state.nodes if n.type == "reactor"]
    storages = [n for n in state.nodes if n.type == "storage"]
    buffers  = [n for n in state.nodes if n.type == "buffer"]
    recipe   = state.recipe

    for r in reactors:
        d = r.data
        temp       = d.temp or 25.0
        rpm        = d.rpm or 120.0
        psd_spread = d.psdSpread or 0.0
        psd_mean   = d.psdMean or 0.62
        swell      = d.swellingIndex or 0.0
        wbc        = d.predictedWBC or 100.0
        ion_cap    = d.predictedIonCapacity or 2.0
        quality    = d.qualityGrade or "AAA"
        status     = d.status or "idle"
        conv       = d.conversion or 0.0
        peak       = d.peakTemp or temp
        label      = d.label

        # ── Thermal ──────────────────────────────────────────────
        if temp >= THERMAL_CRIT or status == "tripped":
            recs.append(StructuredRecommendation(
                id=str(uuid.uuid4())[:8],
                nodeId=r.id, nodeLabel=label,
                severity=RecommendationSeverity.critical,
                domain="thermal",
                condition=f"Temperature at {temp:.1f}°C — reactor TRIPPED / above critical limit (110°C).",
                rootCause="Exothermic runaway: initiator dosage or feed aggressiveness drove heat release faster than jacket cooling capacity.",
                action=f"Activate emergency cooling on {label}. Issue START_COOLING to drop temperature below 65°C before restarting.",
                expectedImpact="Temperature recovery to safe range within ~20 ticks. Prevents quality Fail grade and mechanical damage.",
                command="START_COOLING", commandValue=r.id, timestamp=_now_ts()
            ))
        elif temp >= THERMAL_RISK:
            recs.append(StructuredRecommendation(
                id=str(uuid.uuid4())[:8],
                nodeId=r.id, nodeLabel=label,
                severity=RecommendationSeverity.risk,
                domain="thermal",
                condition=f"Temperature at {temp:.1f}°C — above risk threshold ({THERMAL_RISK}°C).",
                rootCause=f"Exothermic heat rate exceeding jacket cooling. Feed profile '{recipe.feedRateProfile}' and initiator {recipe.initiatorDosage:.2f} g/L are amplifying exotherm.",
                action=f"Reduce RPM on {label} to lower agitation-driven heat input. Switch feed profile to 'conservative' if currently aggressive.",
                expectedImpact=f"~5–10°C temperature drop per 10 ticks. Reduces trip probability from ~70% to <10% at this conversion.",
                command="LOWER_RPM", commandValue=r.id, timestamp=_now_ts()
            ))
        elif temp >= THERMAL_WATCH:
            recs.append(StructuredRecommendation(
                id=str(uuid.uuid4())[:8],
                nodeId=r.id, nodeLabel=label,
                severity=RecommendationSeverity.watch,
                domain="thermal",
                condition=f"Temperature at {temp:.1f}°C — entering watch band ({THERMAL_WATCH}–{THERMAL_RISK}°C).",
                rootCause=f"Normal exothermic peak at {conv:.0f}% conversion. Peak temp so far: {peak:.1f}°C.",
                action="Monitor closely. If temperature continues rising beyond 85°C, pre-emptively reduce RPM.",
                expectedImpact="Early action here prevents escalation into the risk band and preserves AAA quality grade.",
                command=None, commandValue=None, timestamp=_now_ts()
            ))

        # ── PSD / Turbulence ─────────────────────────────────────
        if psd_spread >= PSD_RISK:
            in_target = recipe.targetPsdMin <= psd_mean <= recipe.targetPsdMax
            recs.append(StructuredRecommendation(
                id=str(uuid.uuid4())[:8],
                nodeId=r.id, nodeLabel=label,
                severity=RecommendationSeverity.risk,
                domain="psd",
                condition=f"PSD spread {psd_spread:.3f} mm (limit: {PSD_RISK} mm). Mean {psd_mean:.3f} mm {'✓ in target' if in_target else f'✗ outside target {recipe.targetPsdMin}–{recipe.targetPsdMax} mm'}.",
                rootCause="Turbulence/stability ratio is too high — droplets are being fragmented beyond the target size window. Usually caused by RPM being above the optimal range for this impeller geometry.",
                action=f"Reduce RPM on {label}. Target: bring turbulence/stability ratio back toward 1.0 to narrow the distribution.",
                expectedImpact=f"PSD spread reduction of ~0.05–0.10 mm per 15 ticks. Off-spec fines/oversize fraction drops, improving sieve yield.",
                command="LOWER_RPM", commandValue=r.id, timestamp=_now_ts()
            ))
        elif psd_spread >= PSD_WATCH:
            recs.append(StructuredRecommendation(
                id=str(uuid.uuid4())[:8],
                nodeId=r.id, nodeLabel=label,
                severity=RecommendationSeverity.watch,
                domain="psd",
                condition=f"PSD spread {psd_spread:.3f} mm — approaching risk band ({PSD_RISK} mm limit).",
                rootCause="Turbulence slightly elevated relative to droplet stability. Minor recipe–agitation mismatch.",
                action="Consider reducing RPM by 10–15% as a precaution. Watch for further spread increase.",
                expectedImpact="Keeps distribution narrow. Prevents off-spec escalation before quality grade degrades.",
                command=None, commandValue=None, timestamp=_now_ts()
            ))

        # ── Swelling / DVB ───────────────────────────────────────
        if swell > 0 and swell >= SWELL_RISK:
            recs.append(StructuredRecommendation(
                id=str(uuid.uuid4())[:8],
                nodeId=r.id, nodeLabel=label,
                severity=RecommendationSeverity.risk,
                domain="crosslink",
                condition=f"Swelling index {swell:.3f} — above risk threshold ({SWELL_RISK}). Bead integrity compromised.",
                rootCause=f"DVB% is low ({recipe.dvbPercent:.1f}%) relative to baseline. Under-crosslinked matrix absorbs excess water, leading to osmotic shock risk during wash.",
                action="Increase DVB% in next batch recipe (try +1–2%). Alternatively raise initiator dosage to accelerate crosslink formation.",
                expectedImpact="Each +1% DVB reduces swelling index by ~0.08. Osmotic shock risk and WBC loss decrease proportionally.",
                command=None, commandValue=None, timestamp=_now_ts()
            ))
        elif swell > 0 and swell >= SWELL_WATCH:
            recs.append(StructuredRecommendation(
                id=str(uuid.uuid4())[:8],
                nodeId=r.id, nodeLabel=label,
                severity=RecommendationSeverity.watch,
                domain="crosslink",
                condition=f"Swelling index {swell:.3f} — entering watch band. Polymer matrix slightly under-crosslinked.",
                rootCause=f"DVB% ({recipe.dvbPercent:.1f}%) near lower operating boundary. Crosslink density may be insufficient for wash stage.",
                action="No immediate action. Flag for next recipe iteration — consider +0.5% DVB.",
                expectedImpact="Preventive adjustment keeps swelling inside safe range and protects WBC.",
                command=None, commandValue=None, timestamp=_now_ts()
            ))

        # ── WBC ──────────────────────────────────────────────────
        if conv > 20 and wbc <= WBC_RISK:
            recs.append(StructuredRecommendation(
                id=str(uuid.uuid4())[:8],
                nodeId=r.id, nodeLabel=label,
                severity=RecommendationSeverity.risk,
                domain="quality",
                condition=f"Predicted WBC {wbc:.1f}% — critically low (threshold: {WBC_RISK}%). Bead fracture risk high.",
                rootCause=f"Combined effect: thermal peak {peak:.1f}°C stressing beads + swelling index {swell:.3f} indicating under-crosslinked matrix.",
                action="Apply jacket cooling to reduce thermal stress. Review DVB% and initiator dosage for next batch.",
                expectedImpact="Each 5°C reduction in peak temperature improves WBC by ~1.5–2%. DVB correction recovers structure integrity.",
                command="START_COOLING", commandValue=r.id, timestamp=_now_ts()
            ))
        elif conv > 20 and wbc <= WBC_WATCH:
            recs.append(StructuredRecommendation(
                id=str(uuid.uuid4())[:8],
                nodeId=r.id, nodeLabel=label,
                severity=RecommendationSeverity.watch,
                domain="quality",
                condition=f"Predicted WBC {wbc:.1f}% — below optimal (threshold: {WBC_WATCH}%). Some bead loss likely.",
                rootCause=f"Thermal peak {peak:.1f}°C combined with polymer structure stress from current recipe.",
                action="Monitor temperature trend. If rising further, pre-emptively lower RPM to reduce heat.",
                expectedImpact="Keeping temperature below 90°C preserves WBC above 85% for this recipe.",
                command=None, commandValue=None, timestamp=_now_ts()
            ))

        # ── Ion Exchange Capacity ────────────────────────────────
        if conv > 20 and ion_cap <= ION_CAP_RISK:
            recs.append(StructuredRecommendation(
                id=str(uuid.uuid4())[:8],
                nodeId=r.id, nodeLabel=label,
                severity=RecommendationSeverity.watch,
                domain="quality",
                condition=f"Predicted ion-exchange capacity {ion_cap:.2f} meq/mL — below minimum threshold ({ION_CAP_RISK} meq/mL).",
                rootCause="Low conversion + insufficient crosslink density reducing functional group density in the resin matrix.",
                action="Allow conversion to proceed further before functionalization stage. Ensure H₂SO₄ stock is adequate for full functionalization.",
                expectedImpact="Each 10% conversion increase adds ~0.06 meq/mL to predicted capacity. Full functionalization recovers ~15% capacity.",
                command=None, commandValue=None, timestamp=_now_ts()
            ))

    # ── Feed Tank Starvation ─────────────────────────────────────
    for s in storages:
        d = s.data
        level = d.currentLevel or 0.0
        cap   = d.capacity or 1.0
        ratio = level / cap
        mat   = d.materialType or d.label

        if ratio <= FEED_RISK:
            recs.append(StructuredRecommendation(
                id=str(uuid.uuid4())[:8],
                nodeId=s.id, nodeLabel=d.label,
                severity=RecommendationSeverity.risk if ratio <= 0.03 else RecommendationSeverity.watch,
                domain="feed",
                condition=f"{d.label}: {level:.0f} L / {cap:.0f} L ({ratio*100:.0f}%) — critically low.",
                rootCause=f"{'Tank empty — feed starvation active.' if level <= 0 else 'Stock depleting faster than resupply rate.'} Downstream reactors consuming {mat} continuously.",
                action=f"Replenish {d.label} immediately to 85% capacity to restore feed continuity.",
                expectedImpact="Prevents polymerization stoppage and batch discontinuity. Restores reactor throughput within 1–2 ticks.",
                command="REPLENISH", commandValue=s.id, timestamp=_now_ts()
            ))
        elif ratio <= FEED_WATCH:
            recs.append(StructuredRecommendation(
                id=str(uuid.uuid4())[:8],
                nodeId=s.id, nodeLabel=d.label,
                severity=RecommendationSeverity.watch,
                domain="feed",
                condition=f"{d.label}: {level:.0f} L / {cap:.0f} L ({ratio*100:.0f}%) — below reorder level.",
                rootCause=f"Normal depletion during active batch. Current draw rate will exhaust {mat} within the next ~{int(level / max(1, cap * 0.005))} ticks.",
                action=f"Schedule resupply of {d.label}. No immediate action required.",
                expectedImpact="Proactive resupply avoids unplanned stop.",
                command=None, commandValue=None, timestamp=_now_ts()
            ))

    # ── Surge Buffer Overflow ────────────────────────────────────
    for b in buffers:
        d = b.data
        level = d.currentLevel or 0.0
        cap   = d.capacity or 8000.0
        ratio = level / cap

        if ratio >= BUF_RISK:
            recs.append(StructuredRecommendation(
                id=str(uuid.uuid4())[:8],
                nodeId=b.id, nodeLabel=d.label,
                severity=RecommendationSeverity.risk,
                domain="buffer",
                condition=f"{d.label}: {level:.0f} kg / {cap:.0f} kg ({ratio*100:.0f}%) — near overflow.",
                rootCause="Downstream dryer throughput lagging behind upstream wash output. Surge buffer filling up, upstream interlock risk.",
                action=f"Drain {d.label} to 40% to restore headroom. Reduce washer throughput upstream.",
                expectedImpact="Clears overflow risk. Prevents upstream washer shutdown and production line interlock.",
                command="DRAIN_BUFFER", commandValue=b.id, timestamp=_now_ts()
            ))
        elif ratio >= BUF_WATCH:
            recs.append(StructuredRecommendation(
                id=str(uuid.uuid4())[:8],
                nodeId=b.id, nodeLabel=d.label,
                severity=RecommendationSeverity.watch,
                domain="buffer",
                condition=f"{d.label}: {level:.0f} kg / {cap:.0f} kg ({ratio*100:.0f}%) — filling toward overflow.",
                rootCause="Dryer throughput slightly below wash train output rate. Buffer accumulating.",
                action="Monitor. If above 90%, initiate drain.",
                expectedImpact="Early awareness prevents emergency drain.",
                command=None, commandValue=None, timestamp=_now_ts()
            ))

    # Sort: critical first, then risk, watch, safe
    _order = {RecommendationSeverity.critical: 0, RecommendationSeverity.risk: 1,
              RecommendationSeverity.watch: 2, RecommendationSeverity.safe: 3}
    recs.sort(key=lambda r: _order.get(r.severity, 9))
    return recs


def snapshot_mitigation_before(node_id: str, state: PlantState, action: str, trigger: str) -> MitigationEvent:
    """Capture a before-snapshot for a mitigation event."""
    node = next((n for n in state.nodes if n.id == node_id), None)
    d = node.data if node else None
    return MitigationEvent(
        id=str(uuid.uuid4())[:8],
        tick=state.tick,
        timestamp=_now_ts(),
        nodeId=node_id,
        nodeLabel=d.label if d else node_id,
        action=action,
        triggerCondition=trigger,
        beforeTemp=d.temp if d else None,
        beforeRpm=d.rpm if d else None,
        beforePsdSpread=d.psdSpread if d else None,
        beforeWBC=d.predictedWBC if d else None,
        beforeQuality=d.qualityGrade if d else None,
    )


def resolve_mitigation_after(event: MitigationEvent, state: PlantState) -> MitigationEvent:
    """Fill in the after-snapshot for an existing mitigation event."""
    node = next((n for n in state.nodes if n.id == event.nodeId), None)
    d = node.data if node else None
    return MitigationEvent(
        **{**event.model_dump(),
           "afterTemp": d.temp if d else None,
           "afterRpm": d.rpm if d else None,
           "afterPsdSpread": d.psdSpread if d else None,
           "afterWBC": d.predictedWBC if d else None,
           "afterQuality": d.qualityGrade if d else None,
           "resolved": True}
    )


def _build_system_prompt(state: PlantState) -> str:
    """Build a rich system prompt injecting live plant metrics."""

    reactors = [n for n in state.nodes if n.type == "reactor"]
    storages = [n for n in state.nodes if n.type == "storage"]

    reactor_lines = "\n".join([
        f"  - {r.data.label} (ID: {r.id}, Config: {r.data.configId}, Mode: {r.data.reactorMode or 'cation'}): "
        f"Pos(X:{r.position.x}, Y:{r.position.y}), Temp={r.data.temp or 25:.1f}°C (Peak: {r.data.peakTemp or 25:.1f}°C), "
        f"Conversion={r.data.conversion or 0:.1f}%, Status={r.data.status or 'idle'}, "
        f"AgitationPower={r.data.powerKw or 0:.2f} kW, QC Grade={r.data.qualityGrade or 'AAA'}, "
        f"CrosslinkDensity={r.data.crosslinkDensity or 0:.3f}, SwellingIdx={r.data.swellingIndex or 0:.3f}, "
        f"RigidityIdx={r.data.rigidityIndex or 0:.3f}, PSDspread={r.data.psdSpread or 0:.3f}, "
        f"PredWBC={r.data.predictedWBC or 0:.1f}%, IonCap={r.data.predictedIonCapacity or 0:.2f} meq/mL, "
        f"IdleTime={r.data.waitTime or 0:.0f}s, Bottleneck={'YES' if r.data.isBottleneck else 'no'}"
        for r in reactors
    ])

    storage_lines = "\n".join([
        f"  - {s.data.label} (ID: {s.id}, Mat: {s.data.materialType}): "
        f"Pos(X:{s.position.x}, Y:{s.position.y}), {s.data.currentLevel or 0:.0f}L / {s.data.capacity or 0:.0f}L ({((s.data.currentLevel or 0)/(s.data.capacity or 1))*100:.0f}%)"
        for s in storages
    ])

    downstream_units = [n for n in state.nodes if n.type in ["washer", "dryer", "packager"]]
    downstream_lines = "\n".join([
        f"  - {u.data.label} (ID: {u.id}, Type: {u.type}): Pos(X:{u.position.x}, Y:{u.position.y}), "
        f"Status={u.data.status or 'idle'}, IdleTime={u.data.waitTime or 0:.0f}s, "
        f"Bottleneck={'YES' if u.data.isBottleneck else 'no'}"
        for u in downstream_units
    ])

    raw_inv = [i for i in state.inventory if i.category == "raw"]
    wip_inv = [i for i in state.inventory if i.category == "wip"]
    fin_inv = [i for i in state.inventory if i.category == "finished"]

    inv_lines = "Raw Materials:\n" + "\n".join([
        f"  - {i.name}: {i.currentStock:.0f} {i.unit} / {i.maxCapacity:.0f} (Reorder at: {i.reorderPoint:.0f})"
        for i in raw_inv
    ])
    inv_lines += "\nWork-In-Progress:\n" + "\n".join([
        f"  - {i.name}: {i.currentStock:.0f} {i.unit}" for i in wip_inv
    ])
    inv_lines += "\nFinished Goods:\n" + "\n".join([
        f"  - {i.name}: {i.currentStock:.0f} {i.unit}" for i in fin_inv
    ])

    alerts_text = "None" if not state.globalAlerts else "\n".join([
        f"  - [{a.type.upper()}] {a.message}" for a in state.globalAlerts[:5]
    ])

    factory_configs = "\n".join([
        f"  - {c.id}: Diameter={c.geometry.diameter}m, Height={c.geometry.height}m, "
        f"Baffles={c.geometry.baffleCount}, Impeller={c.agitation.impellerType}, Power#={c.agitation.powerNumber}"
        for c in state.factoryConfigs
    ])

    bottlenecks = ", ".join(state.bottleneckNodeIds) if state.bottleneckNodeIds else "None"
    bottleneck_text = f"Current Bottleneck Node IDs: {bottlenecks}"
    energy_cost_text = f"${state.cumulativeEnergyCost or 0:.4f} USD cumulative energy cost this session."

    recipe = state.recipe
    recipe_text = (
        f"DVB%={recipe.dvbPercent}, Initiator={recipe.initiatorDosage} g/L, "
        f"M/W Ratio={recipe.monomerWaterRatio}, Feed Profile={recipe.feedRateProfile}, "
        f"Target PSD={recipe.targetPsdMin}–{recipe.targetPsdMax} mm"
    )
    physics_signals = _recipe_physics_signals(state)
    physics_signal_text = "\n".join(f"  - {s}" for s in physics_signals) if physics_signals else "  None currently."

    return f"""You are AUTONEX AI, the intelligent Process Optimization Advisor and Supervisory Controller for an Ion Exchange Resin manufacturing facility.
You have deep expertise in chemical engineering and direct access to the plant's control systems.

DATA SOURCE: The block below is the live simulation state for this request (tick {state.tick}, simulating={state.isSimulating}). It is merged with the operator's UI so numbers match what they see on screen.

CURRENT PLANT STATE (Tick: {state.tick}, Batch Stage: {state.batchStage.value.upper()}):

ACTIVE RECIPE:
  {recipe_text}

REACTORS (with physics outputs):
{reactor_lines}

FEED TANKS:
{storage_lines}

DOWNSTREAM UNITS:
{downstream_lines}

SEQUENCE OPTIMIZATION:
  {bottleneck_text}
  {energy_cost_text}

INVENTORY:
{inv_lines}

FACTORY CONFIGS:
{factory_configs}

ACTIVE ALERTS:
{alerts_text}

RECIPE-PHYSICS SIGNALS (rule-based diagnostics):
{physics_signal_text}

RECIPE-PHYSICS ADVISORY RULES:
- If PSD spread > 0.30: issue LOWER_RPM and explain turbulence/stability imbalance.
- If swelling index > 1.15: advise increasing DVB% or reducing monomer/water ratio.
- If rigidity index < 0.55: recommend raising DVB% and review initiator dosage.
- If predicted WBC < 70%: highlight thermal stress and swelling shock risk.
- If ion capacity < 1.0 meq/mL: flag incomplete functionalization or low crosslink density.
- If temp > 85°C and feed profile = aggressive: strongly recommend switching to balanced and START_COOLING.

ADVISORY & CONTROL INSTRUCTIONS:
- You have SUPERVISORY CONTROL. If a user asks to change a parameter (RPM, Temp, Tank Level), you MUST issue a corresponding command.
- COMMAND PROTOCOL: Wrap commands in double brackets.
    - [[SET_RPM:nodeId:value]]        (Example: [[SET_RPM:reactor-A:60]])
    - [[SET_THROUGHPUT:nodeId:value]] (Throttle a washer/unit, e.g. [[SET_THROUGHPUT:washer-A:250]])
    - [[REPLENISH:nodeId]]            (Refill a feed tank to 85%)
    - [[RESET_STATUS:nodeId]]         (Clear 'tripped' status and restart unit)
    - [[SET_TEMP:nodeId:value]]       (Directly set temperature — use for emergency cooling)
- Reference ACTUAL node IDs (e.g. reactor-A, tank-styrene, washer-A) from the state above.
- BUFFER OVERFLOWS: If a Surge Buffer overflows, identify the UPSTREAM unit feeding it and issue a SET_THROUGHPUT command to slow down the input flow rate. Do NOT purge material.
- Reference ACTUAL plant values.
- BE AGENTIC: If the user says "Fix Reactor B", don't just say okay—emit [[RESET_STATUS:reactor-B]] and [[SET_RPM:reactor-B:40]].
- Format responses with bullet points. Keep under 200 words.
- Hide the tags at the end of your response or within relevant sentences.
"""


async def get_ai_response(user_message: str, state: PlantState) -> str:
    """Send user query + plant context to DeepSeek and return the response."""
    try:
        client = _get_client()
        system_prompt = _build_system_prompt(state)

        response = await client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            max_tokens=500,
            temperature=0.7
        )

        return response.choices[0].message.content or "I couldn't generate a response. Please try again."

    except Exception as e:
        error_msg = str(e)
        if "authentication" in error_msg.lower() or "api key" in error_msg.lower():
            return "⚠️ DeepSeek API authentication failed. Please check the API key configuration."
        return f"⚠️ AI Advisor temporarily unavailable: {error_msg}"


async def get_mitigation_action(alert_message: str, state: PlantState, target_node_id: str = None) -> dict:
    """
    Agentic Mitigation — Ask DeepSeek to analyze the error and return
    a structured JSON fix. Enforces strict action enums.
    """

    # ── Build compact context for the LLM ─────────────────────────────
    reactors = [n for n in state.nodes if n.type == "reactor"]
    storages = [n for n in state.nodes if n.type == "storage"]

    reactor_state = "\n".join([
        f"  {r.id}: {r.data.label}, temp={r.data.temp or 25:.1f}°C, "
        f"rpm={r.data.rpm or 0}, conversion={r.data.conversion or 0:.1f}%, status={r.data.status}"
        for r in reactors
    ])
    storage_state = "\n".join([
        f"  {s.id}: {s.data.label}, level={s.data.currentLevel or 0:.0f}/{s.data.capacity or 0:.0f}"
        for s in storages
    ])

    # Mention the target node if the frontend already identified it
    target_info = f"This alert is specifically linked to node ID: {target_node_id}" if target_node_id else "Identify the failing node from the context."

    mitigation_prompt = f"""A critical alert has occurred in the ion exchange resin plant:

ALERT: "{alert_message}"
{target_info}

CURRENT PLANT STATE:
Reactors:
{reactor_state}

Feed Tanks:
{storage_state}

You MUST respond with ONLY a valid JSON object (no markdown, no explanation) in this exact format:
{{
  "action": "LOWER_RPM" or "START_COOLING" or "REPLENISH" or "DRAIN_BUFFER",
  "nodeId": "{target_node_id or 'the-id-of-the-node-to-fix'}",
  "label": "Short human-readable fix title",
  "description": "2-3 sentence explanation of what happened and what this fix does"
}}

Strict Rules:
- ACTION enum MUST be one of: ["LOWER_RPM", "START_COOLING", "REPLENISH", "DRAIN_BUFFER"]
- If a Surge Buffer is overflowing OR at capacity, use DRAIN_BUFFER.
- If a reactor temperature is dangerously high (>80°C), use LOWER_RPM.
- If a reactor has tripped (status=tripped), use START_COOLING.
- If a feed tank is empty or near-empty, use REPLENISH.
- If target_node_id is provided, you MUST use it in the JSON "nodeId" field.
"""

    try:
        client = _get_client()
        response = await client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "You are a plant safety system. Respond ONLY with valid JSON. No markdown fences."},
                {"role": "user", "content": mitigation_prompt}
            ],
            max_tokens=200,
            temperature=0.1
        )
        import json
        raw = response.choices[0].message.content or ""
        # Strip markdown fences if present
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(raw)

    except Exception:
        # ── Smart Local Fallback — inspect the actual plant state ─────
        return _local_mitigation_fallback(alert_message, state, target_node_id)


def _local_mitigation_fallback(alert_message: str, state: PlantState, target_node_id: str = None) -> dict:
    """
    Intelligent local fallback: instead of keyword matching on the alert,
    inspect the actual plant state to find the problem.
    """
    reactors = [n for n in state.nodes if n.type == "reactor"]
    storages = [n for n in state.nodes if n.type == "storage"]
    buffers = [n for n in state.nodes if n.type == "buffer"]

    # 0. If target_node_id is provided, try to find a specific fix for it first
    if target_node_id:
        target = next((n for n in state.nodes if n.id == target_node_id), None)
        if target:
            if target.type == "buffer":
                return {
                    "action": "DRAIN_BUFFER",
                    "nodeId": target.id,
                    "label": f"Interlock: Drain {target.data.label}",
                    "description": f"The surge buffer {target.data.label} is at maximum capacity. Activating emergency drain to prevent upstream shutdown."
                }
            if target.type == "reactor":
                if (target.data.status or "").lower() == "tripped" or (target.data.temp or 0) > 100:
                    return {
                        "action": "START_COOLING",
                        "nodeId": target.id,
                        "label": f"Direct Recovery: {target.data.label}",
                        "description": f"Target unit {target.data.label} is in secondary thermal trip. Activating emergency cooling to restore operations."
                    }
                return {
                    "action": "LOWER_RPM",
                    "nodeId": target.id,
                    "label": f"Direct RPM Limit: {target.data.label}",
                    "description": f"Target unit {target.data.label} is exceeding safety thresholds. Reducing agitation power to stabilize reaction."
                }
            if target.type == "storage":
                return {
                    "action": "REPLENISH",
                    "nodeId": target.id,
                    "label": f"Direct Tank Fill: {target.data.label}",
                    "description": f"Target unit {target.data.label} requires immediate material replenishment to prevent downstream starvation."
                }

    # 1. Check for any tripped reactor
    tripped = [r for r in reactors if (r.data.status or "").lower() == "tripped"]
    if tripped:
        r = tripped[0]
        return {
            "action": "START_COOLING",
            "nodeId": r.id,
            "label": f"Emergency Cooling: {r.data.label}",
            "description": f"{r.data.label} has TRIPPED at {r.data.temp or 0:.1f}°C. "
                           f"Activating emergency jacket cooling to bring temperature back to 30°C and reset reactor status."
        }

    # 2. Check for any overheated reactor (>80°C)
    hot = sorted(reactors, key=lambda r: r.data.temp or 0, reverse=True)
    if hot and (hot[0].data.temp or 0) > 80:
        r = hot[0]
        return {
            "action": "LOWER_RPM",
            "nodeId": r.id,
            "label": f"RPM Reduction: {r.data.label}",
            "description": f"{r.data.label} is at {r.data.temp or 0:.1f}°C — exceeding safe operating limits. "
                           f"Halving RPM from {r.data.rpm or 120} to {max(40, int((r.data.rpm or 120) * 0.5))} "
                           f"and applying 15°C emergency temperature drop."
        }

    # 3. Check for overflowing surge buffers before feed tank replenishment.
    # This prevents incorrect "DVB replenish" advice for a downstream congestion fault.
    overflowing_buffers = [
        b for b in buffers
        if (b.data.currentLevel or 0) >= (b.data.capacity or 8000) * 0.85
    ]
    if overflowing_buffers:
        b = sorted(
            overflowing_buffers,
            key=lambda x: (x.data.currentLevel or 0) / max(1.0, (x.data.capacity or 8000)),
            reverse=True
        )[0]
        return {
            "action": "DRAIN_BUFFER",
            "nodeId": b.id,
            "label": f"Interlock Relief: {b.data.label}",
            "description": f"{b.data.label} is above safe surge capacity, indicating downstream removal lag. "
                           f"Draining to 40% restores flow headroom and prevents upstream wash train backup."
        }

    # 4. Check for depleted feed tanks
    empty = [s for s in storages if (s.data.currentLevel or 0) <= 0]
    if empty:
        s = empty[0]
        cap = s.data.capacity or 20000
        return {
            "action": "REPLENISH",
            "nodeId": s.id,
            "label": f"Emergency Replenish: {s.data.label}",
            "description": f"{s.data.label} is EMPTY. Initiating emergency delivery to restore "
                           f"to 85% capacity ({int(cap * 0.85):,} L). Downstream cascade is halted until replenished."
        }

    # 5. Generic fallback — pick the hottest reactor anyway
    if hot:
        r = hot[0]
        return {
            "action": "LOWER_RPM",
            "nodeId": r.id,
            "label": f"Preventive RPM Reduction: {r.data.label}",
            "description": f"Alert: \"{alert_message}\". As a precaution, reducing agitation on {r.data.label} "
                           f"(current temp: {r.data.temp or 25:.1f}°C) to prevent further escalation."
        }

    return {
        "action": "LOWER_RPM",
        "nodeId": reactors[0].id if reactors else "reactor-A",
        "label": "Generic Safety Action",
        "description": f"Alert: \"{alert_message}\". Applying precautionary RPM reduction on primary reactor."
    }

