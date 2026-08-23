import logging
from typing import Dict, Any

from consistency_checker import run_all_consistency_checks

# Configure logger
logger = logging.getLogger("sebi-ipo-generator.validator")


def _is_empty_value(val: Any) -> bool:
    """True if a session value should be treated as not-yet-filled.

    Boolean False is a valid value (e.g. declaration_signed=False), so it is
    never empty. list/dict values (the new list/table field types) are empty
    only when they contain zero items — str(val) on a non-empty list is never
    an empty string, so the old plain string-strip check silently treated
    e.g. [] as "present".
    """
    if val is None:
        return True
    if isinstance(val, bool):
        return False
    if isinstance(val, (list, dict)):
        return len(val) == 0
    return str(val).strip() == ""


def validate_session_data(session: Dict[str, Any], schema: Dict[str, Any]) -> Dict[str, Any]:
    """Runs deterministic validation against schema.json and consistency checks.

    Returns a response with dual scores:
    - filing_readiness: blocking-field completion %, capped at 80 when blocking consistency flags exist
    - overall_completeness: all required fields completion %
    """
    form_data = session.get("form_data", {})
    extracted_data = session.get("extracted_data", {})

    # Merge all data sources — form_data takes priority over extracted data
    merged = {}
    # 1. Start with extracted data from files (lower priority)
    for doc_type, data in extracted_data.items():
        if isinstance(data, dict):
            merged.update(data)
    # 2. Override with form data (user manual entries take priority)
    merged.update(form_data)

    # ── Run financial ratio audit ──
    try:
        from financial_ratio_checker import calculate_and_audit_ratios
        ratio_audit = calculate_and_audit_ratios(merged)
        ratio_ratios = ratio_audit.get("calculated_ratios", {})
        ratio_flags = ratio_audit.get("flags", [])
    except Exception as e:
        logger.warning(f"Financial ratio audit failed: {e}")
        ratio_ratios = {}
        ratio_flags = []

    # ── Calculate dynamic Cap Table metrics ──
    def _parse_float(val):
        if val is None:
            return None
        try:
            return float(str(val).replace("₹", "").replace(",", "").strip())
        except (ValueError, TypeError):
            return None

    raw_pre_capital = _parse_float(merged.get("paid_up_capital_pre") or merged.get("pre_issue_paidup") or merged.get("paid_up_capital"))
    raw_promoter_pct = _parse_float(merged.get("promoter_shareholding_pre_pct") or merged.get("promoter_pct") or merged.get("promoter_shareholding"))
    raw_issue_size = _parse_float(merged.get("issue_size") or merged.get("fresh_issue_size"))

    has_capital_data = (raw_pre_capital is not None and raw_pre_capital > 0) or (raw_promoter_pct is not None and raw_promoter_pct > 0) or (raw_issue_size is not None and raw_issue_size > 0)
    capital_metrics = {
        "has_capital_data": has_capital_data,
        "pre_paid_up": raw_pre_capital if raw_pre_capital is not None else 0.0,
        "promoter_pct_pre": raw_promoter_pct if raw_promoter_pct is not None else 0.0,
        "issue_size": raw_issue_size if raw_issue_size is not None else 0.0,
    }

    # ── Run consistency checks via dedicated module ──────────────────────────
    consistency_flags = run_all_consistency_checks(merged, extracted_data)
    consistency_flags.extend(ratio_flags)

    # ── Declaration signed while blocking fields are still incomplete ────────
    # Needs the full missing-blocking-fields picture, which only exists here
    # (schema-driven), not inside consistency_checker.py — computed before the
    # section loop below so this flag flows through the same per-section
    # status/risk-score mechanism as every other consistency flag.
    if merged.get("declaration_signed") is True:
        missing_blocking_labels = []
        for sec in schema.get("sections", []):
            for field in sec.get("fields", []):
                if field.get("required") and field.get("blocking") and field["key"] != "declaration_signed":
                    if _is_empty_value(merged.get(field["key"])):
                        missing_blocking_labels.append(field["label"])
        if missing_blocking_labels:
            consistency_flags.append({
                "id": "declaration_signed_prematurely",
                "section_id": "declaration",
                "related_fields": ["declaration_signed"],
                "title": "Declaration Signed While Required Disclosures Are Incomplete",
                "description": (
                    f"The compliance declaration has been marked as signed, but {len(missing_blocking_labels)} "
                    f"blocking required field(s) are still missing (e.g. '{missing_blocking_labels[0]}'"
                    + (f" and {len(missing_blocking_labels) - 1} more" if len(missing_blocking_labels) > 1 else "")
                    + "). A declaration of completeness cannot be truthfully signed while material disclosures are outstanding."
                ),
                "reasoning_steps": [
                    f"1. Declaration Signed = True, but {len(missing_blocking_labels)} blocking required field(s) remain empty.",
                    "2. Statutory Rule (SEBI ICDR Reg 57 & Schedule VI — Declaration): The declaration affirms the "
                    "prospectus contains all material disclosures required by the Act and ICDR Regulations.",
                    "3. Evaluated Completeness: Blocking fields are still missing, so the affirmation is not yet accurate.",
                    "4. Therefore: Un-sign the declaration until all blocking disclosures are complete, then re-sign.",
                ],
                "severity": "high",
                "blocking": True,
                "sebi_ref": "SEBI ICDR Schedule VI Part A — Declaration",
                "fix_steps": [
                    "Complete all remaining blocking required fields shown across the wizard tabs.",
                    "Only re-check the declaration once every blocking disclosure is genuinely complete.",
                ],
            })

    # ── Completeness checks for each schema section ─────────────────────────
    sections_results = []
    total_fields = 0
    completed_fields = 0
    total_blocking_fields = 0
    completed_blocking_fields = 0

    for sec in schema.get("sections", []):
        sec_id = sec["id"]
        sec_name = sec["name"]
        sec_fields = sec.get("fields", [])

        missing = []
        present = []

        for field in sec_fields:
            key = field["key"]
            label = field["label"]
            req = field.get("required", False)
            is_blocking = field.get("blocking", False)

            if req:
                total_fields += 1
                if is_blocking:
                    total_blocking_fields += 1

                val = merged.get(key)
                if _is_empty_value(val):
                    missing.append(label)
                else:
                    present.append(label)
                    completed_fields += 1
                    if is_blocking:
                        completed_blocking_fields += 1
            else:
                # Optional field
                val = merged.get(key)
                if not _is_empty_value(val):
                    present.append(label)

        # Determine section status
        sec_inconsistencies = [flag for flag in consistency_flags if flag["section_id"] == sec_id]

        if sec_inconsistencies:
            status = "inconsistent"
        elif len(missing) == 0:
            status = "complete"
        else:
            status = "incomplete"

        # ── Compute Section AI Risk Score (1–10 scale) ─────────────────────
        total_sec_req = len(present) + len(missing)
        sec_comp_pct = (len(present) / total_sec_req * 100) if total_sec_req > 0 else 100

        high_flags_count = sum(1 for f in sec_inconsistencies if f.get("severity") in ("high", "HIGH") or f.get("blocking"))
        med_flags_count = len(sec_inconsistencies) - high_flags_count

        # Risk Score Formula (1-10 scale):
        raw_risk = (10 - (sec_comp_pct / 15.0)) + (high_flags_count * 4.0) + (med_flags_count * 2.5) + (len(missing) * 1.5)
        risk_score = max(1, min(10, int(round(raw_risk))))

        if risk_score <= 3:
            risk_level = "low"
            risk_explanation = f"Low Risk ({risk_score}/10): Section disclosures comply with SEBI ICDR requirements."
        elif risk_score <= 6:
            risk_level = "medium"
            if sec_inconsistencies:
                risk_explanation = f"Moderate Risk ({risk_score}/10): Flagged for compliance review ({sec_inconsistencies[0].get('title', 'Conflict')})."
            else:
                risk_explanation = f"Moderate Risk ({risk_score}/10): {len(missing)} required fields incomplete."
        else:
            risk_level = "high"
            if sec_inconsistencies:
                risk_explanation = f"High Risk ({risk_score}/10): Active statutory conflict ({sec_inconsistencies[0].get('title', 'Critical Conflict')})."
            else:
                risk_explanation = f"High Risk ({risk_score}/10): Critical statutory disclosures missing."

        sections_results.append({
            "section_id": sec_id,
            "section_name": sec_name,
            "description": sec.get("description", ""),
            "status": status,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "risk_explanation": risk_explanation,
            "missing_fields": missing,
            "present_fields": present,
            "inconsistencies": sec_inconsistencies,
        })

    # ── Compute dual scores ─────────────────────────────────────────────────
    overall_completeness = 0
    if total_fields > 0:
        overall_completeness = int((completed_fields / total_fields) * 100)

    filing_readiness = 0
    if total_blocking_fields > 0:
        filing_readiness = int((completed_blocking_fields / total_blocking_fields) * 100)

    # Cap filing_readiness when consistency flags are active:
    # - Blocking conflicts cap readiness at 75%
    # - Non-blocking conflicts (e.g. medium severity statutory/narrative checks) cap readiness at 85%
    # - Readiness can ONLY reach 100% when zero conflicts exist.
    has_blocking_flag = any(f.get("blocking", False) for f in consistency_flags)
    has_any_flag = len(consistency_flags) > 0

    if has_blocking_flag:
        if filing_readiness > 75:
            filing_readiness = 75
    elif has_any_flag:
        if filing_readiness > 85:
            filing_readiness = 85

    # Portfolio Risk Score (weighted average across sections)
    portfolio_risk_score = max(1, min(10, int(round(sum(s["risk_score"] for s in sections_results) / len(sections_results))))) if sections_results else 1

    # Status counts
    status_counts = {
        "complete": sum(1 for s in sections_results if s["status"] == "complete"),
        "incomplete": sum(1 for s in sections_results if s["status"] == "incomplete"),
        "inconsistent": sum(1 for s in sections_results if s["status"] == "inconsistent"),
    }

    return {
        # Primary metric (blocking fields only, capped when conflicts exist)
        "filing_readiness": filing_readiness,
        # Secondary metric (all required fields)
        "overall_completeness": overall_completeness,
        # Portfolio AI Risk Score (1-10)
        "portfolio_risk_score": portfolio_risk_score,
        # Backward compat: readiness_score mirrors filing_readiness
        "readiness_score": filing_readiness,
        "sections": sections_results,
        # consistency_flags replaces old inconsistencies — kept as alias too
        "consistency_flags": consistency_flags,
        "inconsistencies": consistency_flags,
        "status_counts": status_counts,
        "completed_fields": completed_fields,
        "total_fields": total_fields,
        "completed_blocking_fields": completed_blocking_fields,
        "total_blocking_fields": total_blocking_fields,
        "has_blocking_flags": has_blocking_flag,
        "calculated_ratios": ratio_ratios,
        "capital_metrics": capital_metrics,
    }
