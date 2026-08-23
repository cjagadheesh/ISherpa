import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("sebi-ipo-generator.financial_ratio_checker")

# ── Industry Sector Benchmarks for SME IPO Issuers ──────────────────────────────
SECTOR_BENCHMARKS = {
    "manufacturing": {
        "label": "SME Manufacturing & Engineering",
        "pat_margin_normal": (5.0, 18.0),
        "pat_margin_max": 35.0,
        "ebitda_margin_normal": (10.0, 22.0),
        "ebitda_margin_max": 45.0,
        "de_ratio_normal": (0.2, 2.0),
        "de_ratio_max": 3.0,
        "pe_ratio_normal": (12.0, 30.0),
        "pe_ratio_max": 50.0,
        "roe_normal": (10.0, 30.0),
        "roe_max": 60.0,
    },
    "trading": {
        "label": "SME Wholesale & Trading",
        "pat_margin_normal": (2.0, 10.0),
        "pat_margin_max": 20.0,
        "ebitda_margin_normal": (4.0, 14.0),
        "ebitda_margin_max": 28.0,
        "de_ratio_normal": (0.3, 2.5),
        "de_ratio_max": 3.5,
        "pe_ratio_normal": (10.0, 25.0),
        "pe_ratio_max": 40.0,
        "roe_normal": (8.0, 25.0),
        "roe_max": 50.0,
    },
    "services": {
        "label": "SME IT & Business Services",
        "pat_margin_normal": (10.0, 25.0),
        "pat_margin_max": 40.0,
        "ebitda_margin_normal": (15.0, 32.0),
        "ebitda_margin_max": 55.0,
        "de_ratio_normal": (0.0, 1.5),
        "de_ratio_max": 2.5,
        "pe_ratio_normal": (15.0, 35.0),
        "pe_ratio_max": 65.0,
        "roe_normal": (12.0, 35.0),
        "roe_max": 65.0,
    }
}


def calculate_and_audit_ratios(merged: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate key financial ratios and audit for anomalies against sector benchmarks.

    Returns:
        Dict containing:
        - 'ratios': dict of calculated ratios and benchmarks
        - 'flags': list of consistency flags generated for abnormal ratios
    """
    flags: List[Dict[str, Any]] = []
    
    # Extract numerical inputs from merged workspace session data. The wizard's
    # actual fields (revenue_from_operations, pat, ebitda, total_borrowings,
    # net_worth, eps_basic/eps_diluted) are 3-year restated FY tables, not flat
    # scalars — this used to look for keys like "pl_revenue"/"pat_amount"/
    # "total_debt" that no upload or form field ever populates, so every ratio
    # here silently evaluated to None against real session data.
    revenue = _latest_fy_value(merged, "revenue_from_operations") or _safe_float(merged.get("revenue_fy_latest"))
    pat = _latest_fy_value(merged, "pat") or _safe_float(merged.get("pat_fy_latest"))
    ebitda = _latest_fy_value(merged, "ebitda")
    total_debt = _latest_fy_value(merged, "total_borrowings") or _safe_float(merged.get("borrowings_latest"))
    total_equity = _latest_fy_value(merged, "net_worth")
    eps = _latest_fy_value(merged, "eps_basic") or _latest_fy_value(merged, "eps_diluted")

    # No dedicated issue_price field exists — derive it as the midpoint of the
    # "Price Band (₹)" cover-page field (e.g. "100 - 105"), the only place an
    # offer price is actually captured.
    issue_price = None
    price_band = merged.get("price_band")
    if price_band:
        try:
            parts = str(price_band).replace("₹", "").split("-")
            if len(parts) == 2:
                issue_price = (float(parts[0].strip()) + float(parts[1].strip())) / 2
        except (ValueError, TypeError):
            issue_price = None

    sector_key = str(merged.get("industry_sector", "manufacturing")).lower().strip()
    if sector_key not in SECTOR_BENCHMARKS:
        sector_key = "manufacturing"
    benchmarks = SECTOR_BENCHMARKS[sector_key]

    calculated_ratios = {}

    # 1. PAT Margin (PAT / Revenue * 100)
    if revenue is not None and revenue > 0 and pat is not None:
        pat_margin = round((pat / revenue) * 100.0, 2)
        calculated_ratios["pat_margin"] = {
            "value": pat_margin,
            "unit": "%",
            "normal_range": benchmarks["pat_margin_normal"],
            "max_threshold": benchmarks["pat_margin_max"],
            "status": "NORMAL" if pat_margin <= benchmarks["pat_margin_max"] else "ANOMALY_HIGH"
        }

        if pat_margin > benchmarks["pat_margin_max"]:
            flags.append({
                "id": "ratio_pat_margin_anomaly",
                "section_id": "financials",
                "related_fields": ["pat", "revenue_from_operations"],
                "title": "Unusually High PAT Margin Anomaly",
                "description": f"Calculated PAT Margin of {pat_margin}% exceeds the realistic threshold of {benchmarks['pat_margin_max']}% for {benchmarks['label']} issuers (industry median: {benchmarks['pat_margin_normal'][0]}% - {benchmarks['pat_margin_normal'][1]}%). High PAT margins prior to an IPO can be a red flag for window-dressed financials or unrecorded expenses.",
                "reasoning_steps": [
                    f"1. Extracted Financial Figures: Restated PAT = ₹{pat} Cr vs Restated Operating Revenue = ₹{revenue} Cr.",
                    f"2. Calculated PAT Margin = ({pat} / {revenue}) * 100 = {pat_margin}%.",
                    f"3. Sector Benchmark ({benchmarks['label']}): Industry median range is {benchmarks['pat_margin_normal'][0]}%–{benchmarks['pat_margin_normal'][1]}%; realistic upper cap is {benchmarks['pat_margin_max']}%.",
                    "4. Therefore: Flagged for potential earnings management or unrecorded operating expenses under SEBI ICDR Schedule VI."
                ],
                "severity": "high",
                "blocking": True,
                "sebi_ref": "SEBI ICDR Reg 244 & Schedule VI Part A (True & Fair Disclosures)",
                "fix_steps": [
                    "Provide a detailed line-item cost breakup explaining the exceptional profitability driver.",
                    "Obtain an Auditor Certificate confirming that all operating and promoter salary expenses are fully accounted for.",
                    "Disclose any one-off non-operating income that inflated net profit during the pre-IPO year."
                ]
            })

    # 2. EBITDA Margin (EBITDA / Revenue * 100)
    if revenue is not None and revenue > 0 and ebitda is not None:
        ebitda_margin = round((ebitda / revenue) * 100.0, 2)
        calculated_ratios["ebitda_margin"] = {
            "value": ebitda_margin,
            "unit": "%",
            "normal_range": benchmarks["ebitda_margin_normal"],
            "max_threshold": benchmarks["ebitda_margin_max"],
            "status": "NORMAL" if (0 <= ebitda_margin <= benchmarks["ebitda_margin_max"]) else "ANOMALY"
        }

        if ebitda_margin > benchmarks["ebitda_margin_max"]:
            flags.append({
                "id": "ratio_ebitda_margin_high",
                "section_id": "financials",
                "related_fields": ["ebitda", "revenue_from_operations"],
                "title": "EBITDA Margin Anomaly Exceeds Industry Benchmark",
                "description": f"EBITDA Margin of {ebitda_margin}% is significantly higher than the peer benchmark ceiling ({benchmarks['ebitda_margin_max']}%) for {benchmarks['label']}.",
                "reasoning_steps": [
                    f"1. Extracted Financial Figures: EBITDA = ₹{ebitda} Cr vs Operating Revenue = ₹{revenue} Cr.",
                    f"2. Calculated EBITDA Margin = {ebitda_margin}%.",
                    f"3. Benchmark Threshold: {benchmarks['ebitda_margin_max']}% upper cap.",
                    "4. Therefore: Flagged for mandatory operating expense reconciliation."
                ],
                "severity": "medium",
                "blocking": False,
                "sebi_ref": "SEBI ICDR Schedule VI Part A Item 11",
                "fix_steps": [
                    "Attach a breakdown of raw material costs and direct manufacturing expenses."
                ]
            })

    # 3. Debt-to-Equity (Total Debt / Total Equity)
    if total_debt is not None and total_equity is not None and total_equity > 0:
        de_ratio = round(total_debt / total_equity, 2)
        calculated_ratios["de_ratio"] = {
            "value": de_ratio,
            "unit": "x",
            "normal_range": benchmarks["de_ratio_normal"],
            "max_threshold": benchmarks["de_ratio_max"],
            "status": "NORMAL" if de_ratio <= benchmarks["de_ratio_max"] else "HIGH_LEVERAGE"
        }

        if de_ratio > benchmarks["de_ratio_max"]:
            flags.append({
                "id": "ratio_high_leverage",
                "section_id": "financials",
                "related_fields": ["total_borrowings", "net_worth"],
                "title": "Excessive Debt-to-Equity Leverage Ratio",
                "description": f"Debt-to-Equity ratio of {de_ratio}x exceeds the threshold cap of {benchmarks['de_ratio_max']}x. High leverage increases financial risk for public SME shareholders.",
                "reasoning_steps": [
                    f"1. Extracted Capital Figures: Total Borrowings = ₹{total_debt} Cr vs Net Worth / Equity = ₹{total_equity} Cr.",
                    f"2. Calculated D/E Ratio = {total_debt} / {total_equity} = {de_ratio}x.",
                    f"3. Benchmark Ceiling: {benchmarks['de_ratio_max']}x for SME issuers.",
                    "4. Therefore: High insolvency exposure; capital allocation must prioritize debt reduction."
                ],
                "severity": "high",
                "blocking": True,
                "sebi_ref": "SEBI ICDR Reg 245 & Capital Structure Guidelines",
                "fix_steps": [
                    "Allocate a specific portion of IPO proceeds toward repayment or pre-payment of high-cost debt.",
                    "Obtain NOCs from lenders prior to DRHP filing."
                ]
            })

    # 4. P/E Multiple (Issue Price / EPS)
    if issue_price is not None and eps is not None and eps > 0:
        pe_ratio = round(issue_price / eps, 2)
        calculated_ratios["pe_ratio"] = {
            "value": pe_ratio,
            "unit": "x",
            "normal_range": benchmarks["pe_ratio_normal"],
            "max_threshold": benchmarks["pe_ratio_max"],
            "status": "NORMAL" if pe_ratio <= benchmarks["pe_ratio_max"] else "OVERVALUED"
        }

        if pe_ratio > benchmarks["pe_ratio_max"]:
            flags.append({
                "id": "ratio_pe_valuation_anomaly",
                "section_id": "cover_page",
                "related_fields": ["price_band", "eps_basic"],
                "title": "Elevated Pre-IPO P/E Valuation Multiple",
                "description": f"Price-to-Earnings (P/E) multiple of {pe_ratio}x (Offer Price ₹{issue_price} / EPS ₹{eps}) significantly exceeds peer SME valuations (median: {benchmarks['pe_ratio_normal'][0]}x - {benchmarks['pe_ratio_normal'][1]}x).",
                "reasoning_steps": [
                    f"1. Extracted Pricing Figures: Offer Price = ₹{issue_price}, Restated EPS = ₹{eps}.",
                    f"2. Calculated P/E Multiple = {issue_price} / {eps} = {pe_ratio}x.",
                    f"3. Sector Valuation Benchmark: Median range is {benchmarks['pe_ratio_normal'][0]}x–{benchmarks['pe_ratio_normal'][1]}x.",
                    "4. Therefore: Pricing justification in Basis of Issue Price section requires peer comparisons."
                ],
                "severity": "medium",
                "blocking": False,
                "sebi_ref": "SEBI ICDR Reg 251 & Basis for Issue Price Disclosures",
                "fix_steps": [
                    "Justify issue price in the DRHP 'Basis for Issue Price' chapter with peer accounting metrics."
                ]
            })

    # 5. Return on Equity (ROE = PAT / Total Equity * 100)
    if pat is not None and total_equity is not None and total_equity > 0:
        roe = round((pat / total_equity) * 100.0, 2)
        calculated_ratios["roe"] = {
            "value": roe,
            "unit": "%",
            "normal_range": benchmarks["roe_normal"],
            "max_threshold": benchmarks["roe_max"],
            "status": "NORMAL" if roe <= benchmarks["roe_max"] else "ANOMALY_HIGH"
        }

        if roe > benchmarks["roe_max"]:
            flags.append({
                "id": "ratio_roe_anomaly",
                "section_id": "financials",
                "related_fields": ["pat", "net_worth"],
                "title": "Anomalous Pre-IPO Return on Equity (ROE)",
                "description": f"Calculated Return on Equity of {roe}% exceeds the benchmark limit ({benchmarks['roe_max']}%). Extreme ROE prior to IPO can indicate depressed net worth or unrecorded liabilities.",
                "reasoning_steps": [
                    f"1. Extracted Figures: Net Profit = ₹{pat} Cr, Shareholders Equity = ₹{total_equity} Cr.",
                    f"2. Calculated Pre-IPO ROE = ({pat} / {total_equity}) * 100 = {roe}%.",
                    f"3. Realistic Threshold: Upper limit of {benchmarks['roe_max']}%.",
                    "4. Therefore: Flagged for net worth verification."
                ],
                "severity": "medium",
                "blocking": False,
                "sebi_ref": "SEBI ICDR Schedule VI Part A Item 11(A)",
                "fix_steps": [
                    "Attach Net Worth Reconciliation statement audited by Statutory Auditors."
                ]
            })

    return {
        "calculated_ratios": calculated_ratios,
        "flags": flags,
        "sector_info": benchmarks
    }


def _latest_fy_value(merged: Dict[str, Any], key: str) -> Optional[float]:
    """Reads a wizard FY-restated-table field (e.g. 'pat', 'net_worth',
    'revenue_from_operations') — stored as [{"fy": "FY26", "value": <num>}, ...],
    latest year first — and returns the latest year's value. Falls back to
    plain _safe_float() if the session happens to hold a flat scalar under
    the same key (e.g. an older/legacy session), so this stays a strict
    superset of reading a plain number.
    """
    val = merged.get(key)
    if isinstance(val, list):
        if not val or not isinstance(val[0], dict):
            return None
        return _safe_float(val[0].get("value"))
    return _safe_float(val)


def _safe_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        f = float(str(val).replace("₹", "").replace(",", "").strip())
        return f
    except (ValueError, TypeError):
        return None
