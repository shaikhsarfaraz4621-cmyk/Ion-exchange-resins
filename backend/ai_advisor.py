"""
AI Advisor — DeepSeek LLM integration for plant intelligence.
Injects real-time simulation context into the prompt so the AI
can give actionable, context-aware recommendations.
"""
import os
from openai import AsyncOpenAI
from schemas import PlantState


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


def _build_system_prompt(state: PlantState) -> str:
    """Build a rich system prompt injecting live plant metrics."""

    reactors = [n for n in state.nodes if n.type == "reactor"]
    storages = [n for n in state.nodes if n.type == "storage"]
    washer = next((n for n in state.nodes if n.type == "washer"), None)
    dryer = next((n for n in state.nodes if n.type == "dryer"), None)
    packager = next((n for n in state.nodes if n.type == "packager"), None)

    reactor_lines = "\n".join([
        f"  - {r.data.label} (ID: {r.id}, Config: {r.data.configId}, Mode: {r.data.reactorMode or 'cation'}): "
        f"Pos(X:{r.position.x}, Y:{r.position.y}), Temp={r.data.temp or 25:.1f}°C (Peak: {r.data.peakTemp or 25:.1f}°C), "
        f"Conversion={r.data.conversion or 0:.1f}%, Status={r.data.status or 'idle'}, "
        f"AgitationPower={r.data.powerKw or 0:.2f} kW, QC Grade={r.data.qualityGrade or 'AAA'}, "
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

    return f"""You are BlueStream AI, the intelligent Process Optimization Advisor and Supervisory Controller for an Ion Exchange Resin manufacturing facility.
You have deep expertise in chemical engineering and direct access to the plant's control systems.

CURRENT PLANT STATE (Tick: {state.tick}, Batch Stage: {state.batchStage.value.upper()}):

REACTORS:
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

