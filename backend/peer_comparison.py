"""
peer_comparison.py — Dynamic SEBI Schedule VI Peer Accounting & Valuation Engine
=================================================================================
Calculates SEBI ICDR Schedule VI mandatory peer group accounting metrics comparison
(EPS, NAV, RoNW, P/E Ratio) dynamically from live workspace session data.
"""

import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("sebi-ipo-generator.peer_comparison")

DEFAULT_SECTOR_PEERS = {
    "manufacturing": [
        {"name": "Precision Forge Industries Ltd", "face_value": 10, "eps": 6.50, "nav": 42.10, "ronw": 15.4, "pe_ratio": 14.2, "listed_exchange": "BSE SME"},
        {"name": "Sigma Polymers Ltd", "face_value": 10, "eps": 4.80, "nav": 35.80, "ronw": 13.4, "pe_ratio": 16.5, "listed_exchange": "NSE Emerge"},
        {"name": "Vanguard Precision Eng Ltd", "face_value": 10, "eps": 8.20, "nav": 58.40, "ronw": 14.0, "pe_ratio": 18.1, "listed_exchange": "BSE SME"},
    ],
    "it_tech": [
        {"name": "CloudNine Infotech Ltd", "face_value": 10, "eps": 9.40, "nav": 48.00, "ronw": 19.5, "pe_ratio": 24.5, "listed_exchange": "NSE Emerge"},
        {"name": "DataDynamics Systems Ltd", "face_value": 10, "eps": 7.10, "nav": 39.50, "ronw": 17.9, "pe_ratio": 21.0, "listed_exchange": "BSE SME"},
    ],
    "general": [
        {"name": "Benchmark Peer Alpha Ltd", "face_value": 10, "eps": 5.50, "nav": 38.00, "ronw": 14.5, "pe_ratio": 16.0, "listed_exchange": "BSE SME"},
        {"name": "Benchmark Peer Beta Ltd", "face_value": 10, "eps": 6.10, "nav": 41.50, "ronw": 14.7, "pe_ratio": 17.5, "listed_exchange": "NSE Emerge"},
    ]
}

def calculate_peer_comparison_and_valuation(
    session_data: Dict[str, Any],
    custom_peers: Optional[List[Dict[str, Any]]] = None,
    proposed_price_lower: float = 65.0,
    proposed_price_upper: float = 70.0
) -> Dict[str, Any]:
    """
    Computes issuer's financial metrics against listed peers dynamically.
    Returns has_data=False when workspace is reset or empty.
    """
    form_data = session_data.get("form_data", {})
    extracted = session_data.get("extracted_data", {})
    fin = extracted.get("financials", {})

    company_name = form_data.get("company_name") or extracted.get("incorporation", {}).get("company_name") or "[Awaiting Company Name]"
    industry = (form_data.get("industry_name") or "manufacturing").lower()

    # Raw inputs from session
    rev_val = form_data.get("revenue_fy24") or fin.get("revenue")
    pat_val = form_data.get("pat_fy24") or fin.get("pat")
    nw_val = form_data.get("net_worth") or fin.get("net_worth")
    ex_shares_val = form_data.get("existing_shares_cr")
    fr_shares_val = form_data.get("fresh_issue_shares_cr") or form_data.get("issue_size_cr")

    has_financial_data = any(v is not None for v in [rev_val, pat_val, nw_val, ex_shares_val, fr_shares_val])

    if not has_financial_data:
        return {
            "status": "success",
            "has_data": False,
            "company_name": company_name,
            "message": "No financial statements or capital figures loaded. Workspace is in reset/empty state."
        }

    # Safe float conversion
    pat = float(pat_val) if pat_val is not None else 0.0
    net_worth = float(nw_val) if nw_val is not None else 0.0
    existing_shares_cr = float(ex_shares_val) if ex_shares_val is not None else 1.0
    fresh_issue_shares_cr = float(fr_shares_val) if fr_shares_val is not None else 0.5

    total_post_issue_shares_cr = existing_shares_cr + fresh_issue_shares_cr
    post_issue_capital_cr = round(total_post_issue_shares_cr * 10.0, 2) # Face value ₹10

    eps_basic = round(pat / existing_shares_cr, 2) if existing_shares_cr > 0 else 0.0
    nav_per_share = round(net_worth / existing_shares_cr, 2) if existing_shares_cr > 0 else 0.0
    ronw_pct = round((pat / net_worth) * 100, 2) if net_worth > 0 else 0.0

    pe_lower = round(proposed_price_lower / eps_basic, 2) if eps_basic > 0 else 0.0
    pe_upper = round(proposed_price_upper / eps_basic, 2) if eps_basic > 0 else 0.0

    total_issue_size_lower_cr = round(fresh_issue_shares_cr * proposed_price_lower, 2)
    total_issue_size_upper_cr = round(fresh_issue_shares_cr * proposed_price_upper, 2)
    post_issue_mcap_upper_cr = round(total_post_issue_shares_cr * proposed_price_upper, 2)

    sector_key = "manufacturing" if "chem" in industry or "mfg" in industry or "manuf" in industry else (
        "it_tech" if "tech" in industry or "it" in industry or "soft" in industry else "general"
    )
    peers = custom_peers or DEFAULT_SECTOR_PEERS.get(sector_key, DEFAULT_SECTOR_PEERS["general"])

    avg_peer_pe = round(sum(p["pe_ratio"] for p in peers) / len(peers), 2) if peers else 16.5
    avg_peer_ronw = round(sum(p["ronw"] for p in peers) / len(peers), 2) if peers else 14.5

    issuer_row = {
        "name": f"{company_name} (Issuer)",
        "face_value": 10,
        "eps": eps_basic,
        "nav": nav_per_share,
        "ronw": ronw_pct,
        "pe_ratio": f"{pe_lower}x – {pe_upper}x" if pe_lower > 0 else "N/A",
        "listed_exchange": "Proposed Listing (BSE SME / NSE Emerge)"
    }

    return {
        "status": "success",
        "has_data": True,
        "company_name": company_name,
        "industry": industry.capitalize(),
        "issuer_metrics": issuer_row,
        "peer_group": peers,
        "industry_averages": {
            "avg_pe_ratio": avg_peer_pe,
            "avg_ronw_pct": avg_peer_ronw
        },
        "valuation_calculator": {
            "proposed_price_band": f"₹{proposed_price_lower} – ₹{proposed_price_upper} per share",
            "implied_pe_band": f"{pe_lower}x – {pe_upper}x" if pe_lower > 0 else "N/A",
            "fresh_issue_shares_cr": fresh_issue_shares_cr,
            "total_post_issue_shares_cr": total_post_issue_shares_cr,
            "post_issue_paid_up_capital_cr": post_issue_capital_cr,
            "sebi_cap_ceiling_limit_cr": 25.0,
            "is_cap_ceiling_compliant": post_issue_capital_cr <= 25.0,
            "issue_size_range_cr": f"₹{total_issue_size_lower_cr} Cr – ₹{total_issue_size_upper_cr} Cr",
            "post_issue_market_cap_upper_cr": post_issue_mcap_upper_cr
        }
    }
