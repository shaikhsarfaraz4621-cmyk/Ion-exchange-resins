from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parent
DOCS = ROOT / "docs"
DOCS.mkdir(exist_ok=True)

IMG1 = DOCS / "deep_chem_process_map.png"
IMG2 = DOCS / "deep_calc_pipeline.png"
IMG3 = DOCS / "deep_decision_pipeline.png"
PDF = DOCS / "Ion_Exchange_Deep_Technical_Manual.pdf"


def draw_box(ax, x, y, w, h, label, fc="#eef2ff", ec="#334155", fs=9):
    rect = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.02", linewidth=1.3, edgecolor=ec, facecolor=fc)
    ax.add_patch(rect)
    ax.text(x + w / 2, y + h / 2, label, ha="center", va="center", fontsize=fs, color="#0f172a", weight="bold")


def arrow(ax, x1, y1, x2, y2, text=None):
    arr = FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="->", mutation_scale=10, lw=1.2, color="#1e293b")
    ax.add_patch(arr)
    if text:
        ax.text((x1 + x2) / 2, (y1 + y2) / 2 + 0.015, text, ha="center", va="bottom", fontsize=8, color="#334155")


def make_process_map(path: Path):
    fig, ax = plt.subplots(figsize=(12, 5.5))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    draw_box(ax, 0.03, 0.64, 0.14, 0.18, "Styrene Tank", fc="#dbeafe")
    draw_box(ax, 0.03, 0.36, 0.14, 0.18, "DVB Tank", fc="#dbeafe")
    draw_box(ax, 0.23, 0.67, 0.17, 0.16, "Reactor A\n(Cation line)", fc="#fee2e2")
    draw_box(ax, 0.23, 0.33, 0.17, 0.16, "Reactor B\n(Anion line)", fc="#fee2e2")
    draw_box(ax, 0.46, 0.67, 0.14, 0.16, "Washer A", fc="#e2e8f0")
    draw_box(ax, 0.46, 0.33, 0.14, 0.16, "Washer B", fc="#e2e8f0")
    draw_box(ax, 0.64, 0.67, 0.14, 0.16, "Buffer A", fc="#ddd6fe")
    draw_box(ax, 0.64, 0.33, 0.14, 0.16, "Buffer B", fc="#ddd6fe")
    draw_box(ax, 0.83, 0.50, 0.14, 0.18, "Shared Dryer", fc="#fed7aa")
    draw_box(ax, 0.83, 0.22, 0.14, 0.18, "Packager/QC", fc="#dcfce7")

    arrow(ax, 0.17, 0.73, 0.23, 0.75)
    arrow(ax, 0.17, 0.45, 0.23, 0.41)
    arrow(ax, 0.17, 0.45, 0.23, 0.75)
    arrow(ax, 0.17, 0.73, 0.23, 0.41)
    arrow(ax, 0.40, 0.75, 0.46, 0.75)
    arrow(ax, 0.40, 0.41, 0.46, 0.41)
    arrow(ax, 0.60, 0.75, 0.64, 0.75)
    arrow(ax, 0.60, 0.41, 0.64, 0.41)
    arrow(ax, 0.78, 0.75, 0.83, 0.59, "merge")
    arrow(ax, 0.78, 0.41, 0.83, 0.59, "merge")
    arrow(ax, 0.90, 0.50, 0.90, 0.40)

    ax.text(0.5, 0.94, "Chemical Process Topology + Control Context", ha="center", va="center", fontsize=14, weight="bold")
    ax.text(0.5, 0.08, "Key risk zones: reactor exotherm, buffer overflow, dryer queueing", ha="center", va="center", fontsize=9, color="#334155")
    fig.tight_layout()
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)


def make_calc_pipeline(path: Path):
    fig, ax = plt.subplots(figsize=(12, 5.2))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    draw_box(ax, 0.03, 0.65, 0.18, 0.2, "Inputs\nRPM, Np, D, Recipe,\nCurrent Temp/Conv", fc="#dbeafe")
    draw_box(ax, 0.27, 0.65, 0.18, 0.2, "Agitation Power\nP = Np*rho*N^3*D^5", fc="#e0f2fe")
    draw_box(ax, 0.51, 0.65, 0.20, 0.2, "Conversion Update\nSigmoid delta", fc="#fee2e2")
    draw_box(ax, 0.76, 0.65, 0.20, 0.2, "Thermal Update\nExotherm - Cooling", fc="#ffedd5")

    draw_box(ax, 0.11, 0.28, 0.20, 0.2, "Crosslink / Swelling /\nRigidity", fc="#dcfce7")
    draw_box(ax, 0.38, 0.28, 0.20, 0.2, "PSD Mean/Spread\nTurbulence vs Stability", fc="#ddd6fe")
    draw_box(ax, 0.65, 0.28, 0.20, 0.2, "WBC / Ion Capacity\nQuality Grade", fc="#fef3c7")

    arrow(ax, 0.21, 0.75, 0.27, 0.75)
    arrow(ax, 0.45, 0.75, 0.51, 0.75)
    arrow(ax, 0.71, 0.75, 0.76, 0.75)

    arrow(ax, 0.61, 0.65, 0.21, 0.48, "recipe/state")
    arrow(ax, 0.86, 0.65, 0.48, 0.48, "temp/conv")
    arrow(ax, 0.21, 0.48, 0.38, 0.38)
    arrow(ax, 0.58, 0.38, 0.65, 0.38)

    ax.text(0.5, 0.94, "Model Calculation Pipeline Per Tick", ha="center", va="center", fontsize=14, weight="bold")
    fig.tight_layout()
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)


def make_decision_pipeline(path: Path):
    fig, ax = plt.subplots(figsize=(12, 4.8))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    draw_box(ax, 0.03, 0.62, 0.16, 0.2, "Run Records\ncompleted/aborted", fc="#dbeafe")
    draw_box(ax, 0.23, 0.62, 0.16, 0.2, "Run KPIs\nthermal/quality/energy", fc="#e0f2fe")
    draw_box(ax, 0.43, 0.62, 0.16, 0.2, "Run Ranking\nweighted score", fc="#fee2e2")
    draw_box(ax, 0.63, 0.62, 0.16, 0.2, "Candidate Grid\n(recipe constraints)", fc="#ddd6fe")
    draw_box(ax, 0.83, 0.62, 0.14, 0.2, "Top-N\nCandidates", fc="#dcfce7")

    draw_box(ax, 0.18, 0.22, 0.22, 0.2, "Proxy KPI Prediction\nper candidate", fc="#ffedd5")
    draw_box(ax, 0.46, 0.22, 0.22, 0.2, "Goal-based Scoring\nquality/safety/energy/throughput", fc="#fef3c7")
    draw_box(ax, 0.74, 0.22, 0.20, 0.2, "Explainability Trace\nsignals/causes/tradeoffs", fc="#ede9fe")

    arrow(ax, 0.19, 0.72, 0.23, 0.72)
    arrow(ax, 0.39, 0.72, 0.43, 0.72)
    arrow(ax, 0.59, 0.72, 0.63, 0.72)
    arrow(ax, 0.79, 0.72, 0.83, 0.72)
    arrow(ax, 0.71, 0.62, 0.28, 0.42)
    arrow(ax, 0.40, 0.32, 0.46, 0.32)
    arrow(ax, 0.68, 0.32, 0.74, 0.32)

    ax.text(0.5, 0.93, "Decision Intelligence Logic Flow", ha="center", va="center", fontsize=14, weight="bold")
    fig.tight_layout()
    fig.savefig(path, dpi=180, bbox_inches="tight")
    plt.close(fig)


def bullets(story, items, style):
    for item in items:
        story.append(Paragraph(item, style, bulletText="•"))


def build_pdf(path: Path):
    styles = getSampleStyleSheet()
    title = ParagraphStyle("titlex", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=20, textColor=colors.HexColor("#0f172a"), spaceAfter=10)
    h1 = ParagraphStyle("h1x", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=14, textColor=colors.HexColor("#0f172a"), spaceBefore=6, spaceAfter=4)
    h2 = ParagraphStyle("h2x", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=11.5, textColor=colors.HexColor("#0f172a"), spaceBefore=3, spaceAfter=3)
    body = ParagraphStyle("bodyx", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.1, leading=13.8, textColor=colors.HexColor("#1e293b"))
    bullet = ParagraphStyle("bulletx", parent=body, leftIndent=13, bulletIndent=1, spaceAfter=2)
    code = ParagraphStyle("codex", parent=body, fontName="Courier", fontSize=9.3, leading=12.5, textColor=colors.HexColor("#0f172a"), backColor=colors.HexColor("#f8fafc"))

    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=1.5 * cm, rightMargin=1.5 * cm, topMargin=1.2 * cm, bottomMargin=1.2 * cm)
    s = []

    s.append(Paragraph("Ion Exchange Resin Simulator - Deep Technical Manual", title))
    s.append(Paragraph("Chemical terms, model calculations, backend logic, and technology architecture in detail.", body))
    s.append(Spacer(1, 8))
    s.append(Image(str(IMG1), width=18 * cm, height=8.2 * cm))

    s.append(PageBreak())
    s.append(Paragraph("1) Chemical & Process Terminology (Practical Meaning)", h1))
    bullets(
        s,
        [
            "<b>Styrene</b>: primary monomer forming the polymer backbone.",
            "<b>DVB (Divinylbenzene)</b>: crosslinker; higher DVB generally increases network rigidity and reduces swelling.",
            "<b>Initiator dosage</b>: controls polymerization initiation intensity; too high can increase exotherm risk.",
            "<b>Monomer/Water ratio</b>: influences suspension stability and final bead size distribution.",
            "<b>Conversion (%)</b>: fraction of monomer transformed into polymer structure.",
            "<b>Exotherm</b>: heat released during reaction; requires jacket cooling and safety envelopes.",
            "<b>PSD mean/spread</b>: particle size distribution center and width; drives quality/sieving behavior.",
            "<b>WBC (predicted)</b>: model quality proxy tied to bead integrity and thermal/crosslink effects.",
            "<b>Ion capacity (predicted)</b>: proxy for final ion-exchange functional performance.",
            "<b>Batch stage</b>: setup → polymerization → functionalization → hydration → complete.",
        ],
        bullet,
    )

    s.append(Paragraph("2) Core Equations and Calculation Logic", h1))
    s.append(Paragraph("2.1 Agitation Power", h2))
    s.append(Paragraph("The model uses the impeller power-number relation:", body))
    s.append(Paragraph("P = Np · rho · N^3 · D^5", code))
    bullets(
        s,
        [
            "Np: power number from equipment config",
            "rho: fluid density constant (1050 kg/m^3)",
            "N: rotational speed (rpm / 60)",
            "D: impeller diameter proxy from geometry config",
            "Output converted from watts to kW and accumulated into tick energy cost.",
        ],
        bullet,
    )
    s.append(Paragraph("2.2 Conversion Kinetics", h2))
    s.append(Paragraph("Conversion increment is computed by stepping a sigmoid with inferred effective time:", body))
    s.append(Paragraph("C(t) = 100 / (1 + exp(-k(t - t0)))", code))
    bullets(
        s,
        [
            "k scales with effective power factor (agitator + cooling mode effect).",
            "Current conversion is inverted to infer effective t, then advanced by one tick.",
            "Delta conversion is max(0, C_next - C_current) to avoid nonphysical backward conversion.",
        ],
        bullet,
    )
    s.append(Paragraph("2.3 Thermal Balance", h2))
    bullets(
        s,
        [
            "Exothermic rise depends on conversion delta, auto-acceleration window (~40-70% conv), initiator loading, and feed profile factor.",
            "Cooling term is jacket proportional cooling; emergency cooling mode adds stronger cooling boost.",
            "Temperature floor is jacket temperature; hard trip occurs at 110 C if not in mitigation grace window.",
            "Warning/error alerts are generated crossing thermal thresholds (80 C warning context + 110 C trip).",
        ],
        bullet,
    )
    s.append(Spacer(1, 6))
    s.append(Image(str(IMG2), width=18 * cm, height=7.8 * cm))

    s.append(PageBreak())
    s.append(Paragraph("3) Quality Proxy Stack (How Quality Is Estimated)", h1))
    bullets(
        s,
        [
            "<b>Crosslink density</b> is computed from DVB, initiator, and conversion weighted blend.",
            "<b>Swelling index</b> inversely follows crosslink density (higher crosslink -> lower swelling).",
            "<b>Rigidity index</b> increases with crosslink density.",
            "<b>Turbulence proxy</b> combines rpm, power number, and diameter.",
            "<b>Stability proxy</b> combines monomer-water-ratio proximity and crosslink support.",
            "<b>PSD outputs</b> are derived from turbulence/stability ratio.",
            "<b>Predicted WBC</b> is reduced by high thermal peak and poor swelling/ridigity balance.",
            "<b>Predicted ion capacity</b> increases with conversion/crosslink and stage boost.",
        ],
        bullet,
    )
    s.append(Paragraph("Quality grade logic uses multi-condition thresholds (conversion, PSD band, PSD spread, temperature, WBC) to map into AAA/AA/B/Fail.", body))

    s.append(Paragraph("4) Inventory, Unit Operations, and Alerts", h1))
    bullets(
        s,
        [
            "Storage nodes draw down based on batch size and connected active reactors; low-stock and empty alerts are emitted.",
            "Washers and buffers mediate intermediate flow; buffers can overflow and trigger warnings/errors.",
            "Shared dryer creates line coupling; its pull rate influences upstream buffer levels.",
            "Packaging/QC consumes dried output and updates finished goods indicators.",
            "Global alerts are deduplicated by message patterns and bounded in retained list length.",
        ],
        bullet,
    )

    s.append(PageBreak())
    s.append(Paragraph("5) KPI, Run Evidence, and Comparative Logic", h1))
    s.append(Paragraph("KPI engine computes run metrics from terminal state + history slice:", body))
    kpi_table = Table(
        [
            ["Metric", "How it is calculated", "Why it matters"],
            ["maxReactorTemp", "max reactor temp among reactors", "thermal safety"],
            ["finalConversion", "max reactor conversion at run end", "reaction completion proxy"],
            ["minPredictedWBC", "minimum reactor predicted WBC", "worst-case quality proxy"],
            ["totalEnergyCostDelta", "cumulative energy delta from run start", "cost/efficiency"],
            ["offSpecProxyScore", "PSD miss + spread penalty + quality penalty", "spec compliance risk"],
            ["error/warning counts", "alert counters during run", "operational stability"],
            ["tickDuration", "tickEnd - tickStart", "throughput proxy"],
        ],
        colWidths=[4.0 * cm, 7.0 * cm, 6.6 * cm],
    )
    kpi_table.setStyle(
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
    s.append(kpi_table)
    s.append(Spacer(1, 5))
    s.append(Paragraph("Run comparison computes B - A deltas and auto-generates narrative text highlighting meaningful directional changes.", body))

    s.append(PageBreak())
    s.append(Paragraph("6) Decision Intelligence (Detailed Technology Logic)", h1))
    bullets(
        s,
        [
            "Run ranking uses weighted composite score across quality, energy, safety, throughput.",
            "Baseline run is selected from top-ranked historical finished runs.",
            "Candidate recipes are generated by bounded local grid around baseline values within constraints.",
            "Each candidate receives proxy KPI prediction, then goal-aligned score.",
            "Top-N candidates are returned with confidence estimate and explainability trace.",
            "Explain endpoint produces single best candidate rationale for a selected run context.",
        ],
        bullet,
    )
    s.append(Spacer(1, 6))
    s.append(Image(str(IMG3), width=18 * cm, height=6.9 * cm))

    s.append(Paragraph("6.1 Scoring Weights", h2))
    s.append(Paragraph("Default ranking weights: quality 0.35, energy 0.20, safety 0.25, throughput 0.20. Decision optimization weights shift by goal priority (quality/energy/throughput/balanced).", body))

    s.append(Paragraph("7) AI Advisor & Mitigation Rule Layer", h1))
    bullets(
        s,
        [
            "Structured recommendation engine evaluates thermal, PSD, swelling, WBC, ion-capacity, feed starvation, and buffer overflow domains.",
            "Severity bands: safe, watch, risk, critical.",
            "Commandable actions: LOWER_RPM, START_COOLING, REPLENISH, DRAIN_BUFFER.",
            "Chat/mitigation integrates LLM reasoning but still bounded by deterministic action enums and process context.",
        ],
        bullet,
    )

    s.append(Paragraph("8) Important Engineering Notes", h1))
    bullets(
        s,
        [
            "Model is deterministic heuristic/proxy digital twin logic, not a first-principles plant-validated reactor model.",
            "Excellent for training, scenario rehearsal, and decision-support iteration.",
            "For production authority use, calibrate constants and thresholds against plant historian + lab assay data.",
        ],
        bullet,
    )

    doc.build(s)


def main():
    make_process_map(IMG1)
    make_calc_pipeline(IMG2)
    make_decision_pipeline(IMG3)
    build_pdf(PDF)
    print(PDF)


if __name__ == "__main__":
    main()

