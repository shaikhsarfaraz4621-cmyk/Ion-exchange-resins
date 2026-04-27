from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parent
DOCS = ROOT / "docs"
DOCS.mkdir(exist_ok=True)

ARCH_IMG = DOCS / "manual_architecture.png"
SEQ_IMG = DOCS / "manual_runtime_sequence.png"
RUN_IMG = DOCS / "manual_run_decision_loop.png"
PDF_OUT = DOCS / "Ion_Exchange_Full_System_Manual.pdf"


def draw_box(ax, x, y, w, h, label, fc="#eef2ff", ec="#334155", fs=9):
    rect = FancyBboxPatch(
        (x, y),
        w,
        h,
        boxstyle="round,pad=0.02,rounding_size=0.02",
        linewidth=1.4,
        edgecolor=ec,
        facecolor=fc,
    )
    ax.add_patch(rect)
    ax.text(
        x + w / 2,
        y + h / 2,
        label,
        ha="center",
        va="center",
        fontsize=fs,
        color="#0f172a",
        weight="bold",
    )


def arrow(ax, x1, y1, x2, y2, text=None):
    arr = FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="->", mutation_scale=11, lw=1.3, color="#1e293b")
    ax.add_patch(arr)
    if text:
        ax.text((x1 + x2) / 2, (y1 + y2) / 2 + 0.02, text, ha="center", va="bottom", fontsize=8, color="#334155")


def make_architecture_diagram(path: Path):
    fig, ax = plt.subplots(figsize=(11.5, 6.2))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    draw_box(ax, 0.04, 0.72, 0.25, 0.18, "Operator / User", fc="#dbeafe")
    draw_box(ax, 0.36, 0.72, 0.27, 0.18, "Frontend (React + Vite)\nViews, Canvas, Chat, Store", fc="#e0f2fe")
    draw_box(ax, 0.70, 0.72, 0.26, 0.18, "Backend API (FastAPI)\nState Authority", fc="#fee2e2")

    draw_box(ax, 0.08, 0.42, 0.2, 0.16, "Simulation Engine\nTick-based process model", fc="#dcfce7")
    draw_box(ax, 0.33, 0.42, 0.24, 0.16, "AI Advisor + Mitigation\nSupervisory assist", fc="#ede9fe")
    draw_box(ax, 0.62, 0.42, 0.2, 0.16, "Run Metrics + Evidence\nKPIs, compare/export", fc="#ffedd5")
    draw_box(ax, 0.82, 0.42, 0.14, 0.16, "Decision\nIntelligence", fc="#fef3c7", fs=8)

    arrow(ax, 0.29, 0.81, 0.36, 0.81, "UI actions")
    arrow(ax, 0.63, 0.81, 0.70, 0.81, "REST API")
    arrow(ax, 0.83, 0.72, 0.18, 0.58, "tick/compute")
    arrow(ax, 0.83, 0.72, 0.45, 0.58, "advisor")
    arrow(ax, 0.83, 0.72, 0.72, 0.58, "run data")
    arrow(ax, 0.83, 0.72, 0.89, 0.58, "optimize")

    arrow(ax, 0.18, 0.42, 0.72, 0.42, "KPI inputs")
    arrow(ax, 0.72, 0.42, 0.89, 0.42, "evidence -> decisions")
    arrow(ax, 0.89, 0.58, 0.49, 0.72, "recommendations")

    ax.text(0.5, 0.95, "Ion Exchange Simulator - System Architecture", ha="center", va="center", fontsize=14, weight="bold")
    fig.tight_layout()
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)


def make_runtime_sequence_diagram(path: Path):
    fig, ax = plt.subplots(figsize=(11.5, 4.8))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    cols = [0.08, 0.30, 0.54, 0.78]
    labels = ["Operator", "Frontend", "Backend API", "Simulation Core"]
    for x, label in zip(cols, labels):
        ax.text(x, 0.95, label, ha="center", va="center", fontsize=10, weight="bold")
        ax.plot([x, x], [0.12, 0.9], color="#94a3b8", linewidth=1.2, linestyle="--")

    def msg(x1, x2, y, txt):
        arrow(ax, x1, y, x2, y, txt)

    msg(cols[0], cols[1], 0.82, "Start batch")
    msg(cols[1], cols[2], 0.74, "POST /simulate/start")
    msg(cols[1], cols[2], 0.64, "POST /simulate/tick (poll)")
    msg(cols[2], cols[3], 0.56, "simulate_tick(state)")
    msg(cols[3], cols[2], 0.48, "updated state + alerts")
    msg(cols[2], cols[1], 0.40, "tick response")
    msg(cols[1], cols[0], 0.32, "render updates")
    msg(cols[1], cols[2], 0.24, "POST /advisor/mitigate (on critical)")
    msg(cols[2], cols[1], 0.16, "mitigation recommendation")

    ax.text(0.5, 0.05, "Runtime tick loop, sync path, and safety interlock", ha="center", va="center", fontsize=10, color="#334155")
    fig.tight_layout()
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)


def make_run_decision_loop(path: Path):
    fig, ax = plt.subplots(figsize=(9.5, 5))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    draw_box(ax, 0.06, 0.66, 0.2, 0.16, "Start Run", fc="#dbeafe")
    draw_box(ax, 0.32, 0.66, 0.2, 0.16, "Operate Batch", fc="#e0f2fe")
    draw_box(ax, 0.58, 0.66, 0.2, 0.16, "End / Abort", fc="#fee2e2")
    draw_box(ax, 0.74, 0.38, 0.2, 0.16, "Compute KPIs", fc="#ffedd5")
    draw_box(ax, 0.48, 0.14, 0.24, 0.16, "Decision Intelligence\nRank + Optimize", fc="#fef3c7")
    draw_box(ax, 0.18, 0.14, 0.2, 0.16, "Apply Recipe\nAdjustments", fc="#dcfce7")

    arrow(ax, 0.26, 0.74, 0.32, 0.74)
    arrow(ax, 0.52, 0.74, 0.58, 0.74)
    arrow(ax, 0.72, 0.66, 0.82, 0.54)
    arrow(ax, 0.74, 0.38, 0.60, 0.30)
    arrow(ax, 0.48, 0.22, 0.38, 0.22)
    arrow(ax, 0.28, 0.30, 0.16, 0.66, "next run")

    ax.text(0.5, 0.93, "Continuous Improvement Loop", ha="center", va="center", fontsize=14, weight="bold")
    fig.tight_layout()
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)


def add_bullets(story, items, style):
    for item in items:
        story.append(Paragraph(item, style, bulletText="•"))


def build_pdf(path: Path):
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "titlex",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=21,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=10,
    )
    h1 = ParagraphStyle(
        "h1x",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=6,
        spaceAfter=5,
    )
    h2 = ParagraphStyle(
        "h2x",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=4,
        spaceAfter=3,
    )
    body = ParagraphStyle(
        "bodyx",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10.2,
        leading=14,
        textColor=colors.HexColor("#1e293b"),
    )
    bullet = ParagraphStyle("bulletx", parent=body, leftIndent=14, bulletIndent=2, spaceAfter=2)

    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        rightMargin=1.6 * cm,
        leftMargin=1.6 * cm,
        topMargin=1.4 * cm,
        bottomMargin=1.3 * cm,
    )
    story = []

    story.append(Paragraph("Ion Exchange Resin Simulator - Full System Documentation and User Manual", title))
    story.append(Paragraph("Comprehensive guide for new users and technical reviewers with backend logic detail and architecture diagrams.", body))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Document Scope", h2))
    add_bullets(
        story,
        [
            "New-user onboarding, navigation, and operation procedures.",
            "Frontend-backend interaction model and runtime control loop.",
            "Backend endpoint responsibilities and process-engine behavior.",
            "Run evidence and decision-intelligence workflow.",
            "Troubleshooting playbooks and operational best practices.",
        ],
        bullet,
    )
    story.append(Spacer(1, 8))
    story.append(Image(str(ARCH_IMG), width=18 * cm, height=9.4 * cm))

    story.append(PageBreak())
    story.append(Paragraph("1. System Overview", h1))
    story.append(
        Paragraph(
            "The simulator represents an ion-exchange resin process line with dual upstream synthesis paths (A/B), shared downstream constraints, "
            "and supervisory tooling for monitoring, mitigation, and decision support. The frontend is an operator console; the backend is state authority and process engine.",
            body,
        )
    )
    story.append(Paragraph("1.1 Core Software Components", h2))
    comp_table = Table(
        [
            ["Layer", "Main Responsibility", "Key Artifacts"],
            ["Frontend", "Operator interaction and visualization", "React views, canvas, chat, run/decision screens"],
            ["State Store", "Client-side UI/process state", "Zustand simulation store and polling control"],
            ["Backend API", "State sync and command handling", "FastAPI endpoints under /state, /simulate, /runs, /decisions"],
            ["Simulation Core", "Tick-based process updates", "Physics/proxy updates, alerts, inventory, history"],
            ["Decision Layer", "Ranking and recommendation", "Run ranking, optimization candidates, explainability trace"],
        ],
        colWidths=[3.3 * cm, 6.1 * cm, 8.6 * cm],
    )
    comp_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#94a3b8")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(comp_table)

    story.append(Spacer(1, 8))
    story.append(Paragraph("1.2 Topology and Process Blocks", h2))
    add_bullets(
        story,
        [
            "Feed tanks supply styrene and DVB into two reactor lines.",
            "Reactor A and B each feed washer stages, then surge buffers.",
            "Both buffers converge into a shared dryer, then packaging/QC.",
            "Shared dryer acts as a natural capacity coordination point.",
        ],
        bullet,
    )

    story.append(PageBreak())
    story.append(Paragraph("2. New User Guide", h1))
    story.append(Paragraph("2.1 First-Time Startup Checklist", h2))
    add_bullets(
        story,
        [
            "Open frontend URL (typically localhost:5174).",
            "Confirm header does not show 'Backend Offline'.",
            "Verify recipe badge appears in top header (DVB/profile summary).",
            "Open Plant Twin view before initiating first batch.",
        ],
        bullet,
    )
    story.append(Paragraph("2.2 First Batch Walkthrough", h2))
    add_bullets(
        story,
        [
            "Click Initiate Batch and observe tick progression and stage transitions.",
            "Monitor reactor temperature and conversion trends early (first 10-20 ticks).",
            "Watch washer->buffer->dryer handoff for congestion behavior.",
            "If critical alert appears, review advisor mitigation before resuming.",
            "End run to save KPI evidence for comparisons.",
        ],
        bullet,
    )
    story.append(Paragraph("2.3 Primary Views and Their Purpose", h2))
    views = Table(
        [
            ["View", "What You Use It For"],
            ["Live Dashboard", "High-level operational status and trends"],
            ["Plant Twin (Designer)", "Real-time node-level process observation and control context"],
            ["Production Logs", "Chronological event and operation trace"],
            ["Alert Matrix", "Risk/event concentration by time and node"],
            ["Inventory Pulse", "Material availability and depletion monitoring"],
            ["AI Advisor", "Guidance, mitigation prompts, contextual analysis"],
            ["Runs & Evidence", "Experiment tracking, KPI evidence, compare/export"],
            ["Decision Intelligence", "Run ranking and recipe recommendations"],
        ],
        colWidths=[5.2 * cm, 12.8 * cm],
    )
    views.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9.2),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#94a3b8")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(views)

    story.append(PageBreak())
    story.append(Paragraph("3. Runtime Logic and Control Loop", h1))
    story.append(Paragraph("3.1 Polling-Driven Tick Lifecycle", h2))
    story.append(
        Paragraph(
            "When simulation is enabled, frontend polling repeatedly calls POST /simulate/tick. Backend computes the next state and returns updated nodes, edges, alerts, "
            "history information, recipe snapshot, and selected aggregate metrics (energy, bottleneck IDs).",
            body,
        )
    )
    story.append(Spacer(1, 6))
    story.append(Image(str(SEQ_IMG), width=18 * cm, height=7.2 * cm))
    story.append(Spacer(1, 6))
    story.append(Paragraph("3.2 Safety Interlock Behavior", h2))
    add_bullets(
        story,
        [
            "Frontend checks tick response for critical error alerts.",
            "On critical alert, simulation is auto-paused and chat panel is opened.",
            "Frontend requests mitigation recommendation from advisor endpoint.",
            "Operator can apply bounded mitigation actions (e.g., cooling/rpm/inventory actions).",
        ],
        bullet,
    )

    story.append(PageBreak())
    story.append(Paragraph("4. Backend Logic Deep Dive", h1))
    story.append(Paragraph("4.1 Backend Domain Responsibilities", h2))
    add_bullets(
        story,
        [
            "State endpoints: hydrate/sync/reset master process state.",
            "Simulation endpoints: start/stop/tick and scenario injections.",
            "Advisor endpoints: chat and mitigation recommendation workflows.",
            "Run endpoints: start/end/abort/list/compare/export evidence handling.",
            "Decision endpoints: run ranking, optimize, recommend-next, explain.",
        ],
        bullet,
    )
    story.append(Paragraph("4.2 Simulation Engine Mechanics", h2))
    add_bullets(
        story,
        [
            "Per-tick stage update and node traversal with type-specific logic.",
            "Reactor logic uses conversion progression, exotherm/cooling, quality proxies, safety trip checks.",
            "Storage and inventory logic tracks consumption and stockout/reorder conditions.",
            "Buffer and dryer logic mediates flow continuity and downstream constraints.",
            "History points and aggregate metrics are updated for dashboard and KPI use.",
        ],
        bullet,
    )
    story.append(Paragraph("4.3 Run Metrics and Comparative Evidence", h2))
    add_bullets(
        story,
        [
            "Run metrics aggregate terminal state + run history slice.",
            "KPIs include thermal, conversion, quality proxy, energy, and alert counters.",
            "Run comparison computes delta and short narrative between two runs.",
            "Run evidence becomes the basis for decision-intelligence ranking and optimization.",
        ],
        bullet,
    )
    story.append(Paragraph("4.4 Decision Intelligence Pipeline", h2))
    add_bullets(
        story,
        [
            "Rank completed/aborted runs using weighted KPI scoring.",
            "Select baseline run/recipe, then generate constrained candidate recipe grid.",
            "Predict KPI proxies per candidate and compute weighted candidate score.",
            "Return top-N candidates with confidence and explainability trace.",
            "Explain endpoint returns candidate trace for a specific run context.",
        ],
        bullet,
    )

    story.append(PageBreak())
    story.append(Paragraph("5. Continuous Improvement Workflow", h1))
    story.append(Image(str(RUN_IMG), width=15.8 * cm, height=8.2 * cm))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Operational Pattern", h2))
    add_bullets(
        story,
        [
            "Run baseline and capture clean evidence.",
            "Run a controlled variation with one recipe change at a time.",
            "Compare KPI deltas and inspect risk/quality tradeoffs.",
            "Use decision candidates to define next safe experiment.",
            "Repeat with evidence discipline to avoid blind tuning.",
        ],
        bullet,
    )
    story.append(Paragraph("Recommended Governance for Team Use", h2))
    add_bullets(
        story,
        [
            "Always label runs with scenario intent.",
            "Never compare runs with missing/aborted context without annotation.",
            "Record mitigation events during unstable runs.",
            "Treat decision outputs as advisory unless externally calibrated.",
        ],
        bullet,
    )

    story.append(PageBreak())
    story.append(Paragraph("6. Troubleshooting and FAQ", h1))
    story.append(Paragraph("6.1 Common Issues", h2))
    add_bullets(
        story,
        [
            "404 on /decisions/*: wrong backend instance/port running.",
            "CORS-like browser errors: backend 500 exceptions often appear as CORS failures in browser console.",
            "Frontend not reflecting env change: restart Vite after .env.local edits.",
            "Multiple port listeners: stale backend processes can keep old versions active.",
        ],
        bullet,
    )
    story.append(Paragraph("6.2 Fast Recovery Checklist", h2))
    add_bullets(
        story,
        [
            "Verify backend health endpoint responds.",
            "Verify frontend API base URL points to active backend port.",
            "Check openapi routes include expected decision endpoints.",
            "Restart frontend after backend/env changes.",
        ],
        bullet,
    )
    story.append(Paragraph("6.3 Practical Limitation Statement", h2))
    story.append(
        Paragraph(
            "Current process and decision mechanisms are advanced simulation heuristics/proxies and strong for training, demonstrations, and internal decision support loops. "
            "For production-grade plant control authority, additional calibration, validation, and governance are required.",
            body,
        )
    )

    doc.build(story)


def main():
    make_architecture_diagram(ARCH_IMG)
    make_runtime_sequence_diagram(SEQ_IMG)
    make_run_decision_loop(RUN_IMG)
    build_pdf(PDF_OUT)
    print(PDF_OUT)


if __name__ == "__main__":
    main()

