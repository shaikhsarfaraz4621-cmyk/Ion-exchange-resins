from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "docs"
OUT_DIR.mkdir(exist_ok=True)

FLOW_IMG = OUT_DIR / "process_flow.png"
STACK_IMG = OUT_DIR / "system_stack.png"
PDF_PATH = OUT_DIR / "Ion_Exchange_CTO_Briefing.pdf"


def draw_box(ax, x, y, w, h, label, fc="#eef2ff", ec="#334155"):
    rect = FancyBboxPatch(
        (x, y),
        w,
        h,
        boxstyle="round,pad=0.02,rounding_size=0.02",
        linewidth=1.5,
        edgecolor=ec,
        facecolor=fc,
    )
    ax.add_patch(rect)
    ax.text(x + w / 2, y + h / 2, label, ha="center", va="center", fontsize=10, weight="bold", color="#0f172a")


def arrow(ax, x1, y1, x2, y2, text=None):
    arr = FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="->", mutation_scale=12, lw=1.5, color="#1e293b")
    ax.add_patch(arr)
    if text:
        ax.text((x1 + x2) / 2, (y1 + y2) / 2 + 0.03, text, ha="center", va="bottom", fontsize=8, color="#334155")


def make_process_flow_diagram(path: Path):
    fig, ax = plt.subplots(figsize=(12, 4.5))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    w, h = 0.13, 0.2
    y = 0.4
    xs = [0.03, 0.19, 0.35, 0.51, 0.67, 0.83]
    labels = [
        "Feed Tanks\nStyrene + DVB",
        "Reactors\nPolymerization",
        "Washers\nImpurity Removal",
        "Surge Buffers\nFlow Decoupling",
        "Shared Dryer\nMoisture Reduction",
        "Packager + QC\nRelease",
    ]
    colors_fill = ["#dbeafe", "#fee2e2", "#e2e8f0", "#ddd6fe", "#fed7aa", "#dcfce7"]

    for x, label, fc in zip(xs, labels, colors_fill):
        draw_box(ax, x, y, w, h, label, fc=fc)

    for i in range(len(xs) - 1):
        arrow(ax, xs[i] + w, y + h / 2, xs[i + 1], y + h / 2)

    ax.text(0.5, 0.92, "Ion Exchange Resin Process Flow (Digital Twin)", ha="center", va="center", fontsize=14, weight="bold")
    ax.text(0.5, 0.12, "Critical controls: thermal safety in reactors, hydraulic balance at buffers, moisture compliance at dryer", ha="center", va="center", fontsize=9, color="#334155")
    fig.tight_layout()
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)


def make_system_stack_diagram(path: Path):
    fig, ax = plt.subplots(figsize=(8, 8))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    draw_box(ax, 0.1, 0.78, 0.8, 0.14, "UI Layer\nReact + React Flow + Dashboards + Chatbot", fc="#e0f2fe")
    draw_box(ax, 0.1, 0.57, 0.8, 0.14, "Control Layer\nZustand Store + Polling Loop + Safety Interlock", fc="#ede9fe")
    draw_box(ax, 0.1, 0.36, 0.8, 0.14, "API Layer\nFastAPI Endpoints (/tick, /reset, /mitigate, /advisor)", fc="#fee2e2")
    draw_box(ax, 0.1, 0.15, 0.8, 0.14, "Simulation & AI Layer\nPhysics Engine + Inventory + Alerting + LLM Advisor", fc="#dcfce7")

    arrow(ax, 0.5, 0.78, 0.5, 0.71, "UI actions")
    arrow(ax, 0.5, 0.57, 0.5, 0.5, "API calls")
    arrow(ax, 0.5, 0.36, 0.5, 0.29, "state transition")
    arrow(ax, 0.5, 0.29, 0.5, 0.36, "new state + alerts")
    arrow(ax, 0.5, 0.5, 0.5, 0.57, "responses")
    arrow(ax, 0.5, 0.71, 0.5, 0.78, "live updates")

    ax.text(0.5, 0.96, "System Architecture & Data Loop", ha="center", va="center", fontsize=14, weight="bold")
    fig.tight_layout()
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)


def build_pdf(pdf_path: Path):
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleX", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=20, textColor=colors.HexColor("#0f172a"), spaceAfter=12)
    h_style = ParagraphStyle("H2X", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, textColor=colors.HexColor("#0f172a"), spaceBefore=8, spaceAfter=6)
    p_style = ParagraphStyle("PX", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.2, leading=14.5, textColor=colors.HexColor("#1e293b"))
    bullet_style = ParagraphStyle("BX", parent=p_style, leftIndent=14, bulletIndent=2, spaceAfter=3)

    doc = SimpleDocTemplate(str(pdf_path), pagesize=A4, rightMargin=1.6 * cm, leftMargin=1.6 * cm, topMargin=1.4 * cm, bottomMargin=1.2 * cm)
    story = []

    story.append(Paragraph("Ion Exchange Resin Digital Twin - CTO Process Briefing", title_style))
    story.append(Paragraph("Focus: chemical process flow, control behavior, interlock logic, and UI-to-process mapping.", p_style))
    story.append(Spacer(1, 10))

    story.append(Paragraph("1) Chemical Process End-to-End", h_style))
    for b in [
        "Feed Tanks meter Styrene and DVB into reactor trains. These determine monomer availability and crosslink density.",
        "Reactors run the core polymerization. Conversion follows staged kinetics while exothermic heat must be actively managed.",
        "Washers/centrifuges clean and condition the slurry before finishing operations.",
        "Surge buffers absorb line variability and protect the shared dryer from upstream surges.",
        "Shared dryer drives moisture toward spec; this is a common downstream bottleneck under multi-line load.",
        "Packager and QC release finished resin only after process and moisture conditions are acceptable.",
    ]:
        story.append(Paragraph(b, bullet_style, bulletText="•"))

    story.append(Spacer(1, 8))
    story.append(Image(str(FLOW_IMG), width=17.5 * cm, height=6.3 * cm))

    story.append(Paragraph("2) UI-to-Plant Mapping", h_style))
    data = [
        ["UI Element", "Plant Meaning", "Operational Purpose"],
        ["Designer Canvas", "PFD-like live topology", "Visualize unit status, flow path, and bottlenecks"],
        ["Reactor Node", "Polymerization vessel", "Track conversion, temperature, power, quality proxies"],
        ["Buffer Node", "Hydraulic decoupler", "Detect and prevent overflow/interlock conditions"],
        ["Dashboard Kinetics", "Time-series process telemetry", "Monitor heat/conversion dynamics in real time"],
        ["Logs/Alerts", "EHS + operations events", "Trace alarms, interlocks, and mitigation actions"],
        ["Speed Slider", "Tick cadence controller", "Scale simulation pace without changing underlying logic"],
        ["Chatbot/Advisor", "Supervisory assist layer", "Propose/execute bounded mitigations"],
    ]
    table = Table(data, colWidths=[4.4 * cm, 5.0 * cm, 7.8 * cm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#94a3b8")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(table)

    story.append(Paragraph("3) Runtime Control & Safety Interlocks", h_style))
    for b in [
        "Frontend owns cadence: each poll interval triggers a backend tick request that computes the next plant state.",
        "Backend applies unit-operation physics, updates inventory/alerts/history, and returns synchronized state.",
        "Critical alert -> simulation auto-pauses -> mitigation recommendation generated -> operator applies action.",
        "Mitigation actions include: LOWER_RPM, START_COOLING, REPLENISH, DRAIN_BUFFER.",
        "Grace windows prevent immediate retrip, but severe thermal scenarios may require stronger sustained cooling policy.",
    ]:
        story.append(Paragraph(b, bullet_style, bulletText="•"))

    story.append(Spacer(1, 8))
    story.append(Image(str(STACK_IMG), width=14.8 * cm, height=14.8 * cm))

    story.append(Paragraph("4) Operating Procedure (Demo / Review)", h_style))
    for b in [
        "Start simulation; validate live movement in kinetics chart and unit statuses.",
        "Observe reactor temperature and conversion progression through polymerization stage.",
        "Watch washer-buffer-dryer alignment; check for early congestion in surge buffers.",
        "If interlock appears, apply mitigation from chat card and verify post-action stabilization.",
        "Use reset to return to baseline and re-run alternate scenarios for comparison.",
    ]:
        story.append(Paragraph(b, bullet_style, bulletText="•"))

    story.append(Paragraph("5) Executive Summary", h_style))
    story.append(
        Paragraph(
            "The digital twin captures the critical chemical and operational dependencies across feed, reaction, separation, buffering, drying, and packaging. "
            "It supports supervisory experimentation, rapid incident response rehearsal, and process communication between engineering and leadership.",
            p_style,
        )
    )

    doc.build(story)


def main():
    make_process_flow_diagram(FLOW_IMG)
    make_system_stack_diagram(STACK_IMG)
    build_pdf(PDF_PATH)
    print(PDF_PATH)


if __name__ == "__main__":
    main()
