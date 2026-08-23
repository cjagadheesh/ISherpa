"""
Coverage Score Engine for IPO Sherpa.

Evaluates SME IPO session data against SEBI (ICDR) Regulations, 2018
Chapter IX disclosure requirements (see SEBI_REQUIREMENTS below), calculating
a quantitative completeness score. Every entry maps to a distinct, named
disclosure item with its own required session field(s) — no synthetic or
placeholder requirements are counted toward the score.

Each requirement carries a `fill_type`:
  - "manual"    — can NEVER be auto-extracted from an uploaded document
                  (business decisions, banker/legal sign-off, CA certificates).
                  Gaps of this type should prompt the promoter to enter the
                  value themselves or obtain sign-off — not to "upload a doc".
  - "extracted" — normally populated from an uploaded document via the
                  extraction pipeline. Gaps of this type should prompt an
                  upload rather than manual typing.
This mirrors each field's `source_hint` in schema.json ("manual" -> manual,
everything else -> extracted).
"""

from typing import Dict, Any, List
from pydantic import BaseModel


SEBI_REQUIREMENTS = [
    # ── Cover Page / Issuer Identity ──────────────────────────────────────
    {
        "id": "cover_page.company_name",
        "section": "Cover Page",
        "description": "Registered Corporate Name of the Issuer Company",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 1(a)",
        "required_session_keys": ["company_name"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    {
        "id": "cover_page.cin",
        "section": "Cover Page",
        "description": "Corporate Identity Number (CIN) from Registrar of Companies",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 1(b)",
        "required_session_keys": ["cin"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    {
        "id": "cover_page.registered_address",
        "section": "Cover Page",
        "description": "Registered Office Address & Contact Particulars",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 1(c)",
        "required_session_keys": ["registered_office"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    {
        "id": "cover_page.company_secretary",
        "section": "Cover Page",
        "description": "Company Secretary / Compliance Officer Name",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 1(c)",
        "required_session_keys": ["company_secretary_name"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "manual"
    },
    {
        "id": "cover_page.contact_particulars",
        "section": "Cover Page",
        "description": "Compliance Officer Email and Telephone",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 1(c)",
        "required_session_keys": ["contact_email", "contact_phone"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "manual"
    },
    {
        "id": "cover_page.promoter_names",
        "section": "Cover Page",
        "description": "Names of Promoters on Cover Page Banner",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 1(d)",
        "required_session_keys": ["promoter_names"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    {
        "id": "cover_page.company_acronym",
        "section": "Cover Page",
        "description": "Company Acronym/Abbreviation Used Throughout the Document",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 2",
        "required_session_keys": ["company_acronym"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "manual"
    },
    {
        "id": "cover_page.lead_manager",
        "section": "Cover Page",
        "description": "Name and SEBI Registration Number of Merchant Banker",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 1(e)",
        "required_session_keys": ["lead_manager"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "manual"
    },
    {
        "id": "cover_page.registrar",
        "section": "Cover Page",
        "description": "Registrar to the Offer",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 1(f)",
        "required_session_keys": ["registrar"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "manual"
    },
    {
        "id": "cover_page.issue_size",
        "section": "Cover Page",
        "description": "Total Issue Size expressed in Crores",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 1(g)",
        "required_session_keys": ["issue_size"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "manual"
    },
    {
        "id": "cover_page.price_band",
        "section": "Cover Page",
        "description": "Price Band of the Offer",
        "clause_ref": "SEBI ICDR Reg 246(1)",
        "required_session_keys": ["price_band"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "manual"
    },
    # ── Offer Details ────────────────────────────────────────────────────
    {
        "id": "offer_details.fresh_issue_size",
        "section": "Offer Details",
        "description": "Fresh Issue Size",
        "clause_ref": "SEBI ICDR Reg 226",
        "required_session_keys": ["fresh_issue_size_cr"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "manual"
    },
    {
        "id": "offer_details.face_value",
        "section": "Offer Details",
        "description": "Face Value per Equity Share",
        "clause_ref": "SEBI ICDR Sch. VI Part A — The Offer",
        "required_session_keys": ["face_value_per_share"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    # ── Risk Factors ─────────────────────────────────────────────────────
    {
        "id": "risk_factors.internal_risks",
        "section": "Risk Factors",
        "description": "Internal & Company-Specific Risk Disclosures",
        "clause_ref": "SEBI ICDR Reg 248 & Sch. VI Part A, Para 2(a)",
        "required_session_keys": ["internal_risks"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "manual"
    },
    {
        "id": "risk_factors.external_risks",
        "section": "Risk Factors",
        "description": "External Industry & Macroeconomic Risk Factors",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 2(b)",
        "required_session_keys": ["external_risks"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "manual"
    },
    # ── Business Overview ────────────────────────────────────────────────
    {
        "id": "business.overview",
        "section": "Business Overview",
        "description": "Comprehensive Description of Products & Services",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 4(a)",
        "required_session_keys": ["products_services_description"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "manual"
    },
    {
        "id": "business.industries_served",
        "section": "Business Overview",
        "description": "Industries Served and Typical Customers",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 4(b)",
        "required_session_keys": ["industries_served", "typical_customers"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "manual"
    },
    {
        "id": "business.segment_reporting",
        "section": "Business Overview",
        "description": "Segment Reporting Applicability under Ind AS 108",
        "clause_ref": "Ind AS 108 / SEBI ICDR Sch. VI Part A, Para 4(c)",
        "required_session_keys": ["segment_reporting_applicable"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "extracted"
    },
    {
        "id": "business.geographies",
        "section": "Business Overview",
        "description": "Key Geographies Served",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 4(d)",
        "required_session_keys": ["key_geographies_served"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "extracted"
    },
    {
        "id": "business.customer_concentration",
        "section": "Business Overview",
        "description": "Top-5 Customer Revenue Concentration (3-Year Table)",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 4(e)",
        "required_session_keys": ["top5_customer_revenue_table"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    {
        "id": "business.strengths_strategies",
        "section": "Business Overview",
        "description": "Business Strengths and Strategies",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 4(g)",
        "required_session_keys": ["business_strengths", "business_strategies"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "manual"
    },
    {
        "id": "business.model",
        "section": "Business Overview",
        "description": "Business Model Description",
        "clause_ref": "SEBI ICDR Reg 248(1)",
        "required_session_keys": ["business_model"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "manual"
    },
    {
        "id": "business.incorporation_date",
        "section": "Business Overview",
        "description": "Date of Incorporation of Issuer Entity",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 4(c)",
        "required_session_keys": ["incorporation_date"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    # ── Industry Overview ────────────────────────────────────────────────
    {
        "id": "industry.name",
        "section": "Industry Overview",
        "description": "Industry Name & Sectoral Classification",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 4(b)",
        "required_session_keys": ["industry_name"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "manual"
    },
    {
        "id": "industry.report_source",
        "section": "Industry Overview",
        "description": "Named Industry Report Source (CRISIL/CARE/ICRA)",
        "clause_ref": "SEBI ICDR Sch. VI Part A — Industry Overview",
        "required_session_keys": ["industry_report_source"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "manual"
    },
    # ── Promoters ────────────────────────────────────────────────────────
    {
        "id": "promoters.detail",
        "section": "Promoters",
        "description": "Detailed Promoter Profiles (Name, DIN, Tenure, Qualification, Experience)",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 8(a) & Reg 2(1)(pp)",
        "required_session_keys": ["promoters"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    # ── Board of Directors & KMP ─────────────────────────────────────────
    {
        "id": "board.directors",
        "section": "Board & KMP",
        "description": "Board of Directors (incl. Independent Director Composition)",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 8(a) & Companies Act 2013 Sec 149",
        "required_session_keys": ["directors"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    {
        "id": "board.kmp",
        "section": "Board & KMP",
        "description": "Key Managerial Personnel (KMP) List",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 8(b)",
        "required_session_keys": ["kmp"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "extracted"
    },
    # ── Objects of Issue ─────────────────────────────────────────────────
    {
        "id": "objects.expansion",
        "section": "Objects of Issue",
        "description": "Capital Expenditure / Expansion Allocation",
        "clause_ref": "SEBI ICDR Reg 230 & Sch. VI Part A, Para 6(a)",
        "required_session_keys": ["expansion_amount"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "manual"
    },
    {
        "id": "objects.working_capital",
        "section": "Objects of Issue",
        "description": "Working Capital Requirement Allocation",
        "clause_ref": "SEBI ICDR Reg 230 & Sch. VI Part A, Para 6(a)",
        "required_session_keys": ["working_capital_amount"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "manual"
    },
    {
        "id": "objects.list",
        "section": "Objects of Issue",
        "description": "Itemized List of Objects & Capital Deployment Amounts",
        "clause_ref": "SEBI ICDR Reg 230 & Sch. VI Part A, Para 6(a)",
        "required_session_keys": ["use_of_proceeds"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "manual"
    },
    {
        "id": "objects.gcp",
        "section": "Objects of Issue",
        "description": "General Corporate Purposes (GCP) Amount Allocation",
        "clause_ref": "SEBI ICDR Reg 230(2)",
        "required_session_keys": ["general_corp_amount"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "manual"
    },
    # ── Financial Disclosures (3-Year Track Record, Restated) ───────────
    {
        "id": "financials.equity_capital",
        "section": "Financial Statements",
        "description": "Restated Equity Share Capital (3-Year)",
        "clause_ref": "SEBI ICDR Sch. VI Part B",
        "required_session_keys": ["equity_share_capital"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "extracted"
    },
    {
        "id": "financials.net_worth",
        "section": "Financial Statements",
        "description": "Latest Audited Net Worth (3-Year Restated)",
        "clause_ref": "SEBI ICDR Reg 229(2) & Sch. VI",
        "required_session_keys": ["net_worth"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    {
        "id": "financials.revenue",
        "section": "Financial Statements",
        "description": "Restated Revenue from Operations (3-Year)",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 7(a)-(c)",
        "required_session_keys": ["revenue_from_operations"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    {
        "id": "financials.ebitda",
        "section": "Financial Statements",
        "description": "EBITDA Operating Profit Track Record (3-Year)",
        "clause_ref": "SEBI ICDR Reg 229(1)(b)",
        "required_session_keys": ["ebitda"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    {
        "id": "financials.pat",
        "section": "Financial Statements",
        "description": "Restated Profit After Tax (PAT), 3-Year",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 7(d)-(f)",
        "required_session_keys": ["pat"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    {
        "id": "financials.eps",
        "section": "Financial Statements",
        "description": "Restated Basic & Diluted EPS (3-Year)",
        "clause_ref": "SEBI ICDR Sch. VI Part B",
        "required_session_keys": ["eps_basic", "eps_diluted"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "extracted"
    },
    {
        "id": "financials.borrowings",
        "section": "Financial Statements",
        "description": "Total Borrowings (3-Year Restated)",
        "clause_ref": "SEBI ICDR Sch. VI Part B",
        "required_session_keys": ["total_borrowings"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    {
        "id": "financials.auditor_qualifications",
        "section": "Financial Statements",
        "description": "Auditor Qualifications on Restated Financial Information",
        "clause_ref": "SEBI ICDR Sch. VI Part A — Auditor Qualifications",
        "required_session_keys": ["auditor_qualifications"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    # ── KPIs ─────────────────────────────────────────────────────────────
    {
        "id": "kpis.sector_selection",
        "section": "KPIs",
        "description": "Sector-Appropriate KPI Template Selected",
        "clause_ref": "SEBI ICDR — KPI Disclosure Circular (sector-dependent)",
        "required_session_keys": ["kpi_sector"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "manual"
    },
    {
        "id": "kpis.values",
        "section": "KPIs",
        "description": "3-Year KPI Values for the Selected Sector Template",
        "clause_ref": "SEBI ICDR — KPI Disclosure Circular",
        "required_session_keys": ["kpi_values"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    # ── Shareholding Pattern ─────────────────────────────────────────────
    {
        "id": "shareholding.pre_offer",
        "section": "Shareholding Pattern",
        "description": "Pre-Offer Shareholding Table",
        "clause_ref": "SEBI ICDR Sch. VI Part A — Capital Structure",
        "required_session_keys": ["pre_offer_shareholding"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    {
        "id": "shareholding.promoter_group",
        "section": "Shareholding Pattern",
        "description": "Promoter Group Members List",
        "clause_ref": "SEBI ICDR Reg 2(1)(pp)",
        "required_session_keys": ["promoter_group_members"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "extracted"
    },
    {
        "id": "capital.promoter_holding",
        "section": "Shareholding Pattern",
        "description": "Pre-issue Promoter Shareholding Percentage",
        "clause_ref": "SEBI ICDR Reg 236 & Sch. VI Part A, Para 5(d)",
        "required_session_keys": ["promoter_shareholding_pre_pct"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    # ── WACA ─────────────────────────────────────────────────────────────
    {
        "id": "waca.table",
        "section": "WACA",
        "description": "Weighted Average Cost of Acquisition Table (Promoters/Selling Shareholders)",
        "clause_ref": "SEBI ICDR Sch. VI Part A — Capital Structure",
        "required_session_keys": ["waca_table"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "manual"
    },
    {
        "id": "waca.ca_certificate_date",
        "section": "WACA",
        "description": "Dated CA Certificate Backing the WACA Table",
        "clause_ref": "SEBI ICDR Sch. VI Part A — Capital Structure",
        "required_session_keys": ["waca_ca_certificate_date"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "manual"
    },
    # ── Capital Structure ────────────────────────────────────────────────
    {
        "id": "capital.authorized",
        "section": "Capital Structure",
        "description": "Authorized Share Capital Details",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 5(a)",
        "required_session_keys": ["authorized_capital"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    {
        "id": "capital.existing_shares",
        "section": "Capital Structure",
        "description": "Pre-issue Paid-up Capital",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 5(b)",
        "required_session_keys": ["paid_up_capital_pre"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    # ── Related Party Transactions ───────────────────────────────────────
    {
        "id": "rpt.declared",
        "section": "Related Party Transactions",
        "description": "Related Party Transactions Declared (Last 3 Years)",
        "clause_ref": "SEBI ICDR Sch. VI Part A — Related Party Transactions (AS-18 / Ind AS 24)",
        "required_session_keys": ["rpt_declared"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "manual"
    },
    # ── Litigation ───────────────────────────────────────────────────────
    {
        "id": "litigation.summary",
        "section": "Litigation",
        "description": "Structured Litigation Summary (Company/Directors/Promoters/KMP/Senior Mgmt)",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 9(a) & Materiality Policy",
        "required_session_keys": ["litigation_summary"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "manual"
    },
    # ── General Information ──────────────────────────────────────────────
    {
        "id": "statutory.auditor",
        "section": "General Information",
        "description": "Statutory Auditors Name & Firm Registration Number",
        "clause_ref": "SEBI ICDR Sch. VI Part A, Para 10(a)",
        "required_session_keys": ["auditor_name", "auditor_membership"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    {
        "id": "statutory.pan",
        "section": "General Information",
        "description": "Company PAN Card Number",
        "clause_ref": "SEBI ICDR & Income Tax Act Sec 139A",
        "required_session_keys": ["pan"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "extracted"
    },
    # ── Material Contracts & Declaration ──────────────────────────────────
    {
        "id": "material_contracts.description",
        "section": "Material Contracts",
        "description": "Material Contracts & Documents for Inspection",
        "clause_ref": "SEBI ICDR Sch. VI Part A — Material Contracts",
        "required_session_keys": ["material_contracts_desc"],
        "severity": "material",
        "weight": 1.0,
        "fill_type": "manual"
    },
    {
        "id": "declaration.signed",
        "section": "Declaration",
        "description": "Board Declaration Signed Status",
        "clause_ref": "SEBI ICDR Reg 250 / Companies Act Sec 26",
        "required_session_keys": ["declaration_signed"],
        "severity": "blocker",
        "weight": 2.0,
        "fill_type": "manual"
    },
]


class RequirementGap(BaseModel):
    requirement_id: str
    description: str
    clause_ref: str
    severity: str
    missing_keys: List[str]
    suggested_action: str
    fill_type: str = "extracted"  # "manual" | "extracted" — drives UI prompt copy


class SectionCoverage(BaseModel):
    covered: int
    total: int
    pct: float


class CoverageReport(BaseModel):
    score: float
    score_label: str  # "STRONG" | "ADEQUATE" | "INCOMPLETE" | "BARE"
    covered: int
    total: int
    by_section: Dict[str, SectionCoverage]
    missing: List[RequirementGap]
    blocker_gaps: List[RequirementGap]
    manual_gaps: List[RequirementGap]      # missing AND fill_type == "manual" — prompt "enter yourself / get sign-off"
    extracted_gaps: List[RequirementGap]   # missing AND fill_type == "extracted" — prompt "upload a document"
    substantially_complete: bool  # True if score >= 80%


def _is_empty(val: Any) -> bool:
    """Mirrors validator._is_empty_value: list/table fields are empty only when they hold zero items."""
    if val is None:
        return True
    if isinstance(val, bool):
        return False
    if isinstance(val, (list, dict)):
        return len(val) == 0
    return str(val).strip() == ""


def compute_coverage(session: Dict[str, Any]) -> CoverageReport:
    """Computes SEBI ICDR completeness score across all session requirements."""
    form_data = session.get("form_data", session)

    covered_weight = 0.0
    total_weight = 0.0

    covered_count = 0
    total_count = len(SEBI_REQUIREMENTS)

    missing_gaps: List[RequirementGap] = []
    blocker_gaps: List[RequirementGap] = []
    manual_gaps: List[RequirementGap] = []
    extracted_gaps: List[RequirementGap] = []
    by_sec: Dict[str, Dict[str, Any]] = {}

    for req in SEBI_REQUIREMENTS:
        sec = req["section"]
        if sec not in by_sec:
            by_sec[sec] = {"covered": 0, "total": 0}
        by_sec[sec]["total"] += 1

        w = req["weight"]
        total_weight += w

        missing_keys = [k for k in req["required_session_keys"] if _is_empty(form_data.get(k))]

        if len(missing_keys) == 0:
            covered_weight += w
            covered_count += 1
            by_sec[sec]["covered"] += 1
        else:
            fill_type = req.get("fill_type", "extracted")
            suggested_action = (
                f"Enter {', '.join(missing_keys)} directly, or obtain banker/legal sign-off — this cannot be auto-extracted from any document, per {req['clause_ref']}."
                if fill_type == "manual" else
                f"Upload the source document so {', '.join(missing_keys)} can be auto-extracted, per {req['clause_ref']}."
            )
            gap = RequirementGap(
                requirement_id=req["id"],
                description=req["description"],
                clause_ref=req["clause_ref"],
                severity=req["severity"],
                missing_keys=missing_keys,
                suggested_action=suggested_action,
                fill_type=fill_type,
            )
            missing_gaps.append(gap)
            if req["severity"] == "blocker":
                blocker_gaps.append(gap)
            if fill_type == "manual":
                manual_gaps.append(gap)
            else:
                extracted_gaps.append(gap)

    score = round((covered_weight / total_weight) * 100.0, 1) if total_weight > 0 else 0.0

    if score >= 85:
        score_label = "STRONG"
    elif score >= 65:
        score_label = "ADEQUATE"
    elif score >= 40:
        score_label = "INCOMPLETE"
    else:
        score_label = "BARE"

    sec_coverage: Dict[str, SectionCoverage] = {}
    for sec_name, data in by_sec.items():
        pct = round((data["covered"] / data["total"]) * 100.0, 1) if data["total"] > 0 else 0.0
        sec_coverage[sec_name] = SectionCoverage(covered=data["covered"], total=data["total"], pct=pct)

    return CoverageReport(
        score=score,
        score_label=score_label,
        covered=covered_count,
        total=total_count,
        by_section=sec_coverage,
        missing=missing_gaps,
        blocker_gaps=blocker_gaps,
        manual_gaps=manual_gaps,
        extracted_gaps=extracted_gaps,
        substantially_complete=score >= 80.0
    )
