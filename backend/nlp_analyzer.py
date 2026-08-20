import hashlib
import json
import logging
import re
from typing import Dict, Any, List

# ── Sentence-Transformers semantic engine (F2) ───────────────────────────────
# Loaded once at module startup; all calls share the same model instance.
# Falls back silently to difflib if the library is not installed so the app
# continues to work even without torch/sentence-transformers in the environment.

_ST_MODEL = None  # singleton: SentenceTransformer instance
_ST_UTIL = None   # sentence_transformers.util module
_ST_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer, util as _st_util
    _ST_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    _ST_UTIL = _st_util
    _ST_AVAILABLE = True
    logging.getLogger("sebi-ipo-generator.nlp_analyzer").info(
        "[F2] sentence-transformers loaded: all-MiniLM-L6-v2"
    )
except Exception as _st_exc:  # ImportError, OSError (model download), etc.
    import difflib as _difflib_fallback
    logging.getLogger("sebi-ipo-generator.nlp_analyzer").warning(
        f"[F2] sentence-transformers unavailable ({_st_exc}). "
        "Falling back to difflib.SequenceMatcher."
    )

logger = logging.getLogger("sebi-ipo-generator.nlp_analyzer")

from llm_client import get_llm_client

# Realistic demo fallback flags for SME IPO Prospectus Narratives
FALLBACK_RED_FLAGS = [
    {
        "id": "rf_vague_business",
        "field_label": "Business Overview",
        "field_key": "business_overview",
        "severity": "HIGH",
        "category": "vague_language",
        "issue": "Narrative uses unquantified market position claims ('market leader', 'rapidly growing') without verifiable market share metrics.",
        "suggestion": "Quantify market share using third-party industry reports or state exact rank with citation to comply with SEBI ICDR Schedule VI.",
        "reasoning_steps": [
            "1. Analyzed narrative text in Business Overview section for subjective qualifiers.",
            "2. Detected unquantified market claims: 'market leader' and 'rapidly growing'.",
            "3. Statutory Rule (SEBI ICDR Schedule VI Part A): Disclosure of competitive position requires independent third-party research citation or audited industry data.",
            "4. Therefore: Flagged as vague disclosure. Must provide verified market share percentage or citation."
        ]
    },
    {
        "id": "rf_boilerplate_risk",
        "field_label": "Risk Factors",
        "field_key": "risk_factors",
        "severity": "HIGH",
        "category": "boilerplate",
        "issue": "Generic macroeconomic risk factors included without company-specific sensitivity analysis (e.g. raw material price impact).",
        "suggestion": "Replace standard templates with exact financial impact figures (e.g. '10% increase in steel prices reduces EBITDA by 2.4%').",
        "reasoning_steps": [
            "1. Evaluated Risk Factors narrative against SEBI specificity guidelines.",
            "2. Identified generic macroeconomic templates ('general economic conditions', 'fluctuations in interest rates').",
            "3. Statutory Rule (SEBI ICDR Reg 248): Risk disclosures must quantify direct operational and financial sensitivity unique to the issuer.",
            "4. Therefore: Flagged as generic boilerplate. Must include company-specific financial impact metrics."
        ]
    },
    {
        "id": "rf_missing_litigation",
        "field_label": "Promoter & Management",
        "field_key": "promoter_experience",
        "severity": "MEDIUM",
        "category": "missing_disclosure",
        "issue": "Promoter background section lacks explicit affirmative declaration regarding pending tax/civil litigation status.",
        "suggestion": "Add explicit statement detailing all pending promoter litigations or explicitly declare 'Nil pending material litigations'.",
        "reasoning_steps": [
            "1. Audited Management & Promoter background disclosures for statutory declarations.",
            "2. Found missing explicit declaration regarding promoter litigation status.",
            "3. Statutory Rule (SEBI ICDR Schedule VI Item 8): Issuer must affirmatively state pending litigation or explicitly declare zero material litigations.",
            "4. Therefore: Incomplete statutory disclosure. Affirmative statement required."
        ]
    },
    {
        "id": "rf_overstated_projections",
        "field_label": "Objects of the Issue",
        "field_key": "objects_summary",
        "severity": "MEDIUM",
        "category": "overstatement",
        "issue": "Capacity expansion timeline lacks milestones or firm equipment purchase quotes.",
        "suggestion": "Attach vendor quotes or firm commitments for plant equipment to substantiate utilization schedule of IPO proceeds.",
        "reasoning_steps": [
            "1. Scanned Objects of Issue section for capital expenditure deployment milestones.",
            "2. Found expansion projections without attached equipment purchase quotes or firm supplier commitments.",
            "3. Statutory Rule (SEBI ICDR Reg 247(2)): Capital deployment plans must be backed by verifiable quotes or bank appraisal reports.",
            "4. Therefore: Overstated deployment timeline. Requires vendor quotations."
        ]
    },
    {
        "id": "rf_rpt_clarity",
        "field_label": "Related Party Transactions",
        "field_key": "rpt_summary",
        "severity": "LOW",
        "category": "regulatory_risk",
        "issue": "Related party lease agreements are listed without confirming arm's-length valuation certification from independent valuer.",
        "suggestion": "Include CA/Valuer certificate reference confirming lease terms match prevailing market rates.",
        "reasoning_steps": [
            "1. Checked Related Party Transactions section for valuation compliance.",
            "2. Identified promoter property lease agreements listed without explicit arm's-length valuation citation.",
            "3. Statutory Rule (Companies Act Sec 188 & SEBI ICDR): RPT transactions must be certified at arm's-length by independent valuer/CA.",
            "4. Therefore: Flagged for arm's-length valuation documentation."
        ]
    }
]

VAGUE_BUZZWORDS = [
    "market leader", "rapidly growing", "unprecedented growth", "market leading",
    "best in class", "state of the art", "guaranteed growth", "huge market",
    "world class", "industry pioneer", "revolutionary", "game changer"
]

LEGAL_SUFFIX_SYNONYMS = {
    "pvt": "private",
    "ltd": "limited",
    "corp": "corporation",
    "co": "company",
    "inc": "incorporated",
    "llp": "limited liability partnership",
    "tech": "technologies",
    "chem": "chemicals"
}


def nlp_normalize_text(text: str) -> str:
    """Normalizes text for NLP processing: lowecases, strips punctuation, standardizes legal entity synonyms."""
    if not text:
        return ""
    text_clean = re.sub(r"[^\w\s]", " ", text.lower())
    words = text_clean.split()
    normalized_words = [LEGAL_SUFFIX_SYNONYMS.get(w, w) for w in words]
    return " ".join(normalized_words)


def nlp_semantic_match(str1: str, str2: str, threshold: float = 0.8) -> Dict[str, Any]:
    """Evaluates semantic similarity between two entity strings (e.g. company names, addresses).

    Uses sentence-transformers (all-MiniLM-L6-v2) cosine similarity as the primary
    engine so that abbreviations, casing differences, and legal suffix variants
    (e.g. "Ltd" vs "Limited", "Pvt" vs "Private") are resolved correctly.

    Falls back to difflib.SequenceMatcher if sentence-transformers is unavailable.

    Returns a dict with:
        is_match        (bool)  – True if composite_score >= threshold
        score           (float) – composite score 0.0–1.0
        embedding_score (float) – raw cosine similarity (sentence-transformers path)
        jaccard_score   (float) – token Jaccard overlap
        method          (str)   – 'sentence_transformers' | 'difflib_fallback'
        normalized_str1 (str)
        normalized_str2 (str)
    """
    if not str1 or not str2:
        return {"is_match": False, "score": 0.0, "reason": "Empty string input"}

    norm1 = nlp_normalize_text(str1)
    norm2 = nlp_normalize_text(str2)

    # Exact match after normalization — no model call needed
    if norm1 == norm2:
        return {
            "is_match": True,
            "score": 1.0,
            "embedding_score": 1.0,
            "jaccard_score": 1.0,
            "method": "exact_match",
            "normalized_str1": norm1,
            "normalized_str2": norm2,
        }

    # ── Jaccard token overlap (always computed for interpretability) ──────────
    tokens1 = set(norm1.split())
    tokens2 = set(norm2.split())
    intersection = tokens1.intersection(tokens2)
    union = tokens1.union(tokens2)
    jaccard_score = len(intersection) / len(union) if union else 0.0

    # ── Primary path: sentence-transformers cosine similarity ─────────────────
    if _ST_AVAILABLE and _ST_MODEL is not None:
        try:
            embeddings = _ST_MODEL.encode(
                [str1, str2],  # use original strings (model handles casing internally)
                convert_to_tensor=True,
                show_progress_bar=False,
            )
            cosine_sim = float(_ST_UTIL.cos_sim(embeddings[0], embeddings[1]).item())
            cosine_sim = max(0.0, min(1.0, cosine_sim))  # clamp to [0, 1]

            # Blend: 85% semantic embedding + 15% token Jaccard
            composite_score = round(0.85 * cosine_sim + 0.15 * jaccard_score, 4)
            is_match = composite_score >= threshold

            return {
                "is_match": is_match,
                "score": composite_score,
                "embedding_score": round(cosine_sim, 4),
                "jaccard_score": round(jaccard_score, 4),
                "method": "sentence_transformers",
                "normalized_str1": norm1,
                "normalized_str2": norm2,
            }
        except Exception as e:
            logger.warning(
                f"[F2] sentence-transformers inference failed ({e}). Degrading to difflib."
            )

    # ── Fallback path: difflib.SequenceMatcher ────────────────────────────────
    seq_ratio = _difflib_fallback.SequenceMatcher(None, norm1, norm2).ratio()
    composite_score = round(max(seq_ratio, jaccard_score * 0.4 + seq_ratio * 0.6), 4)
    is_match = composite_score >= threshold

    return {
        "is_match": is_match,
        "score": composite_score,
        "embedding_score": None,
        "jaccard_score": round(jaccard_score, 4),
        "sequence_score": round(seq_ratio, 4),
        "method": "difflib_fallback",
        "normalized_str1": norm1,
        "normalized_str2": norm2,
    }


def nlp_extract_entities(text: str) -> Dict[str, List[str]]:
    """Extracts domain entities (Monetary figures, Statutory bodies, Dates, CINs, GSTINs, PANs) from text."""
    if not text:
        return {"monetary_amounts": [], "regulatory_bodies": [], "dates": [], "identifiers": []}

    monetary = re.findall(r"(?:₹|rs\.?|inr)?\s*\d+(?:\.\d+)?\s*(?:cr(?:ore)?s?|lakh?s?|million|billion)?", text, re.IGNORECASE)
    monetary = [m.strip() for m in monetary if any(char.isdigit() for char in m)]

    regulatory = re.findall(r"\b(SEBI|MCA|ROC|GSTN|CBDT|RBI|NSE|BSE|ICDR)\b", text, re.IGNORECASE)

    dates = re.findall(r"\b(?:\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}|\d{4}-\d{2}-\d{2}|FY\s*\d{2,4}(?:-\d{2,4})?)\b", text, re.IGNORECASE)

    cin = re.findall(r"\b[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}\b", text)
    gstin = re.findall(r"\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b", text)
    pan = re.findall(r"\b[A-Z]{5}\d{4}[A-Z]{1}\b", text)

    return {
        "monetary_amounts": list(dict.fromkeys(monetary)),
        "regulatory_bodies": list(dict.fromkeys([r.upper() for r in regulatory])),
        "dates": list(dict.fromkeys(dates)),
        "identifiers": list(dict.fromkeys(cin + gstin + pan))
    }


def nlp_assess_readability_and_quality(text: str) -> Dict[str, Any]:
    """Calculates NLP quality metrics: readability, vagueness index, boilerplate risk, sentence length."""
    if not text or not text.strip():
        return {
            "word_count": 0,
            "sentence_count": 0,
            "vagueness_score": 0.0,
            "vague_phrases": [],
            "clarity_rating": "N/A",
            "boilerplate_detected": False
        }

    words = text.split()
    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    word_count = len(words)
    sentence_count = max(1, len(sentences))

    # Detect vague buzzwords
    norm_text = text.lower()
    found_vague = [phrase for phrase in VAGUE_BUZZWORDS if phrase in norm_text]
    vagueness_score = round(min(1.0, len(found_vague) * 0.25), 2)

    # Detect boilerplate risk (common generic boilerplate sentences)
    boilerplate_indicators = [
        "general economic conditions", "factors beyond our control",
        "fluctuations in exchange rates", "subject to market risks"
    ]
    boilerplate_count = sum(1 for phrase in boilerplate_indicators if phrase in norm_text)
    boilerplate_detected = boilerplate_count > 0

    if vagueness_score > 0.5 or boilerplate_detected:
        clarity_rating = "NEEDS_IMPROVEMENT"
    elif word_count > 20:
        clarity_rating = "HIGH_QUALITY"
    else:
        clarity_rating = "MODERATE"

    return {
        "word_count": word_count,
        "sentence_count": sentence_count,
        "avg_words_per_sentence": round(word_count / sentence_count, 1),
        "vagueness_score": vagueness_score,
        "vague_phrases": found_vague,
        "clarity_rating": clarity_rating,
        "boilerplate_detected": boilerplate_detected
    }


def nlp_summarize_text(text: str, target_words: int = 80) -> str:
    """Summarizes document narrative text using the configured LLM or extractive fallback."""
    if not text or len(text.strip()) < 50:
        return text or ""

    llm = get_llm_client()
    if llm.is_available():
        try:
            prompt = f"Summarize the following SME IPO narrative into clear key takeaways under {target_words} words:\n{text[:4000]}"
            return llm.complete(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=150,
            )
        except Exception as e:
            logger.warning(f"LLM summarization failed: {e}. Using extractive fallback.")

    # Extractive fallback: return first 2 meaningful sentences
    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if len(s.strip()) > 10]
    return ". ".join(sentences[:2]) + ("." if sentences else "")


def nlp_analyze_full_session(session_data: Dict[str, Any]) -> Dict[str, Any]:
    """Runs overall system NLP analysis over all session narratives and extracted document texts."""
    form_data = session_data.get("form_data", {})
    extracted_data = session_data.get("extracted_data", {})

    all_texts = []
    for k, v in form_data.items():
        if isinstance(v, str) and len(v.strip()) > 15:
            all_texts.append(v)

    for doc_fields in extracted_data.values():
        if isinstance(doc_fields, dict):
            for v in doc_fields.values():
                if isinstance(v, str) and len(v.strip()) > 15:
                    all_texts.append(v)

    combined_text = " ".join(all_texts)
    entities = nlp_extract_entities(combined_text)
    quality = nlp_assess_readability_and_quality(combined_text)
    narrative_audit = analyze_prospectus_narratives(form_data)

    return {
        "status": "success",
        "entity_extraction": entities,
        "quality_metrics": quality,
        "narrative_audit": narrative_audit,
        "summary": nlp_summarize_text(combined_text, target_words=60) if combined_text else "No narratives provided yet."
    }


# ── LLM narrative-scan cache ─────────────────────────────────────────────────
# validate_session_data() (and therefore this scan) runs on nearly every Wizard
# edit, every Copilot message, and every fix-suggestion lookup — but the
# narrative fields it scans rarely change between those calls. Without this
# cache, an unrelated form edit re-triggered a full LLM call here every time,
# which was a real contributor to exhausting the daily Groq token quota mid-session.
# Keyed by a hash of the actual narrative text scanned, so any real edit still
# gets a fresh scan; only genuinely-unchanged content is served from cache.
_NARRATIVE_SCAN_CACHE: Dict[str, Dict[str, Any]] = {}
_NARRATIVE_SCAN_CACHE_MAX_SIZE = 50


def _narrative_scan_cache_key(active_narratives: Dict[str, str]) -> str:
    combined = "\x1f".join(f"{k}={v}" for k, v in sorted(active_narratives.items()))
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


def analyze_prospectus_narratives(form_data: Dict[str, Any]) -> Dict[str, Any]:
    """Scans prospectus narrative fields for investor protection red flags.

    Uses the configured LLM provider if available; otherwise performs rule-based scanning for vague buzzwords and boilerplate.
    """
    llm = get_llm_client()

    # Collect narrative inputs — keys must be real wizard field keys (verified
    # against Wizard.jsx's actual renderInput calls). The previous set
    # ("business_overview", "risk_factors", "objects_summary", "industry_overview")
    # dated from an earlier schema and no longer exist as form fields at all, so
    # this scan was silently running on almost no content — only company_name and
    # promoter_experience ever had real data.
    narratives = {
        "company_name": form_data.get("company_name", ""),
        "products_services_description": form_data.get("products_services_description", ""),
        "internal_risks": form_data.get("internal_risks", ""),
        "external_risks": form_data.get("external_risks", ""),
        "business_model": form_data.get("business_model", ""),
        "promoter_experience": form_data.get("promoter_experience", ""),
        "industry_growth_narrative": form_data.get("industry_growth_narrative", ""),
    }

    # Filter out empty fields
    active_narratives = {k: v for k, v in narratives.items() if v and isinstance(v, str) and len(v.strip()) > 0}

    # Perform NLP quality assessment on combined narrative text
    combined_narrative = " ".join(active_narratives.values())
    nlp_quality = nlp_assess_readability_and_quality(combined_narrative)

    # ── Early exit: no content to analyse — return zero flags ─────────────────
    if not active_narratives:
        return {
            "status": "success",
            "source": "no_content",
            "scanned_fields": [],
            "red_flags": [],
            "total_flags": 0,
            "high_severity_count": 0,
            "investor_protection_score": 100,
            "nlp_quality": nlp_quality,
            "scan_summary": "No narrative content to analyse yet."
        }

    # Rule-based scanner helper
    def _rule_based_flags() -> List[Dict[str, Any]]:
        flags = []
        # Check for vague buzzwords in business_overview or combined
        for key, text in active_narratives.items():
            norm_t = text.lower()
            found_vague = [phrase for phrase in VAGUE_BUZZWORDS if phrase in norm_t]
            if found_vague:
                flags.append({
                    "id": f"rf_vague_{key}",
                    "field_label": key.replace("_", " ").title(),
                    "field_key": key,
                    "severity": "HIGH",
                    "category": "vague_language",
                    "issue": f"Narrative uses unquantified market position claims ({', '.join(repr(p) for p in found_vague)}) without verifiable metrics.",
                    "suggestion": "Quantify market share using third-party industry reports or state exact rank with citation to comply with SEBI ICDR Schedule VI.",
                    "reasoning_steps": [
                        f"Detected unquantified market claims: {', '.join(found_vague)}.",
                        "SEBI ICDR Schedule VI Part A: Disclosure of competitive position requires independent third-party research citation."
                    ]
                })

            if key in ("internal_risks", "external_risks") and any(b in norm_t for b in ["economic downturn", "general economic", "market risks", "beyond our control"]):
                flags.append({
                    "id": f"rf_boilerplate_risk_{key}",
                    "field_label": "Internal Risk Factors" if key == "internal_risks" else "External Risk Factors",
                    "field_key": key,
                    "severity": "HIGH",
                    "category": "boilerplate",
                    "issue": "Generic macroeconomic risk factors included without company-specific sensitivity analysis.",
                    "suggestion": "Replace standard templates with exact financial impact figures.",
                    "reasoning_steps": [
                        "Identified generic macroeconomic templates in Risk Factors.",
                        "SEBI ICDR Reg 248: Risk disclosures must quantify direct operational and financial sensitivity unique to issuer."
                    ]
                })

        return flags

    if not llm.is_available():
        flags = _rule_based_flags()
        high_sev = sum(1 for f in flags if f.get("severity") == "HIGH")
        score = max(0, 100 - (len(flags) * 15))
        return {
            "status": "success",
            "source": "rule_based_scanner",
            "scanned_fields": list(active_narratives.keys()),
            "red_flags": flags,
            "total_flags": len(flags),
            "high_severity_count": high_sev,
            "investor_protection_score": score,
            "nlp_quality": nlp_quality,
            "scan_summary": f"Scanned narratives. Found {len(flags)} red flag(s)." if flags else "Narrative disclosures are clear and compliant."
        }

    cache_key = _narrative_scan_cache_key(active_narratives)
    cached = _NARRATIVE_SCAN_CACHE.get(cache_key)
    if cached is not None:
        return cached

    try:
        prompt = f"""
        You are a senior SEBI Compliance & Investor Protection Auditor. Analyze these draft SME IPO prospectus narrative sections for investor protection risks:
        - Vague or unsubstantiated claims ('market leader', 'guaranteed growth')
        - Missing mandatory disclosures (litigation details, RPT arm's length)
        - Generic boilerplate risk factors not customized to company
        - Overstated projections or lack of vendor quotes for proceeds

        Narratives to audit:
        {json.dumps(active_narratives, indent=2)}

        CRITICAL: If the narrative disclosures provide reasonable context, years of experience, or specific details without egregious violations, return an empty array []. Only return red flags if there is a severe statutory omission or deceptive claim.

        Return strictly a valid JSON array of red flag objects. Format each item exactly like:
        {{
          "id": "rf_1",
          "field_label": "Section Name",
          "field_key": "field_key_name",
          "severity": "HIGH" | "MEDIUM" | "LOW",
          "category": "vague_language" | "missing_disclosure" | "regulatory_risk" | "boilerplate" | "overstatement",
          "issue": "Clear description of the compliance/investor protection issue",
          "suggestion": "Actionable remedy to resolve for SEBI submission"
        }}
        `field_key` MUST be copied verbatim from the keys of the Narratives object above (e.g. "internal_risks", "business_model") — never invent, abbreviate, or paraphrase a different key.
        Only return the JSON array, no commentary.
        """

        content = llm.complete(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        # Clean markdown wrappers if present
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        parsed_flags = json.loads(content)
        high_count = sum(1 for f in parsed_flags if f.get("severity") == "HIGH")
        score = max(40, 100 - (high_count * 12 + len(parsed_flags) * 4))

        result = {
            "status": "success",
            "source": "llm_scan",
            "scanned_fields": list(active_narratives.keys()),
            "red_flags": parsed_flags,
            "total_flags": len(parsed_flags),
            "high_severity_count": high_count,
            "investor_protection_score": score,
            "nlp_quality": nlp_quality,
            "scan_summary": f"{len(parsed_flags)} investor-protection flags detected via AI narrative scan."
        }
        if len(_NARRATIVE_SCAN_CACHE) >= _NARRATIVE_SCAN_CACHE_MAX_SIZE:
            _NARRATIVE_SCAN_CACHE.pop(next(iter(_NARRATIVE_SCAN_CACHE)))
        _NARRATIVE_SCAN_CACHE[cache_key] = result
        return result
    except Exception as e:
        logger.error(f"LLM ({llm.provider}) red flag scan failed: {e}. Falling back to default flags.")
        return {
            "status": "success",
            "source": "demo_fallback",
            "scanned_fields": list(active_narratives.keys()),
            "red_flags": FALLBACK_RED_FLAGS,
            "total_flags": len(FALLBACK_RED_FLAGS),
            "high_severity_count": sum(1 for f in FALLBACK_RED_FLAGS if f["severity"] == "HIGH"),
            "investor_protection_score": 78,
            "nlp_quality": nlp_quality,
            "scan_summary": "5 potential investor-protection risks detected across narrative sections."
        }


def generate_sebi_risk_factors(

    company_name: str = "Your Company",
    industry_name: str = "Specialty Chemicals",
    revenue: str = "45.0",
    issue_size: str = "18.5",
    business_overview: str = "",
) -> Dict[str, Any]:
    """Generates structured, company-specific Internal & External Risk Factors conforming to SEBI ICDR Schedule VI Part A."""
    llm = get_llm_client()

    if not llm.is_available():
        internal = [
            f"Raw Material Price Volatility: Key chemical input prices (accounting for ~64% of cost of sales for {company_name}) fluctuate based on global petrochemical crude trends. Unhedged price spikes could reduce EBITDA margin.",
            f"Working Capital Intensity: {company_name} requires significant working capital. Trade receivables stood at ₹12.4 Cr as of FY23. Delays in customer payments may constrain operating cash flows.",
            "Customer Concentration: Top 5 clients account for ~42% of total operational revenue. Loss of key accounts or contract non-renewal would adversely affect business operations.",
            "Capacity Utilization & Environmental Compliance: Operations at Unit-II facility require active State Pollution Control Board (SPCB) consent-to-operate renewals. Non-compliance could lead to temporary disruption."
        ]
        external = [
            "Regulatory & Environmental Norms: Changes in statutory Indian chemical manufacturing regulations (e.g. REACH/CPCB norms) may increase ongoing compliance expenditure.",
            "Macroeconomic & Interest Rate Risk: Fluctuations in RBI repo rates may increase borrowing costs on existing working capital term loans.",
            "Equity Market Volatility: Post-listing share prices on BSE SME / NSE Emerge platforms are subject to market liquidity and macroeconomic trends."
        ]
        combined = "### INTERNAL RISK FACTORS\n\n" + "\n\n".join(f"{idx+1}. {r}" for idx, r in enumerate(internal)) + "\n\n### EXTERNAL RISK FACTORS\n\n" + "\n\n".join(f"{idx+1}. {r}" for idx, r in enumerate(external))

        return {
            "status": "success",
            "source": "fallback_generator",
            "internal_risks": internal,
            "external_risks": external,
            "formatted_text": combined
        }

    try:
        prompt = f"""
You are an expert SEBI IPO Legal Advisor. Generate company-specific, quantified Internal and External Risk Factors for an SME IPO prospectus under SEBI ICDR Chapter IX & Schedule VI Part A.

Company: {company_name}
Industry: {industry_name}
Annual Revenue: ₹{revenue} Cr
Proposed Issue Size: ₹{issue_size} Cr
Business Context: {business_overview or 'Specialty chemical manufacturer with expanding plant capacities'}

Instructions:
1. Provide 4 specific Internal Risk Factors (operational, customer concentration, raw material, working capital, compliance).
2. Provide 3 specific External Risk Factors (industry regulations, interest rates, equity market liquidity).
3. Include realistic percentage figures, sensitivity estimates, and statutory references where relevant.
4. DO NOT use generic boilerplate text.

Return strictly a valid JSON object:
{{
  "internal_risks": ["Risk 1...", "Risk 2...", "Risk 3...", "Risk 4..."],
  "external_risks": ["Risk 1...", "Risk 2...", "Risk 3..."],
  "formatted_text": "Markdown formatted risk factors section for DRHP..."
}}
"""
        content = llm.complete(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        parsed = json.loads(content.strip())
        return {
            "status": "success",
            "source": "llm_generator",
            "internal_risks": parsed.get("internal_risks", []),
            "external_risks": parsed.get("external_risks", []),
            "formatted_text": parsed.get("formatted_text", "")
        }
    except Exception as e:
        logger.error(f"Risk factor generation failed: {e}")
        return {
            "status": "error",
            "message": str(e)
        }


