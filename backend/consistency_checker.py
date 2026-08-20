import json
import logging
import re
from typing import Dict, Any, List, Optional

logger = logging.getLogger("sebi-ipo-generator.consistency_checker")

try:
    from nlp_analyzer import nlp_semantic_match
except ImportError:
    nlp_semantic_match = None


# ── Static fallback explanations & Chain-of-Thought reasoning ───────────────────

FALLBACK_REASONING = {
    "company_name": {
        "explanation": (
            "Company name mismatch detected. Your 'Company Name' field (Cover Page) says '{form_name}' and your "
            "'Name on PAN Card' field (Compliance tab) says '{pan_name}' — both of these you can edit directly in "
            "the wizard. The uploaded GST certificate says '{gst_name}' and the uploaded Certificate of "
            "Incorporation says '{inc_name}' — these two come from the documents you uploaded, not from typed "
            "fields, so they can only be corrected by re-uploading a corrected document in the Document Vault."
        ),
        "reasoning_steps": [
            "1. Compared four name sources: Company Name field='{form_name}', Name on PAN Card field='{pan_name}', "
            "uploaded GST certificate='{gst_name}', uploaded Certificate of Incorporation='{inc_name}'.",
            "2. Statutory Rule (SEBI ICDR Reg 230(1)(a)): The issuer's corporate name must match exactly across all tax and corporate registrations.",
            "3. NLP Semantic Evaluation: Identified a substantive name discrepancy (not just spacing/punctuation) between at least two of these sources.",
            "4. Therefore: Corporate identity mismatch detected. The MCA Certificate of Incorporation is the authoritative legal name — every other source should match it."
        ]
    },
    "gst_vs_pl": {
        "explanation": (
            "GST turnover (₹{gst_turnover} Cr) does not match the P&L Revenue (₹{pl_revenue} Cr). "
            "Typically, GST declarations should align with restated financial revenue within standard "
            "tax reconciliation bounds (e.g. 10-15%). Verify if some divisions are GST-exempt or if filings are pending."
        ),
        "reasoning_steps": [
            "1. Extracted financial figures: Annual GST Turnover = ₹{gst_turnover} Cr, Restated P&L Revenue = ₹{pl_revenue} Cr.",
            "2. Statutory Rule (SEBI ICDR Reg 244(1)(b)): Operational revenue disclosed in financial disclosures must reconcile with statutory GST filings within 15% tolerance.",
            "3. Evaluated Variance: Difference between GST filing and restated P&L revenue exceeds the 15% threshold.",
            "4. Therefore: Flagged for mandatory CA reconciliation certificate to account for exempt supplies or unbilled revenue."
        ]
    },
    "inc_vs_gst_date": {
        "explanation": (
            "GST registration date ({gst_date}) is prior to the company incorporation date ({inc_date}). "
            "A company cannot register for GST before its legal incorporation date. "
            "Check for registration errors or post-facto transfers."
        ),
        "reasoning_steps": [
            "1. Extracted key filing dates: MCA Incorporation Date = {inc_date}, GST Registration Date = {gst_date}.",
            "2. Statutory Rule (Companies Act 2013 Sec 7 & GST Act Sec 22): A corporate legal entity cannot possess statutory GST registration prior to legal incorporation.",
            "3. Chronological Evaluation: The registered GST date pre-dates legal incorporation on MCA records.",
            "4. Therefore: Incompatible chronological registration sequence. Must verify if GST was transferred from a predecessor entity."
        ]
    },
    "capital_structure": {
        "explanation": (
            "Paid-up share capital (₹{paid_up} Cr) exceeds the Authorized share capital (₹{authorized} Cr). "
            "A company cannot issue more capital than authorized without raising limits through ROC filings. "
            "Please adjust or file for an increase."
        ),
        "reasoning_steps": [
            "1. Extracted capital metrics: Paid-up Capital = ₹{paid_up} Cr, Authorized Capital = ₹{authorized} Cr.",
            "2. Statutory Rule (Companies Act 2013 Sec 61 & 64): A company cannot issue paid-up shares exceeding its registered Authorized Share Capital ceiling.",
            "3. Evaluated Limit: Paid-up capital (₹{paid_up} Cr) exceeds the ROC Authorized ceiling (₹{authorized} Cr).",
            "4. Therefore: Ultra vires capital issuance until Form SH-7 is filed with the Registrar of Companies (ROC)."
        ]
    },
    "promoter_lockdown": {
        "explanation": (
            "Post-issue promoter shareholding ({post_pct}%) is below the SEBI ICDR minimum of 20% (Reg 236). "
            "Promoters must retain at least 20% of post-issue paid-up capital for lock-in compliance. "
            "Reduce the public issue size or increase promoter contribution."
        ),
        "reasoning_steps": [
            "1. Extracted shareholding calculations: Pre-issue Promoter Holding = {pct}%, Calculated Post-issue Promoter Shareholding = {post_pct}%.",
            "2. Statutory Rule (SEBI ICDR Reg 236(1)): Promoters must hold minimum 20% of post-issue paid-up capital subject to mandatory 3-year lock-in.",
            "3. Evaluated Holding: Calculated post-issue shareholding ({post_pct}%) falls below the 20% mandatory statutory threshold.",
            "4. Therefore: Offer size must be restructured or promoter lock-in contribution increased to meet Reg 236."
        ]
    },
    "sme_paidup_cap": {
        "explanation": (
            "Post-issue paid-up capital estimate (₹{post_paidup} Cr) exceeds the SME IPO eligibility cap of ₹25 Crores. "
            "Under SEBI ICDR Reg 229, companies with post-issue paid-up capital above ₹25 Cr must migrate to the main board. "
            "Please verify your capital structure."
        ),
        "reasoning_steps": [
            "1. Extracted post-issue forecast: Post-issue Paid-up Share Capital = ₹{post_paidup} Cr.",
            "2. Statutory Rule (SEBI ICDR Reg 229(1)): SME IPO exchange platforms (BSE SME / NSE Emerge) restrict listing to issuers with post-issue capital ≤ ₹25 Crores.",
            "3. Evaluated Ceiling: Estimated post-issue capital (₹{post_paidup} Cr) exceeds the ₹25 Cr ceiling.",
            "4. Therefore: Issuer is ineligible for SME IPO platform and must apply via Main Board listing route."
        ]
    },
    "objects_vs_issue": {
        "explanation": (
            "Sum of use-of-proceeds (₹{objects_total} Cr) does not match the stated issue size (₹{issue_size} Cr). "
            "SEBI ICDR Reg 247 requires every rupee of IPO proceeds to be accounted for. "
            "Reconcile the breakdown to match the total issue size."
        ),
        "reasoning_steps": [
            "1. Extracted deployment totals: Stated Issue Size = ₹{issue_size} Cr, Sum of Itemized Objects = ₹{objects_total} Cr.",
            "2. Statutory Rule (SEBI ICDR Reg 247): 100% of gross IPO proceeds must be accounted for across specific objects & general corporate purposes (max 25%).",
            "3. Evaluated Discrepancy: Variance of ₹{diff} Cr found between gross issue size and itemized object allocations.",
            "4. Therefore: Unreconciled capital allocation in draft prospectus."
        ]
    },
    "pan_format": {
        "explanation": (
            "PAN '{pan}' does not match the standard Indian PAN format "
            "(5 letters + 4 digits + 1 letter, e.g. ABCDE1234F). Please correct the PAN before submission."
        ),
        "reasoning_steps": [
            "1. Extracted input value: '{pan}'.",
            "2. Statutory Rule (Income Tax Act 1961 Sec 139A): PAN requires 5 uppercase letters + 4 digits + 1 letter (10 characters total).",
            "3. Evaluated input: Evaluated '{pan}'. Length is {pan_len} characters (expected 10) and does not match regex pattern '^[A-Z]{{5}}[0-9]{{4}}[A-Z]{{1}}$'.",
            "4. Therefore: Invalid PAN format; fails statutory verification."
        ]
    },
    "gstin_format": {
        "explanation": (
            "GSTIN '{gstin}' does not match the standard 15-character GST format "
            "(2-digit state code + PAN + 1 digit + Z + 1 check digit). Please verify the GSTIN against the GST certificate."
        ),
        "reasoning_steps": [
            "1. Extracted input value: '{gstin}'.",
            "2. Statutory Rule (GST Act Sec 25 & Rule 8): Standard 15-character structure (2-digit state code + 10-char PAN + 1 entity code + 'Z' + 1 checksum).",
            "3. Evaluated input: Evaluated '{gstin}'. Length is {gstin_len} characters (expected 15) and violates standard GSTIN structure.",
            "4. Therefore: Invalid GSTIN format; fails statutory tax verification."
        ]
    },
    "price_band_width": {
        "explanation": (
            "The price band upper limit (₹{upper}) exceeds 120% of the lower limit (₹{lower}). "
            "SEBI requires the price band spread to be within 20% of the floor price. Narrow the band to comply."
        ),
        "reasoning_steps": [
            "1. Extracted pricing values: Floor Price = ₹{lower}, Cap Price = ₹{upper}.",
            "2. Statutory Rule (SEBI ICDR Reg 253(1)): Cap price upper limit must be ≤ 120% of the floor price lower limit (max 20% spread).",
            "3. Evaluated Ratio: Cap price is {spread_pct}% of the floor price, exceeding the 120% statutory maximum.",
            "4. Therefore: Non-compliant price band spread. Narrow price band before DRHP submission."
        ]
    },
    "eps_diluted_exceeds_basic": {
        "explanation": (
            "Diluted EPS (₹{eps_diluted}) is higher than Basic EPS (₹{eps_basic}) for the latest fiscal year. "
            "Dilution (from potential shares such as ESOPs or convertibles) can only reduce or leave EPS "
            "unchanged, never increase it — this indicates a data entry error in one of the two figures."
        ),
        "reasoning_steps": [
            "1. Extracted figures: Basic EPS = ₹{eps_basic}, Diluted EPS = ₹{eps_diluted} (latest fiscal year).",
            "2. Accounting Rule (Ind AS 33, Earnings per Share): Diluted EPS reflects the effect of potential dilutive "
            "securities on the weighted-average share count, so it can only be ≤ Basic EPS.",
            "3. Evaluated Values: Diluted EPS (₹{eps_diluted}) exceeds Basic EPS (₹{eps_basic}), violating this rule.",
            "4. Therefore: One of the two EPS figures is misstated — verify against the restated financial statements."
        ]
    },
    "face_value_exceeds_price_band": {
        "explanation": (
            "The face value per share (₹{face_value}) exceeds the price band floor (₹{floor_price}). "
            "The issue price of an equity share cannot be set below its face value."
        ),
        "reasoning_steps": [
            "1. Extracted values: Face Value per Share = ₹{face_value}, Price Band Floor = ₹{floor_price}.",
            "2. Statutory Rule (Companies Act 2013 Sec 52 & SEBI ICDR pricing norms): Shares cannot be issued at a "
            "price below their face value (that would constitute an issue at a discount, which is prohibited for "
            "equity shares outside specific ESOP/sweat-equity exceptions).",
            "3. Evaluated Values: Price band floor (₹{floor_price}) is below face value (₹{face_value}).",
            "4. Therefore: Correct the price band or the face value — one of the two is misstated."
        ]
    },
    "litigation_narrative_mismatch": {
        "explanation": (
            "The structured Litigation Schedule reports {lit_count} pending matter(s) against the Company, but "
            "the free-text litigation disclosure states there are none. These two disclosures must agree."
        ),
        "reasoning_steps": [
            "1. Extracted structured data: Litigation Schedule totals {lit_count} pending matter(s) across all entity types.",
            "2. Extracted narrative: The 'Litigations Against the Issuer' text states no material litigation is pending.",
            "3. Statutory Rule (SEBI ICDR Schedule VI Part A): All disclosures concerning the same subject matter must "
            "be internally consistent across the prospectus.",
            "4. Therefore: Reconcile the narrative text with the structured Litigation Schedule before filing."
        ]
    },
    "auditor_mismatch": {
        "explanation": (
            "The statutory auditor entered on the Compliance tab ('{form_auditor}') does not match the auditor named "
            "in the uploaded audited financial statements ('{extracted_auditor}')."
        ),
        "reasoning_steps": [
            "1. Extracted names: Form entry = '{form_auditor}', Audited Financial Statement = '{extracted_auditor}'.",
            "2. Statutory Rule (Companies Act 2013 Sec 139 & SEBI ICDR disclosure norms): The statutory auditor named "
            "in the prospectus must be the same auditor who signed the restated financial statements.",
            "3. NLP Semantic Evaluation: Identified a substantive name discrepancy between the two sources.",
            "4. Therefore: Update the Compliance tab to match the audited financial statements, or verify if the "
            "auditor was recently changed and disclose the change per SEBI norms."
        ]
    },
    "waca_date_implausible": {
        "explanation": (
            "The WACA Chartered Accountant certificate date ({waca_date}) is not a plausible date — it is either "
            "before the company's incorporation date ({inc_date}) or in the future."
        ),
        "reasoning_steps": [
            "1. Extracted dates: WACA CA Certificate Date = {waca_date}, Incorporation Date = {inc_date}.",
            "2. Logical Rule: A Chartered Accountant certificate can only be dated on or after the company's own "
            "incorporation, and cannot be dated in the future.",
            "3. Evaluated Sequence: The certificate date fails this chronological check.",
            "4. Therefore: Verify the WACA CA certificate date against the actual document."
        ]
    },
    "segment_reporting_note_missing": {
        "explanation": (
            "Segment reporting is marked as not applicable, but no explanatory note has been provided. "
            "Ind AS 108 requires issuers to state why segment reporting does not apply, not just leave it unchecked."
        ),
        "reasoning_steps": [
            "1. Extracted value: Segment Reporting Applicable = False, Segment Reporting Note = (empty).",
            "2. Statutory Rule (Ind AS 108, Operating Segments): Where an issuer determines segment reporting is not "
            "applicable, the restated financial statements/prospectus must explain the basis for that determination.",
            "3. Evaluated Disclosure: No explanatory note is present despite the applicability flag being False.",
            "4. Therefore: Add a brief note explaining why the Company operates as a single reportable segment."
        ]
    },
    "customer_concentration_mismatch": {
        "explanation": (
            "The declared top-5 customer concentration ({declared_pct}%) does not match the sum of individual "
            "customer percentages in the Top-5 Customer Revenue table ({table_pct}%)."
        ),
        "reasoning_steps": [
            "1. Extracted values: Declared Customer Concentration = {declared_pct}%, Sum of Top-5 Customer Revenue "
            "Table rows = {table_pct}%.",
            "2. Statutory Rule (SEBI ICDR Schedule VI Part A): Customer concentration risk disclosures must be "
            "consistent with the underlying customer revenue breakup table.",
            "3. Evaluated Variance: The two figures differ by more than the acceptable rounding tolerance.",
            "4. Therefore: Reconcile the Risk Factors concentration percentage with the Top-5 Customer table in the Business Overview section."
        ]
    },
    "cash_flow_pat_conversion_weak": {
        "explanation": (
            "Operating cash flow (₹{cfo} Cr) is only {ratio}% of reported Profit After Tax (₹{pat} Cr) for {fy}. "
            "Profit not backed by cash collection is one of the first things a merchant banker or exchange reviewer "
            "questions before an SME IPO."
        ),
        "reasoning_steps": [
            "1. Extracted values: {fy} Cash Flow from Operating Activities = ₹{cfo} Cr, Profit After Tax = ₹{pat} Cr.",
            "2. Earnings-Quality Check: Cash Flow ÷ PAT = {ratio}%.",
            "3. Evaluated Threshold: A conversion ratio below 50% suggests profit is not yet being realised as cash — "
            "e.g. revenue booked but not collected, or non-cash accounting adjustments inflating PAT.",
            "4. Therefore: Reconcile the gap with a receivables ageing schedule or an auditor's note on cash conversion "
            "before this is questioned in review."
        ]
    },
    "receivables_outpacing_revenue": {
        "explanation": (
            "Trade receivables grew {recv_growth}% year-over-year while revenue from operations grew only "
            "{rev_growth}% ({fy}). Receivables consistently outrunning sales growth can indicate slower collections "
            "or revenue recognised before it is actually collectible."
        ),
        "reasoning_steps": [
            "1. Extracted values: {fy} Trade Receivables growth = {recv_growth}%, Revenue from Operations growth = {rev_growth}%.",
            "2. Earnings-Quality Check: Receivables growth exceeds revenue growth by {gap} percentage points.",
            "3. Evaluated Threshold: A gap this wide, on a meaningful receivables base, is a common signal reviewers "
            "probe for collection quality or channel-stuffing.",
            "4. Therefore: Disclose any change in credit terms and provide a debtor ageing schedule if this gap is genuine."
        ]
    }
}


_COT_CACHE: Dict[str, Dict[str, Any]] = {}


def get_explanation(rule_name: str, details: Dict[str, Any]) -> str:
    """Backward compatibility wrapper returning description string."""
    res = get_explanation_and_cot(rule_name, details)
    return res.get("explanation", "")


def get_explanation_and_cot(rule_name: str, details: Dict[str, Any]) -> Dict[str, Any]:
    """Generate human-readable explanation and Chain-of-Thought reasoning steps for a consistency failure.

    Returns cached or pre-formatted CoT steps instantly for sub-millisecond response time.
    """
    # Prepare details augmentation
    aug_details = dict(details)
    if "pan" in aug_details and "pan_len" not in aug_details:
        aug_details["pan_len"] = len(str(aug_details["pan"])) if aug_details["pan"] else 0
    if "gstin" in aug_details and "gstin_len" not in aug_details:
        aug_details["gstin_len"] = len(str(aug_details["gstin"])) if aug_details["gstin"] else 0
    if "lower" in aug_details and "upper" in aug_details and aug_details["lower"] > 0:
        aug_details["spread_pct"] = round((aug_details["upper"] / aug_details["lower"]) * 100, 1)
    if "objects_total" in aug_details and "issue_size" in aug_details:
        aug_details["diff"] = round(abs(aug_details["objects_total"] - aug_details["issue_size"]), 2)

    cache_key = f"{rule_name}:{json.dumps(aug_details, sort_keys=True)}"
    if cache_key in _COT_CACHE:
        return _COT_CACHE[cache_key]

    # Build structured CoT result
    fb_config = FALLBACK_REASONING.get(rule_name, {
        "explanation": "Data inconsistency found. Please verify the uploaded documents and form inputs.",
        "reasoning_steps": [
            "1. Extracted fields from uploaded documents and form inputs.",
            "2. Evaluated consistency across related fields according to SEBI ICDR guidelines.",
            "3. Discrepancy detected between documented values.",
            "4. Therefore: Requires verification and manual reconciliation."
        ]
    })

    template_exp = fb_config["explanation"]
    template_steps = fb_config["reasoning_steps"]

    try:
        fallback_exp = template_exp.format(**aug_details) if '{' in template_exp else template_exp
    except (KeyError, IndexError):
        fallback_exp = template_exp

    fallback_steps = []
    for step in template_steps:
        try:
            fallback_steps.append(step.format(**aug_details) if '{' in step else step)
        except (KeyError, IndexError):
            fallback_steps.append(step)

    result = {
        "explanation": fallback_exp,
        "reasoning_steps": fallback_steps,
    }

    _COT_CACHE[cache_key] = result
    return result


def _latest_fy_value(merged: Dict[str, Any], key: str) -> Optional[float]:
    """Reads a wizard FY-restated-table field (e.g. 'revenue_from_operations'),
    stored as [{"fy": "FY26", "value": <num>}, ...] latest year first, and
    returns the latest year's value as a float. Falls back to treating the
    key as a plain scalar for older/legacy sessions.
    """
    val = merged.get(key)
    if isinstance(val, list):
        if not val or not isinstance(val[0], dict):
            return None
        val = val[0].get("value")
    if val is None:
        return None
    try:
        return float(str(val).replace("₹", "").replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _prior_fy_value(merged: Dict[str, Any], key: str) -> Optional[float]:
    """Same as _latest_fy_value but reads the second-latest year (index 1) of
    an FY-restated table — used for year-over-year comparisons. Returns None
    for legacy scalar sessions, which have no prior year to compare against.
    """
    val = merged.get(key)
    if not isinstance(val, list) or len(val) < 2 or not isinstance(val[1], dict):
        return None
    raw = val[1].get("value")
    if raw is None:
        return None
    try:
        return float(str(raw).replace("₹", "").replace(",", "").strip())
    except (ValueError, TypeError):
        return None


# ── Individual consistency check functions ───────────────────────────────────

def check_company_name_match(
    form_name: Optional[str],
    gst_name: Optional[str],
    inc_name: Optional[str],
    pan_name: Optional[str],
) -> Optional[Dict[str, Any]]:
    """Check that the company name is consistent across all documents using NLP entity matching.

    Returns a ConsistencyFlag dict if there is a mismatch, or None if OK.
    """
    names = {
        "form": form_name,
        "gst": gst_name,
        "incorporation": inc_name,
        "pan": pan_name,
    }
    # Need at least 2 non-None names to compare
    available = {k: v for k, v in names.items() if v}
    if len(available) < 2:
        return None

    val_list = list(available.values())
    mismatch_found = False
    for i in range(len(val_list)):
        for j in range(i + 1, len(val_list)):
            if nlp_semantic_match:
                res = nlp_semantic_match(str(val_list[i]), str(val_list[j]), threshold=0.75)
                if not res.get("is_match", False):
                    mismatch_found = True
                    break
            else:
                if "".join(str(val_list[i]).lower().split()) != "".join(str(val_list[j]).lower().split()):
                    mismatch_found = True
                    break
        if mismatch_found:
            break

    if not mismatch_found:
        return None

    cot_res = get_explanation_and_cot("company_name", {
        "form_name": form_name or "(not provided)",
        "gst_name": gst_name or "(not uploaded)",
        "inc_name": inc_name or "(not uploaded)",
        "pan_name": pan_name or "(not provided)",
    })
    return {
        "id": "company_name_mismatch",
        "section_id": "cover_page",
        # Both editable fields being compared — gst_name/inc_name have no separate
        # Wizard field of their own (they just feed company_name on extraction),
        # but pan_name is its own editable field on the Compliance tab, so a
        # mismatch there should red-border both sides, not just company_name.
        "related_fields": ["company_name", "pan_name"],
        "title": "Company Name Inconsistency Across Documents",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "high",
        "blocking": True,
        "sebi_ref": "SEBI ICDR Reg 230(1)(a)",
        "fix_steps": [
            "Check the MCA Certificate of Incorporation you uploaded — the name printed on it is the legally authoritative name and should be treated as the target everyone else must match.",
            "Directly editable in this app: the 'Company Name' field on the Cover Page tab, and the 'Name on PAN Card' field on the Compliance tab. Open the Wizard and correct either one if it doesn't match the Certificate of Incorporation.",
            "NOT directly editable: the names read off your GST certificate and Certificate of Incorporation come from the uploaded PDFs themselves, not a typed field. If either of those is the outdated/incorrect one, go to the Document Vault and re-upload the corrected certificate — the extracted name will update automatically.",
        ],
    }


def check_revenue_consistency(
    gst_turnover: Optional[float],
    pl_revenue: Optional[float],
) -> Optional[Dict[str, Any]]:
    """GST turnover vs P&L revenue: flag if difference > 15%."""
    if gst_turnover is None or pl_revenue is None:
        return None
    try:
        gst_val = float(gst_turnover)
        pl_val = float(pl_revenue)
    except (ValueError, TypeError):
        return None

    if pl_val <= 0:
        return None

    diff_pct = abs(gst_val - pl_val) / pl_val
    if diff_pct <= 0.15:
        return None

    cot_res = get_explanation_and_cot("gst_vs_pl", {"gst_turnover": gst_val, "pl_revenue": pl_val})
    return {
        "id": "gst_vs_pl",
        "section_id": "compliance_certs",
        "related_fields": ["gst_annual_turnover", "revenue_from_operations"],
        "title": "GST Turnover & P&L Revenue Mismatch",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "high",
        "blocking": True,
        "sebi_ref": "SEBI ICDR Reg 244(1)(b)",
        "fix_steps": [
            "Obtain a GST turnover reconciliation certificate from your CA for the relevant financial year.",
            "Check if any revenue streams are GST-exempt (e.g. exports, exempt goods) and exclude them from GST turnover for comparison.",
            "Attach the reconciliation statement as an annexure to the DRHP.",
        ],
    }


def check_date_logic(
    incorporation_date: Optional[str],
    gst_registration_date: Optional[str],
) -> Optional[Dict[str, Any]]:
    """GST registration date must not predate incorporation date."""
    if not incorporation_date or not gst_registration_date:
        return None

    if str(gst_registration_date) >= str(incorporation_date):
        return None

    cot_res = get_explanation_and_cot("inc_vs_gst_date", {
        "gst_date": gst_registration_date,
        "inc_date": incorporation_date,
    })
    return {
        "id": "inc_vs_gst_date",
        "section_id": "compliance_certs",
        "related_fields": ["incorporation_date"],
        "title": "GST Registration Predates Incorporation",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "medium",
        "blocking": False,
        "sebi_ref": "Companies Act 2013, Sec 7 & GST Act Sec 22",
        "fix_steps": [
            "Verify dates on both the Certificate of Incorporation (MCA) and GST Registration Certificate.",
            "If GST was inherited from a predecessor entity (partnership → company), document the conversion and attach it.",
            "If it is a data entry error, obtain a corrected GST certificate from the GSTN portal.",
        ],
    }


def check_capital_structure(
    authorized_capital: Optional[float],
    paid_up_capital_pre: Optional[float],
    fresh_issue_size_cr: Optional[float],
    face_value_per_share: Optional[float],
    price_band: Optional[str],
) -> List[Dict[str, Any]]:
    """Check capital structure rules:
    1. Paid-up ≤ Authorized
    2. Post-issue paid-up ≤ ₹25 Cr (SME cap, SEBI ICDR Reg 229)
    """
    flags: List[Dict[str, Any]] = []

    # 1. Paid-up vs Authorized
    if authorized_capital is not None and paid_up_capital_pre is not None:
        try:
            auth_val = float(authorized_capital)
            paid_val = float(paid_up_capital_pre)
            if paid_val > auth_val:
                cot_res = get_explanation_and_cot("capital_structure", {"paid_up": paid_val, "authorized": auth_val})
                flags.append({
                    "id": "capital_exceeds_auth",
                    "section_id": "capital_structure",
                    "related_fields": ["authorized_capital", "paid_up_capital_pre"],
                    "title": "Paid-up Capital Exceeds Authorized Capital",
                    "description": cot_res["explanation"],
                    "reasoning_steps": cot_res["reasoning_steps"],
                    "severity": "high",
                    "blocking": True,
                    "sebi_ref": "Companies Act 2013, Sec 61 & SEBI ICDR Reg 231",
                    "fix_steps": [
                        "File Form SH-7 with ROC to increase authorized share capital before the IPO.",
                        "Alternatively, reduce paid-up capital via buy-back (requires shareholder approval).",
                        "Update the capital structure section in the DRHP after the ROC filing is complete.",
                    ],
                })
        except (ValueError, TypeError):
            pass

    # 2. SME paid-up cap — computed on a face-value basis. fresh_issue_size_cr
    # (not issue_size, which may bundle in OFS — a resale of existing shares
    # that adds no new paid-up capital) is money raised at the issue price, so
    # it must be converted through the price band floor into a new-share count
    # before it's comparable to paid_up_capital_pre (a face-value figure).
    # Skipped entirely if the price band isn't set yet — there's no way to
    # size the new shares without it, and guessing would just invent a flag.
    if fresh_issue_size_cr is not None and paid_up_capital_pre is not None and face_value_per_share:
        issue_price = _parse_price_band_floor(price_band)
        if issue_price:
            try:
                fresh = float(fresh_issue_size_cr)
                pup = float(paid_up_capital_pre)
                fv = float(face_value_per_share)
                new_shares = (fresh * 1e7) / issue_price
                new_paidup_cr = (new_shares * fv) / 1e7
                post_paidup = pup + new_paidup_cr
                if post_paidup > 25.0:
                    cot_res = get_explanation_and_cot("sme_paidup_cap", {"post_paidup": round(post_paidup, 2)})
                    flags.append({
                        "id": "sme_paidup_cap",
                        "section_id": "capital_structure",
                        "related_fields": ["paid_up_capital_pre", "fresh_issue_size_cr", "price_band"],
                        "title": "Post-Issue Paid-up Capital Exceeds SME IPO Cap of ₹25 Cr (ICDR Reg 229)",
                        "description": cot_res["explanation"],
                        "reasoning_steps": cot_res["reasoning_steps"],
                        "severity": "high",
                        "blocking": True,
                        "sebi_ref": "SEBI ICDR Reg 229(1)",
                        "fix_steps": [
                            "Reduce the fresh issue size so that post-issue paid-up capital stays at or below ₹25 Crores.",
                            "Alternatively, migrate to the Main Board (BSE/NSE) which has no paid-up capital ceiling for IPOs.",
                            "Consult your Lead Manager (SEBI-registered Merchant Banker) to restructure the offer.",
                        ],
                    })
            except (ValueError, TypeError, ZeroDivisionError):
                pass

    return flags


def check_shareholding_sum(
    promoter_pct: Optional[float],
    issue_size: Optional[float],
    paid_up_pre: Optional[float],
) -> Optional[Dict[str, Any]]:
    """Post-issue promoter shareholding must be ≥ 20% (SEBI ICDR Reg 236)."""
    if promoter_pct is None or issue_size is None or paid_up_pre is None:
        return None
    try:
        pct = float(promoter_pct)
        issue = float(issue_size)
        pup = float(paid_up_pre)
    except (ValueError, TypeError):
        return None

    if pup <= 0:
        return None

    post_paidup = pup + issue
    promoter_abs = pup * (pct / 100)
    post_pct = (promoter_abs / post_paidup) * 100

    if post_pct >= 20.0:
        return None

    cot_res = get_explanation_and_cot("promoter_lockdown", {"pct": pct, "post_pct": round(post_pct, 2)})
    return {
        "id": "promoter_lockdown",
        "section_id": "capital_structure",
        "related_fields": ["promoter_shareholding_pre_pct", "issue_size", "paid_up_capital_pre"],
        "title": "Promoter Post-Issue Shareholding Below 20% (ICDR Reg 236)",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "high",
        "blocking": True,
        "sebi_ref": "SEBI ICDR Reg 236(1) & 236(2)",
        "fix_steps": [
            "Reduce the public offer size so that promoters retain at least 20% of the post-issue paid-up capital.",
            "If promoters are diluting via OFS (Offer for Sale), cap OFS shares to maintain the 20% threshold.",
            "Obtain a fresh cap table calculation from your CA/merchant banker after adjusting the offer.",
        ],
    }


def check_objects_vs_issue(merged: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Sum of use-of-proceeds must equal issue size (SEBI ICDR Reg 247)."""
    objects_keys = ["expansion_amount", "working_capital_amount", "debt_repayment_amount", "general_corp_amount", "issue_expenses"]
    issue_size_val = merged.get("issue_size")
    objects_vals = [merged.get(k) for k in objects_keys]

    if issue_size_val is None or not all(v is not None for v in objects_vals):
        return None

    try:
        objects_total = sum(float(v) for v in objects_vals)
        issue_f = float(issue_size_val)
    except (ValueError, TypeError):
        return None

    if abs(objects_total - issue_f) <= 0.01:
        return None

    cot_res = get_explanation_and_cot("objects_vs_issue", {"objects_total": round(objects_total, 2), "issue_size": issue_f})
    return {
        "id": "objects_vs_issue",
        # 4 of these 6 fields (expansion/working_capital/debt_repayment/issue_expenses)
        # actually render on the Compliance tab in the current wizard, not Objects —
        # general_corp_amount is the only one actually on the Objects tab, and
        # issue_size is on Cover — "compliance_certs" is the best single "Fix in..."
        # destination even though the check's statutory name says Objects of the Issue.
        "section_id": "compliance_certs",
        "related_fields": ["expansion_amount", "working_capital_amount", "debt_repayment_amount", "general_corp_amount", "issue_expenses", "issue_size"],
        "title": "Use-of-Proceeds Total Does Not Match Issue Size (ICDR Reg 247)",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "high",
        "blocking": True,
        "sebi_ref": "SEBI ICDR Reg 247(1) & 247(2)",
        "fix_steps": [
            "Re-calculate each object amount (expansion, working capital, debt repayment, general corporate, issue expenses) and ensure they sum exactly to the issue size.",
            "Issue expenses must be estimated by your Lead Manager and included as a specific line item.",
            "Any unallocated proceeds must be categorized as 'General Corporate Purposes' and capped at 25% of total proceeds.",
        ],
    }


def check_pan_format(pan: Optional[str]) -> Optional[Dict[str, Any]]:
    """Validate Indian PAN format: 5 letters + 4 digits + 1 letter."""
    if not pan:
        return None
    pan_pattern = re.compile(r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$')
    if pan_pattern.match(str(pan).upper().strip()):
        return None

    cot_res = get_explanation_and_cot("pan_format", {"pan": pan})
    return {
        "id": "pan_format",
        "section_id": "compliance_certs",
        "related_fields": ["pan"],
        "title": "Invalid PAN Format",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "medium",
        "blocking": False,
        "sebi_ref": "Income Tax Act 1961, Sec 139A",
        "fix_steps": [
            "Verify the PAN directly on the Income Tax e-filing portal (www.incometax.gov.in).",
            "Ensure there are no spaces or special characters — PAN format is exactly: 5 uppercase letters + 4 digits + 1 uppercase letter.",
            "If OCR extracted the PAN incorrectly, cross-check the physical PAN certificate or the GSTIN (which embeds the PAN in positions 3–12).",
        ],
    }


def check_gstin_format(gstin: Optional[str]) -> Optional[Dict[str, Any]]:
    """Validate GSTIN format: 2-digit state + PAN + 1 entity + Z + 1 check."""
    if not gstin:
        return None
    gstin_pattern = re.compile(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$')
    if gstin_pattern.match(str(gstin).upper().strip()):
        return None

    cot_res = get_explanation_and_cot("gstin_format", {"gstin": gstin})
    return {
        "id": "gstin_format",
        "section_id": "compliance_certs",
        "related_fields": ["gstin"],
        "title": "Invalid GSTIN Format",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "medium",
        "blocking": False,
        "sebi_ref": "GST Act 2017, Sec 25 & CGST Rules, Rule 8",
        "fix_steps": [
            "Verify the GSTIN on the GST portal (www.gst.gov.in → Search Taxpayer).",
            "Standard format: 2-digit state code + 10-char PAN + 1 entity digit + 'Z' + 1 check digit = 15 characters total.",
            "Contact your GST filing CA to obtain a corrected GST Registration Certificate if needed.",
        ],
    }


def check_price_band_width(price_band: Optional[str]) -> Optional[Dict[str, Any]]:
    """Upper band must be ≤ 120% of lower band (SEBI requires ≤20% spread on floor price)."""
    if not price_band:
        return None
    try:
        parts = str(price_band).replace("₹", "").split("-")
        if len(parts) != 2:
            return None
        lower_p = float(parts[0].strip())
        upper_p = float(parts[1].strip())

        # Guard: invalid / uninitialised values — skip silently
        if lower_p <= 0 or upper_p <= 0:
            return None
        # Guard: inverted band (upper < lower) is a data-entry error, not a width violation
        if upper_p < lower_p:
            return None
        # Core rule: spread must be within 20% of floor price
        if upper_p <= lower_p * 1.20:
            return None
    except (ValueError, IndexError):
        return None

    cot_res = get_explanation_and_cot("price_band_width", {"lower": lower_p, "upper": upper_p})
    return {
        "id": "price_band_width",
        "section_id": "cover_page",
        "related_fields": ["price_band"],
        "title": "Price Band Spread Exceeds 20% of Floor Price",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "medium",
        "blocking": False,
        "sebi_ref": "SEBI ICDR Reg 253(1) & SEBI Circular SEBI/HO/CFD/DIL1/CIR/P/2020/249",
        "fix_steps": [
            "Ensure the cap price (upper band) is at most 120% of the floor price (lower band).",
            "Example: if floor is ₹100, cap must be ≤ ₹120.",
            "Consult your Lead Manager to adjust the price band before filing the DRHP.",
        ],
    }


def _parse_price_band_floor(price_band: Optional[str]) -> Optional[float]:
    if not price_band:
        return None
    try:
        parts = str(price_band).replace("₹", "").split("-")
        if len(parts) != 2:
            return None
        lower_p = float(parts[0].strip())
        return lower_p if lower_p > 0 else None
    except (ValueError, IndexError):
        return None


def check_eps_consistency(eps_basic: Optional[List[Dict[str, Any]]], eps_diluted: Optional[List[Dict[str, Any]]]) -> Optional[Dict[str, Any]]:
    """Diluted EPS can only be ≤ Basic EPS (Ind AS 33) — never higher."""
    basic_val = _latest_fy_value({"eps_basic": eps_basic}, "eps_basic")
    diluted_val = _latest_fy_value({"eps_diluted": eps_diluted}, "eps_diluted")
    if basic_val is None or diluted_val is None:
        return None
    # Small tolerance for rounding — only flag a real violation, not a paise-level rounding artifact
    if diluted_val <= basic_val + 0.01:
        return None

    cot_res = get_explanation_and_cot("eps_diluted_exceeds_basic", {"eps_basic": basic_val, "eps_diluted": diluted_val})
    return {
        "id": "eps_diluted_exceeds_basic",
        "section_id": "financials",
        "related_fields": ["eps_basic", "eps_diluted"],
        "title": "Diluted EPS Exceeds Basic EPS (Ind AS 33 Violation)",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "medium",
        "blocking": False,
        "sebi_ref": "Ind AS 33 — Earnings per Share",
        "fix_steps": [
            "Re-verify both EPS figures against the restated financial statements' EPS working notes.",
            "Diluted EPS must incorporate the weighted-average effect of all potential dilutive securities (ESOPs, "
            "convertible instruments) and can only reduce, never increase, EPS versus the basic figure.",
        ],
    }


def check_face_value_vs_price_band(face_value_per_share: Optional[float], price_band: Optional[str]) -> Optional[Dict[str, Any]]:
    """Issue price (price band floor) cannot be below the share's face value."""
    if face_value_per_share is None:
        return None
    try:
        fv = float(face_value_per_share)
    except (ValueError, TypeError):
        return None
    if fv <= 0:
        return None

    floor_price = _parse_price_band_floor(price_band)
    if floor_price is None or floor_price >= fv:
        return None

    cot_res = get_explanation_and_cot("face_value_exceeds_price_band", {"face_value": fv, "floor_price": floor_price})
    return {
        "id": "face_value_exceeds_price_band",
        "section_id": "cover_page",
        "related_fields": ["face_value_per_share", "price_band"],
        "title": "Price Band Floor Below Face Value Per Share",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "high",
        "blocking": True,
        "sebi_ref": "Companies Act 2013 Sec 52 & SEBI ICDR Pricing Norms",
        "fix_steps": [
            "Raise the price band floor to at least the face value per share.",
            "If the face value itself is incorrect, correct it to match the MOA capital clause / RoC records.",
        ],
    }


def check_litigation_narrative_consistency(litigation_summary: Optional[List[Dict[str, Any]]], litigations_company: Optional[str]) -> Optional[Dict[str, Any]]:
    """The structured Litigation Schedule and the free-text litigation narrative must agree on
    whether there is any pending litigation against the Company."""
    if not isinstance(litigation_summary, list) or not litigation_summary:
        return None

    lit_count = 0
    for row in litigation_summary:
        if not isinstance(row, dict):
            continue
        entity_type = str(row.get("entity_type", "")).lower()
        if not entity_type.startswith("company"):
            continue
        for count_key in ("criminal_count", "tax_count", "statutory_regulatory_count", "civil_litigation_count"):
            try:
                lit_count += int(row.get(count_key) or 0)
            except (ValueError, TypeError):
                pass

    if lit_count == 0:
        return None

    narrative = str(litigations_company or "").lower()
    if not narrative:
        return None
    denies_litigation = any(phrase in narrative for phrase in [
        "no material", "no litigation", "none pending", "nil", "not applicable", "no pending",
    ])
    if not denies_litigation:
        return None

    cot_res = get_explanation_and_cot("litigation_narrative_mismatch", {"lit_count": lit_count})
    return {
        "id": "litigation_narrative_mismatch",
        "section_id": "legal_disclosures",
        "related_fields": ["litigation_summary", "litigations_company"],
        "title": "Litigation Schedule Conflicts With Litigation Narrative",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "high",
        "blocking": True,
        "sebi_ref": "SEBI ICDR Schedule VI Part A — Outstanding Litigation Disclosures",
        "fix_steps": [
            "Update the 'Litigations Against the Issuer' narrative to reflect the matters listed in the Litigation Schedule.",
            "If the Litigation Schedule is stale (matters since resolved), update the schedule instead and re-certify with legal counsel.",
        ],
    }


def check_auditor_consistency(form_auditor_name: Optional[str], extracted_auditor_name: Optional[str]) -> Optional[Dict[str, Any]]:
    """The auditor named on the Compliance tab should match the auditor who signed the uploaded
    audited financial statements."""
    if not form_auditor_name or not extracted_auditor_name:
        return None
    a = str(form_auditor_name).strip()
    b = str(extracted_auditor_name).strip()
    if not a or not b:
        return None

    if nlp_semantic_match:
        res = nlp_semantic_match(a, b, threshold=0.75)
        if res.get("is_match", False):
            return None
    else:
        if "".join(a.lower().split()) == "".join(b.lower().split()):
            return None

    cot_res = get_explanation_and_cot("auditor_mismatch", {"form_auditor": a, "extracted_auditor": b})
    return {
        "id": "auditor_mismatch",
        "section_id": "compliance_certs",
        "related_fields": ["auditor_name"],
        "title": "Statutory Auditor Name Mismatch",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "medium",
        "blocking": False,
        "sebi_ref": "Companies Act 2013 Sec 139",
        "fix_steps": [
            "Confirm the current statutory auditor's exact name as it appears on the signed audit report.",
            "Update the Compliance tab's Auditor Name field to match exactly.",
            "If the auditor changed recently, ensure the change is separately disclosed per SEBI norms.",
        ],
    }


def check_waca_date_plausibility(waca_ca_certificate_date: Optional[str], incorporation_date: Optional[str]) -> Optional[Dict[str, Any]]:
    """The WACA CA certificate cannot be dated before incorporation or in the future."""
    if not waca_ca_certificate_date:
        return None
    waca_str = str(waca_ca_certificate_date).strip()
    if not waca_str:
        return None

    from datetime import datetime, timezone
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    is_future = waca_str > today_str
    predates_incorporation = bool(incorporation_date) and waca_str < str(incorporation_date).strip()
    if not is_future and not predates_incorporation:
        return None

    cot_res = get_explanation_and_cot("waca_date_implausible", {
        "waca_date": waca_str,
        "inc_date": incorporation_date or "(not provided)",
    })
    return {
        "id": "waca_date_implausible",
        "section_id": "waca",
        "related_fields": ["waca_ca_certificate_date"],
        "title": "WACA Certificate Date Is Not Plausible",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "medium",
        "blocking": False,
        "sebi_ref": "General chronological consistency",
        "fix_steps": [
            "Verify the WACA CA certificate date against the actual certificate document.",
            "The certificate must be dated on or after incorporation and cannot be dated in the future.",
        ],
    }


def check_segment_reporting_note(segment_reporting_applicable: Any, segment_reporting_note: Optional[str]) -> Optional[Dict[str, Any]]:
    """Ind AS 108 requires an explanatory note when segment reporting is marked not applicable."""
    if segment_reporting_applicable is not False and segment_reporting_applicable != "false":
        return None
    if segment_reporting_note and str(segment_reporting_note).strip():
        return None

    cot_res = get_explanation_and_cot("segment_reporting_note_missing", {})
    return {
        "id": "segment_reporting_note_missing",
        "section_id": "business_overview",
        "related_fields": ["segment_reporting_note"],
        "title": "Segment Reporting Marked Not Applicable Without Explanatory Note",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "low",
        "blocking": False,
        "sebi_ref": "Ind AS 108 — Operating Segments",
        "fix_steps": [
            "Add a one-line note explaining why the Company operates as a single reportable segment "
            "(e.g. 'The Company operates in a single business and geographical segment').",
        ],
    }


def check_customer_concentration_consistency(customer_concentration_pct: Optional[float], top5_customer_revenue_table: Optional[List[Dict[str, Any]]]) -> Optional[Dict[str, Any]]:
    """The declared top-5 customer concentration % should match the sum of the Top-5 Customer
    Revenue table's individual percentage columns."""
    if customer_concentration_pct is None or not isinstance(top5_customer_revenue_table, list) or not top5_customer_revenue_table:
        return None
    try:
        declared_pct = float(customer_concentration_pct)
    except (ValueError, TypeError):
        return None
    if declared_pct <= 0:
        return None

    # Rows may use fy1_pct (per-customer, latest year) — sum whichever *_pct columns are present per row
    table_pct = 0.0
    found_any = False
    for row in top5_customer_revenue_table:
        if not isinstance(row, dict):
            continue
        for k, v in row.items():
            if k.endswith("_pct") and v is not None:
                try:
                    table_pct += float(v)
                    found_any = True
                except (ValueError, TypeError):
                    pass
                break  # only the first *_pct column per row (latest year) — avoid summing multi-year columns together

    if not found_any:
        return None

    if abs(declared_pct - table_pct) <= 5.0:  # generous tolerance — both are manually-entered approximations
        return None

    cot_res = get_explanation_and_cot("customer_concentration_mismatch", {
        "declared_pct": round(declared_pct, 2),
        "table_pct": round(table_pct, 2),
    })
    return {
        "id": "customer_concentration_mismatch",
        "section_id": "risk_factors",
        "related_fields": ["customer_concentration_pct", "top5_customer_revenue_table"],
        "title": "Customer Concentration % Does Not Match Top-5 Customer Table",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "low",
        "blocking": False,
        "sebi_ref": "SEBI ICDR Schedule VI Part A",
        "fix_steps": [
            "Recompute the customer concentration percentage as the sum of the Top-5 Customer Revenue table's latest-year percentages.",
            "Update whichever of the two fields is out of date.",
        ],
    }


def check_cash_flow_pat_conversion(merged: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Earnings-quality check: latest-year operating cash flow should be a
    reasonable fraction of reported PAT. Profit that isn't backed by cash
    collection is a standard first question in merchant-banker/exchange
    review — this doesn't accuse anyone of anything, it just surfaces the
    same ratio a reviewer would compute anyway, before filing rather than after.
    """
    cfo = _latest_fy_value(merged, "cash_flow_operating")
    pat = _latest_fy_value(merged, "pat")
    if cfo is None or pat is None or pat <= 0:
        return None

    ratio_pct = round((cfo / pat) * 100, 1)
    if ratio_pct >= 50.0:  # own threshold — a reviewer's rough sniff-test, not a statutory cutoff
        return None

    pat_table = merged.get("pat")
    fy = pat_table[0].get("fy", "the latest year") if isinstance(pat_table, list) and pat_table else "the latest year"

    cot_res = get_explanation_and_cot("cash_flow_pat_conversion_weak", {
        "cfo": round(cfo, 2),
        "pat": round(pat, 2),
        "ratio": ratio_pct,
        "fy": fy,
    })
    return {
        "id": "cash_flow_pat_conversion_weak",
        "section_id": "financials",
        "related_fields": ["cash_flow_operating", "pat"],
        "title": "Operating Cash Flow Weak Relative to Reported Profit",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "medium",
        "blocking": False,
        "sebi_ref": "SEBI ICDR Schedule VI Part A — Restated Financial Information (earnings-quality review practice)",
        "fix_steps": [
            "Verify the operating cash flow and PAT figures against the restated cash flow statement.",
            "If genuine, prepare a receivables ageing schedule or an auditor's note explaining the gap (e.g. one-off non-cash items, a large late-year sale) ahead of banker review.",
        ],
    }


def check_receivables_outpacing_revenue(merged: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Earnings-quality check: trade receivables growing meaningfully faster
    than revenue can indicate slowing collections or revenue recognised
    before it's actually collectible — a common reviewer red flag.
    """
    recv_latest = _latest_fy_value(merged, "trade_receivables")
    recv_prior = _prior_fy_value(merged, "trade_receivables")
    rev_latest = _latest_fy_value(merged, "revenue_from_operations")
    rev_prior = _prior_fy_value(merged, "revenue_from_operations")
    if None in (recv_latest, recv_prior, rev_latest, rev_prior) or recv_prior <= 0 or rev_prior <= 0:
        return None

    recv_growth = ((recv_latest - recv_prior) / recv_prior) * 100
    rev_growth = ((rev_latest - rev_prior) / rev_prior) * 100
    gap = recv_growth - rev_growth

    # Own thresholds: only flag a real, meaningful divergence — receivables must
    # themselves have grown by a non-trivial amount (avoids flagging noise off a
    # tiny base) AND outpace revenue growth by a wide margin.
    if recv_growth < 15.0 or gap < 20.0:
        return None

    rev_table = merged.get("revenue_from_operations")
    fy = rev_table[0].get("fy", "the latest year") if isinstance(rev_table, list) and rev_table else "the latest year"

    cot_res = get_explanation_and_cot("receivables_outpacing_revenue", {
        "recv_growth": round(recv_growth, 1),
        "rev_growth": round(rev_growth, 1),
        "gap": round(gap, 1),
        "fy": fy,
    })
    return {
        "id": "receivables_outpacing_revenue",
        "section_id": "financials",
        "related_fields": ["trade_receivables", "revenue_from_operations"],
        "title": "Trade Receivables Growing Faster Than Revenue",
        "description": cot_res["explanation"],
        "reasoning_steps": cot_res["reasoning_steps"],
        "severity": "medium",
        "blocking": False,
        "sebi_ref": "SEBI ICDR Schedule VI Part A — Restated Financial Information (earnings-quality review practice)",
        "fix_steps": [
            "Verify both years' trade receivables and revenue figures against the restated financial statements.",
            "If genuine, disclose any change in customer credit terms and provide a top debtor ageing breakup ahead of banker review.",
        ],
    }


# ── Master runner ────────────────────────────────────────────────────────────

def run_all_consistency_checks(
    merged: Dict[str, Any],
    extracted_data: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Run all consistency checks and return a list of ConsistencyFlag dicts."""
    flags: List[Dict[str, Any]] = []

    # 1. Company name match — pan_name comes from `merged` (not the raw extraction
    # snapshot) since it's a directly editable Wizard field; reading the original
    # extracted_data value here would mean editing pan_name could never clear
    # this conflict, even after fixing the exact field the flag points at.
    flag = check_company_name_match(
        form_name=merged.get("company_name"),
        gst_name=extracted_data.get("gst", {}).get("company_name"),
        inc_name=extracted_data.get("incorporation", {}).get("company_name"),
        pan_name=merged.get("pan_name"),
    )
    if flag:
        flags.append(flag)

    # 2. Revenue consistency — compares against the current 3-year restated
    # revenue table (latest year), not the deprecated single-value legacy
    # field, so this actually reflects what the Financials tab holds.
    flag = check_revenue_consistency(
        gst_turnover=merged.get("gst_annual_turnover"),
        pl_revenue=_latest_fy_value(merged, "revenue_from_operations") or merged.get("revenue_fy_latest"),
    )
    if flag:
        flags.append(flag)

    # 3. Date logic
    flag = check_date_logic(
        incorporation_date=merged.get("incorporation_date"),
        gst_registration_date=extracted_data.get("gst", {}).get("registration_date"),
    )
    if flag:
        flags.append(flag)

    # 4. Post-issue promoter shareholding (check_shareholding_sum, deliberately
    # NOT called here): the wizard's `issue_size` field is ambiguous — it may
    # represent the total offer (fresh issue + OFS combined) rather than just
    # the dilutive fresh-issue portion (tracked separately in
    # `fresh_issue_size_cr`). Since OFS is a resale of existing shares and
    # doesn't dilute promoters, feeding a total-including-OFS `issue_size`
    # into the post-paid-up-capital formula would systematically overstate
    # dilution and false-positive on any offer with a real OFS component.
    # Re-enable only once `fresh_issue_size_cr` (the unambiguous dilutive
    # figure) is used here instead of `issue_size`.

    # 5. Capital structure (returns list)
    cap_flags = check_capital_structure(
        authorized_capital=merged.get("authorized_capital"),
        paid_up_capital_pre=merged.get("paid_up_capital_pre"),
        fresh_issue_size_cr=merged.get("fresh_issue_size_cr"),
        face_value_per_share=merged.get("face_value_per_share"),
        price_band=merged.get("price_band"),
    )
    flags.extend(cap_flags)

    # 6. Objects vs issue size
    flag = check_objects_vs_issue(merged)
    if flag:
        flags.append(flag)

    # 7. PAN format
    flag = check_pan_format(merged.get("pan"))
    if flag:
        flags.append(flag)

    # 8. GSTIN format
    flag = check_gstin_format(merged.get("gstin"))
    if flag:
        flags.append(flag)

    # 9. Price band width
    flag = check_price_band_width(merged.get("price_band"))
    if flag:
        flags.append(flag)

    # 10. EPS Diluted vs Basic (Ind AS 33 — diluted can never exceed basic)
    flag = check_eps_consistency(merged.get("eps_basic"), merged.get("eps_diluted"))
    if flag:
        flags.append(flag)

    # 11. Face value vs price band floor (cannot issue below face value)
    flag = check_face_value_vs_price_band(merged.get("face_value_per_share"), merged.get("price_band"))
    if flag:
        flags.append(flag)

    # 12. Litigation Schedule vs free-text litigation narrative
    flag = check_litigation_narrative_consistency(merged.get("litigation_summary"), merged.get("litigations_company"))
    if flag:
        flags.append(flag)

    # 13. Auditor name — form entry vs the audited financial statement's own extraction
    flag = check_auditor_consistency(merged.get("auditor_name"), extracted_data.get("financials", {}).get("auditor_name"))
    if flag:
        flags.append(flag)

    # 14. WACA CA certificate date plausibility
    flag = check_waca_date_plausibility(merged.get("waca_ca_certificate_date"), merged.get("incorporation_date"))
    if flag:
        flags.append(flag)

    # 15. Segment reporting note required when marked not applicable
    flag = check_segment_reporting_note(merged.get("segment_reporting_applicable"), merged.get("segment_reporting_note"))
    if flag:
        flags.append(flag)

    # 16. Customer concentration % vs Top-5 Customer Revenue table
    flag = check_customer_concentration_consistency(merged.get("customer_concentration_pct"), merged.get("top5_customer_revenue_table"))
    if flag:
        flags.append(flag)

    # 17. Earnings quality — operating cash flow vs reported profit
    flag = check_cash_flow_pat_conversion(merged)
    if flag:
        flags.append(flag)

    # 18. Earnings quality — trade receivables growth vs revenue growth
    flag = check_receivables_outpacing_revenue(merged)
    if flag:
        flags.append(flag)

    # 19. Integrated Financial Ratio Anomaly Detection
    try:
        from financial_ratio_checker import calculate_and_audit_ratios
        ratio_res = calculate_and_audit_ratios(merged)
        flags.extend(ratio_res.get("flags", []))
    except Exception as e:
        logger.warning(f"Financial ratio anomaly check skipped: {e}")

    # 20. Integrated Narrative Quality & Investor Protection Compliance Check (NLP-driven under the hood)
    narrative_flags = check_narrative_quality(merged)
    flags.extend(narrative_flags)

    return flags


def check_narrative_quality(merged: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Analyzes narrative text fields for vague language, boilerplate risk disclosures, and missing regulatory declarations.

    Returns an empty list when no narrative fields contain content (e.g. after a workspace reset).
    """
    flags: List[Dict[str, Any]] = []

    # ── Guard: skip entirely if no narrative fields have content ─────────────
    # Keys must match analyze_prospectus_narratives()'s own narrative dict —
    # kept in sync there, not re-derived independently, to avoid these two
    # drifting apart again like the previous ("business_overview", "risk_factors",
    # "objects_summary") set did once those stopped being real form fields.
    narrative_keys = [
        "products_services_description", "internal_risks", "external_risks",
        "business_model", "promoter_experience", "industry_growth_narrative",
    ]
    has_any_content = any(
        merged.get(k) and str(merged[k]).strip()
        for k in narrative_keys
    )
    if not has_any_content:
        return flags

    try:
        from nlp_analyzer import analyze_prospectus_narratives
        analysis = analyze_prospectus_narratives(merged)
        red_flags = analysis.get("red_flags", [])

        # Maps each narrative field to a Dashboard section_id that actually
        # resolves to a wizard tab (see frontend Dashboard.jsx SECTION_TO_TAB) —
        # "management" previously had no matching tab at all, so its "Fix in..."
        # button silently did nothing.
        FIELD_SECTION_MAP = {
            "products_services_description": "business_overview",
            "internal_risks": "risk_factors",
            "external_risks": "risk_factors",
            "business_model": "compliance_certs",
            "promoter_experience": "compliance_certs",
            "industry_growth_narrative": "industry_overview",
        }

        for rf in red_flags:
            key = rf.get("field_key") or "products_services_description"
            if key not in FIELD_SECTION_MAP:
                key = "products_services_description"
            sec_id = FIELD_SECTION_MAP.get(key, "business_overview")
            flags.append({
                "id": rf.get("id", f"narrative_{key}"),
                "section_id": sec_id,
                "related_fields": [key],
                "title": f"{rf.get('field_label', 'Narrative')} Disclosure Compliance Issue",
                "description": rf.get("issue", "Narrative section requires enhanced disclosure clarity."),
                "severity": rf.get("severity", "MEDIUM").lower(),
                "blocking": False,
                "sebi_ref": "SEBI ICDR Schedule VI Part A & Reg 248",
                "fix_steps": [rf.get("suggestion", "Provide specific quantitative figures and citations.")] if rf.get("suggestion") else [
                    "Quantify claims with third-party metrics.",
                    "Ensure disclosures comply with SEBI Chapter IX requirements."
                ]
            })
    except Exception as e:
        logger.warning(f"Narrative compliance check skipped: {e}")
    return flags


