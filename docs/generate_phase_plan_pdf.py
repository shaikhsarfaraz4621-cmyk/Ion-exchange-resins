from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def section_title(text: str) -> Paragraph:
    return Paragraph(text, STYLES["SectionTitle"])


def body(text: str) -> Paragraph:
    return Paragraph(text, STYLES["Body"])


def bullet(text: str) -> Paragraph:
    return Paragraph(f"- {text}", STYLES["Bullet"])


OUTPUT_PATH = "docs/Client_Phasewise_Implementation_Plan.pdf"

doc = SimpleDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    leftMargin=1.7 * cm,
    rightMargin=1.7 * cm,
    topMargin=1.5 * cm,
    bottomMargin=1.5 * cm,
)

base = getSampleStyleSheet()
STYLES = {
    "Title": ParagraphStyle(
        "Title",
        parent=base["Title"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        spaceAfter=8,
    ),
    "SubTitle": ParagraphStyle(
        "SubTitle",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor="#4B5563",
        leading=13,
        spaceAfter=12,
    ),
    "SectionTitle": ParagraphStyle(
        "SectionTitle",
        parent=base["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        spaceBefore=8,
        spaceAfter=6,
    ),
    "Body": ParagraphStyle(
        "Body",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        spaceAfter=4,
    ),
    "Bullet": ParagraphStyle(
        "Bullet",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leftIndent=12,
        leading=14,
        spaceAfter=3,
    ),
}

story = []
story.append(Paragraph("Ion Exchange Digital Twin - Phasewise Implementation Plan", STYLES["Title"]))
story.append(Paragraph("Presentation Version | Prepared for Client Review", STYLES["SubTitle"]))

story.append(section_title("1) Program Objective"))
story.append(
    body(
        "Build a chemically meaningful, operationally useful, and commercially defensible digital twin "
        "for ion-exchange resin production by progressively adding recipe realism, physics coupling, "
        "prescriptive intelligence, ROI proof, and deployment readiness."
    )
)

story.append(section_title("2) Current Status (Completed)"))
story.append(body("Phase 0 and Phase 1 foundation is implemented."))
story.append(bullet("Recipe model is added end-to-end (backend + frontend)."))
story.append(bullet("Editable recipe fields: DVB %, initiator dosage, monomer/water ratio, feed profile, target PSD min/max."))
story.append(bullet("Recipe sync is wired through state APIs and visible in header/dashboard."))

story.append(section_title("3) Phase 2 - Process Physics Coupling (Core Technical Value)"))
story.append(body("Goal: convert recipe knobs into real process behavior."))
story.append(bullet("Cross-linking proxies: crosslinkDensity, swellingIndex, rigidityIndex."))
story.append(bullet("Bead formation model: turbulence proxy vs stability proxy to produce psdMean and psdSpread."))
story.append(bullet("Thermal coupling: initiator/feed aggressiveness changes exotherm tendency and risk."))
story.append(bullet("Quality coupling: qualityGrade computed from thermal profile, conversion, PSD compliance, and material proxies."))
story.append(bullet("New outputs: predictedWBC and predictedIonCapacity (proxy-based)."))
story.append(body("Acceptance: directional behavior must match process expectations when recipe inputs change."))

story.append(section_title("4) Phase 3 - Prescriptive Intelligence Upgrade"))
story.append(body("Goal: make recommendations causal, explainable, and operator-usable."))
story.append(bullet("Each recommendation includes condition, root cause, action, and expected impact."))
story.append(bullet("Decision boundaries: safe/watch/risk zones for thermal, PSD, hydration stress, and feed starvation."))
story.append(bullet("Mitigation tracking: before/after deltas logged when action is applied."))

story.append(section_title("5) Phase 4 - Comparative Evidence Layer (Client Conviction)"))
story.append(body("Goal: prove value with evidence, not visuals."))
story.append(bullet("Persist run objects: recipe snapshot, scenario, interventions, outcomes."))
story.append(bullet("Baseline vs optimized comparison under same initial conditions."))
story.append(bullet("Run-level KPIs: off-spec risk, energy per batch, critical alerts, recovery time, predicted WBC, quality confidence."))
story.append(bullet("Exportable summary report for stakeholder review."))

story.append(section_title("6) Phase 5 - Calibration and Confidence"))
story.append(body("Goal: improve industrial credibility and trust."))
story.append(bullet("Calibration workflow with historical runs for coefficient fitting."))
story.append(bullet("Confidence bands on thermal peak, PSD, WBC, and ion capacity predictions."))
story.append(bullet("Out-of-envelope warnings when operating beyond calibrated bounds."))

story.append(section_title("7) Phase 6 - Deployment Readiness and Enterprise Packaging"))
story.append(bullet("Role-based views for operations and management."))
story.append(bullet("Audit-ready run logs and standardized scenario library."))
story.append(bullet("Deployment playbook, monitoring template, and pilot success scorecard."))

story.append(
    body(
        "Phases are ordered by technical and business dependency (foundation first, evidence and "
        "deployment last). Duration is driven by validation depth, scope changes, and stakeholder review cycles."
    )
)

story.append(section_title("8) Client Demo Flow"))
story.append(bullet("Configure recipe with familiar process knobs (DVB, initiator, monomer/water, feed profile)."))
story.append(bullet("Run baseline batch with no intervention and show risk buildup."))
story.append(bullet("Run optimized batch with recommendations and show stability gains."))
story.append(bullet("Show side-by-side KPI deltas and business impact summary."))

story.append(section_title("9) Executive Closing Statement"))
story.append(
    body(
        "This roadmap first establishes recipe realism, then ties recipe to process physics, and finally proves "
        "business value using baseline-vs-optimized evidence. The result is a practical decision-support digital twin "
        "that links operator actions to measurable quality, safety, and cost outcomes."
    )
)

doc.build(story)
print(f"Generated: {OUTPUT_PATH}")
