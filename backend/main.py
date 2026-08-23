import os
import json
import logging
import tempfile
import uuid
import asyncio
import time
import hashlib
from datetime import datetime
from collections import defaultdict
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from typing import Dict, Any, List, Optional
from fastapi import Depends, FastAPI, Header, UploadFile, File, Form, HTTPException, Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTasks
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# Configure logging early
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("sebi-ipo-generator")

# Import blockchain anchoring service (graceful mock if web3 not installed)
try:
    from blockchain import (
        compute_sha256_file,
        compute_sha256_bytes,
        anchor_document_hash,
        seal_prospectus,
        verify_document_hash,
        verify_prospectus_hash,
        get_blockchain_status,
    )
    BLOCKCHAIN_AVAILABLE = True
except ImportError:
    BLOCKCHAIN_AVAILABLE = False
    logger.warning("blockchain.py not found — blockchain features disabled.")

# Structural PDF forensics (see doc_forensics.py) — independent of blockchain
# anchoring above: anchoring proves the file hasn't changed *since* upload,
# this looks at what the file's own structure suggests about *before* upload.
try:
    from doc_forensics import analyze_document_forensics
    DOC_FORENSICS_AVAILABLE = True
except ImportError:
    DOC_FORENSICS_AVAILABLE = False
    logger.warning("doc_forensics.py not found — structural document forensics disabled.")

# Import our custom modules
try:
    from extractor import extract_document_data, OCR_STATUS
    from validator import validate_session_data
    from generator import generate_draft_docx
except ImportError:
    OCR_STATUS = {"ocr_available": False, "paddleocr_available": False, "poppler_available": False}
    pass

try:
    from nlp_analyzer import (
        analyze_prospectus_narratives,
        nlp_analyze_full_session,
        nlp_assess_readability_and_quality,
        nlp_semantic_match
    )
except ImportError:
    analyze_prospectus_narratives = None
    nlp_analyze_full_session = None
    nlp_assess_readability_and_quality = None
    nlp_semantic_match = None

try:
    from consistency_checker import get_explanation
except ImportError:
    get_explanation = None

try:
    from rag_engine import rag_engine
except ImportError:
    rag_engine = None

try:
    from job_manager import job_manager
except ImportError:
    job_manager = None

try:
    from verifiable_credentials import issue_document_vc, verify_vc_signature
except ImportError:
    issue_document_vc = None
    verify_vc_signature = None

try:
    from sebi_circulars import fetch_sebi_regulatory_alerts
except ImportError:
    fetch_sebi_regulatory_alerts = None

try:
    from due_diligence import get_due_diligence_summary
    from peer_comparison import calculate_peer_comparison_and_valuation
    from version_tracker import get_version_history_summary, create_version_snapshot
    from exporter import create_export_zip_bundle
except ImportError as err:
    logger.warning(f"Enterprise modules import warning: {err}")

try:
    from hallucination_guard import HallucinationGuard
    from certification import CertificationStore
    from audit_log import AuditLog
    from coverage import compute_coverage
except ImportError as err:
    logger.warning(f"Upgrade modules import warning: {err}")

audit_logger = AuditLog()
cert_store = CertificationStore()

from llm_client import get_llm_client, is_rate_limit_error

app = FastAPI(title="SEBI SME IPO Draft-Generator API")


# CORS setup allowing local development ports and configured origins
cors_env = os.getenv("CORS_ORIGINS", "*")
if cors_env == "*":
    cors_origins = ["*"]
else:
    cors_origins = [origin.strip() for origin in cors_env.split(",") if origin.strip()]
    cors_origins.extend(["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:5175"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Liveness/readiness probe for Docker HEALTHCHECK and Railway's healthcheckPath."""
    return {"status": "ok"}


# ── Rate Limiting Middleware (In-memory token bucket) ──────────────────────────
_RATE_LIMIT_STORE: Dict[str, List[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # seconds
MAX_REQUESTS_PER_WINDOW = 120  # requests per minute per IP

@app.middleware("http")
async def rate_limit_middleware(request: FastAPIRequest, call_next):
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()
    
    # Clean up old timestamps outside window
    timestamps = [t for t in _RATE_LIMIT_STORE[client_ip] if now - t < RATE_LIMIT_WINDOW]
    _RATE_LIMIT_STORE[client_ip] = timestamps
    
    if len(timestamps) >= MAX_REQUESTS_PER_WINDOW:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Please wait a minute before making more requests."}
        )
    
    _RATE_LIMIT_STORE[client_ip].append(now)
    return await call_next(request)

SCHEMA_FILE = os.path.join(os.path.dirname(__file__), "schema.json")
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_UPLOADS = {
    ".pdf": b"%PDF-",
    ".png": b"\x89PNG\r\n\x1a\n",
    ".jpg": b"\xff\xd8\xff",
    ".jpeg": b"\xff\xd8\xff",
}

# ── One-click demo document set ──────────────────────────────────────────────
# Bundled inside backend/demo_files/ (not the repo-root /files/ folder) so it
# ships inside the Docker image via the existing `COPY . .` — no extra volume
# mount needed. Maps each of the 10 upload doc_types to its sample filename.
DEMO_FILES_DIR = os.path.join(os.path.dirname(__file__), "demo_files")
DEMO_DOC_FILES = {
    "financials": "Audited_Financial_Statement.pdf",
    "gst": "gst_registration_certificate.pdf",
    "incorporation": "roc_certificate_of_incorporation.pdf",
    "compliance": "pan_tan_certificate.pdf",
    "moa_aoa": "MOA_AOA.pdf",
    "cap_table": "Register_of_Members_Cap_Table.pdf",
    "dir12": "DIR12_Board_Resolutions.pdf",
    "litigation_schedule": "Litigation_Schedule.pdf",
    "industry_report": "Industry_Report.pdf",
    "sales_register": "Sales_Register_GST_Sales.pdf",
}

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
# Supabase now issues publishable/secret keys. The legacy anon/service-role
# names remain supported for existing projects.
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY", "")

def empty_session() -> Dict[str, Any]:
    return {
        "form_data": {},
        "extracted_data": {
            "financials": {}, "gst": {}, "incorporation": {}, "compliance": {},
            "moa_aoa": {}, "cap_table": {}, "dir12": {}, "litigation_schedule": {},
            "industry_report": {}, "sales_register": {},
        },
        "uploaded_files": [],
    }

def require_supabase_config() -> None:
    if not (SUPABASE_URL and SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY):
        raise HTTPException(status_code=503, detail="Supabase is not configured on the API server.")

def supabase_request(path: str, method: str = "GET", payload: Optional[Dict[str, Any]] = None, token: Optional[str] = None) -> Any:
    require_supabase_config()
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(
        f"{SUPABASE_URL}{path}", method=method, data=body,
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {token or SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Prefer": "return=representation",
        },
    )
    try:
        with urlopen(request, timeout=10) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except (HTTPError, URLError, json.JSONDecodeError) as exc:
        logger.error("Supabase request failed: %s", exc)
        raise HTTPException(status_code=503, detail="Workspace storage is temporarily unavailable.")

# Lives inside a "state/" subdirectory, not directly at backend/session_state.json —
# Docker Compose mounts a named volume onto that directory (not the file itself) so
# the mount always matches the well-supported directory-volume pattern used for
# temp_uploads/, audit/, and chroma_db/. Naming this file directly as a volume
# target hit a runc "mount directory onto a file" failure even on a freshly created
# volume — some Docker builds don't reliably auto-detect that a named volume should
# be file-typed just because the image path is a file.
_SESSION_STATE_DIR = os.path.join(os.path.dirname(__file__), "state")
os.makedirs(_SESSION_STATE_DIR, exist_ok=True)
SESSION_STATE_FILE = os.path.join(_SESSION_STATE_DIR, "session_state.json")

def get_current_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    demo_user = {"id": "demo-user-123", "email": "demo@iposherpa.local", "user_metadata": {"full_name": "Demo Founder"}}
    if not authorization or not authorization.startswith("Bearer "):
        return demo_user
    access_token = authorization.removeprefix("Bearer ").strip()
    if access_token in ["demo-token", "null", "undefined", ""]:
        return demo_user
    if SUPABASE_URL and SUPABASE_ANON_KEY:
        try:
            request = Request(
                f"{SUPABASE_URL}/auth/v1/user", headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {access_token}"}
            )
            with urlopen(request, timeout=5) as response:
                user_obj = json.loads(response.read().decode("utf-8"))
                if user_obj and isinstance(user_obj, dict) and "id" in user_obj:
                    return user_obj
        except Exception as e:
            logger.warning(f"Supabase auth check failed ({e}); using demo user context.")
    return demo_user

_SCHEMA_CACHE: Optional[Dict[str, Any]] = None

def load_schema() -> Dict[str, Any]:
    global _SCHEMA_CACHE
    if _SCHEMA_CACHE is not None:
        return _SCHEMA_CACHE
    if not os.path.exists(SCHEMA_FILE):
        return {"sections": []}
    with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
        _SCHEMA_CACHE = json.load(f)
        return _SCHEMA_CACHE

def load_session(user_id: str) -> Dict[str, Any]:
    if SUPABASE_URL and SUPABASE_ANON_KEY and user_id != "demo-user-123":
        try:
            rows = supabase_request(f"/rest/v1/ipo_workspaces?user_id=eq.{user_id}&select=session_data")
            if rows:
                return rows[0].get("session_data") or empty_session()
            session = empty_session()
            supabase_request("/rest/v1/ipo_workspaces", method="POST", payload={"user_id": user_id, "session_data": session})
            return session
        except Exception as e:
            logger.warning(f"Supabase load_session failed: {e}. Falling back to local session_state.json.")

    # Fallback to local session_state.json
    if os.path.exists(SESSION_STATE_FILE):
        try:
            with open(SESSION_STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return empty_session()

def save_session(user_id: str, data: Dict[str, Any]) -> None:
    if SUPABASE_URL and SUPABASE_ANON_KEY and user_id != "demo-user-123":
        try:
            supabase_request(f"/rest/v1/ipo_workspaces?user_id=eq.{user_id}", method="PATCH", payload={"session_data": data})
        except Exception as e:
            logger.warning(f"Supabase save_session failed: {e}. Saving to local session_state.json.")

    # Always persist to local session_state.json for local dev reliability
    try:
        with open(SESSION_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to write local session_state.json: {e}")

# ── Per-user session write lock ──────────────────────────────────────────────
# Background upload jobs each do load_session -> merge -> save_session. With
# multiple documents uploaded around the same time (e.g. the Document Vault's
# "Load Demo Documents" button, or just two quick manual uploads), those jobs
# run concurrently and raced on this read-modify-write: whichever job's
# save_session() landed last won outright, silently discarding any fields
# another job had just merged in — observed concretely as a stale company_name
# from an earlier session surviving a fresh batch upload because the slowest
# job's stale in-memory snapshot overwrote everything the faster jobs had
# already saved. Serializing the critical section per user_id closes that race
# without limiting how many files can extract (the slow OCR/LLM work) in parallel.
_session_locks: Dict[str, asyncio.Lock] = {}

def get_session_lock(user_id: str) -> asyncio.Lock:
    if user_id not in _session_locks:
        _session_locks[user_id] = asyncio.Lock()
    return _session_locks[user_id]

class FormDataPayload(BaseModel):
    form_data: Dict[str, Any]

class FullSessionPayload(BaseModel):
    form_data: Dict[str, Any]
    extracted_data: Dict[str, Any]
    uploaded_files: List[Dict[str, Any]]

class DraftPayload(BaseModel):
    field_key: str
    form_data: Dict[str, Any]
    field_label: Optional[str] = None
    existing_text: Optional[str] = None

class RAGQueryPayload(BaseModel):
    query: str

class CopilotMessage(BaseModel):
    role: str
    content: str

class CopilotPayload(BaseModel):
    message: str
    history: List[CopilotMessage] = []

class GenerateRiskFactorsPayload(BaseModel):

    company_name: Optional[str] = "Your Company"
    industry_name: Optional[str] = "Specialty Chemicals"
    revenue: Optional[str] = "45.0"
    issue_size: Optional[str] = "18.5"
    business_overview: Optional[str] = ""


def build_copilot_system_prompt(session: Dict[str, Any], validation: Dict[str, Any]) -> str:
    form_data = session.get("form_data", {})
    extracted_data = session.get("extracted_data", {})
    
    # Format inconsistencies
    inconsistencies_list = []
    for inc in validation.get("inconsistencies", []):
        inconsistencies_list.append(f"- {inc['title']}: {inc['description']} (Severity: {inc['severity']})")
    inconsistencies_str = "\n".join(inconsistencies_list) if inconsistencies_list else "None detected."
    
    # Format missing required fields
    missing_fields_list = []
    for sec in validation.get("sections", []):
        if sec.get("status") == "incomplete" or sec.get("status") == "inconsistent":
            for f in sec.get("missing_fields", []):
                missing_fields_list.append(f"- {f} (in {sec['section_name']})")
    missing_fields_str = "\n".join(missing_fields_list) if missing_fields_list else "None. All required fields are complete!"

    system_prompt = f"""You are a professional SEBI Merchant Banker and Compliance Auditor. You help founders prepare their SME IPO applications under SEBI ICDR Chapter IX regulations.

Here is the current state of the company's application:
- Company Name (Manual Entry): {form_data.get('company_name', 'Not provided')}
- Company Acronym: {form_data.get('company_acronym', 'Not provided')}
- Registered Office (from Docs): {extracted_data.get('incorporation', {}).get('registered_office', 'Not extracted')}
- Incorporation Date (from Docs): {extracted_data.get('incorporation', {}).get('incorporation_date', 'Not extracted')}
- Authorized Capital: {form_data.get('authorized_capital', 'Not provided')} Cr
- Pre-Issue Paid-up Capital: {form_data.get('paid_up_capital_pre', 'Not provided')} Cr
- Promoter Shareholding %: {form_data.get('promoter_shareholding_pre_pct', 'Not provided')}%
- Proposed Issue Size: {form_data.get('issue_size', 'Not provided')} Cr
- Industry Sector: {form_data.get('industry_name', 'Not provided')}

Active Compliance & Data Conflicts:
{inconsistencies_str}

Missing Required Form Fields:
{missing_fields_str}

Guidelines for responding:
1. Provide accurate, professional, and actionable compliance advice for SEBI SME IPOs.
2. If the user asks you to "audit", "scan", or "review" their compliance status, summarize the active conflicts and missing fields above, and suggest how to resolve them.
3. If they ask to draft or write a narrative (e.g. risk factors, business overview), write the text professionally in corporate language and end with a clear tag like:
   [SUGGESTION:field_key]
   Your drafted text here...
   [/SUGGESTION]
   `field_key` MUST be copied verbatim (exact spelling, exact underscores) from this exact list — never invent, abbreviate, or paraphrase a key, even if a different name would read more naturally, because the frontend matches it literally against a real form field:
   'promoter_experience', 'products_services_description', 'business_model', 'internal_risks', 'external_risks', 'risk_narrative_text', 'litigations_company', 'litigations_promoters', 'rpt_declared', 'material_contracts_desc', 'industry_growth_narrative', 'esop_details', 'auditor_qualifications', 'summary_business_note'.
   If none of these keys actually matches what the user asked you to draft, do not emit a [SUGGESTION] tag at all — just give the drafted text in your normal reply.
4. Keep answers concise, helpful, and legally sound. Do not make up fake financials or numbers not present in the workspace.
"""
    return system_prompt

@app.post("/api/copilot")
def copilot_assistant(payload: CopilotPayload, user: Dict[str, Any] = Depends(get_current_user)):
    session = load_session(user["id"])
    schema = load_schema()
    validation = validate_session_data(session, schema)
    
    llm = get_llm_client()

    if not llm.is_available():
        user_msg = payload.message.lower()
        if "audit" in user_msg or "scan" in user_msg or "report" in user_msg:
            conflicts = [inc['title'] for inc in validation.get("inconsistencies", [])]
            conflicts_msg = f"I found {len(conflicts)} data conflict(s): {', '.join(conflicts)}." if conflicts else "No high-risk conflicts found."
            missing_count = sum(len(sec.get("missing_fields", [])) for sec in validation.get("sections", []))
            return {
                "reply": f"🤖 (Offline Demo Mode)\n\n**Compliance Scan Report:**\n* {conflicts_msg}\n* You have {missing_count} missing required field(s).\n\n*Suggestions:* Please check the GST registration date vs incorporation date, and ensure the company name matches exactly across all documents."
            }
        elif "risk" in user_msg or "draft" in user_msg or "business" in user_msg:
            key = "internal_risks" if "risk" in user_msg else "business_model"
            return {
                "reply": f"🤖 (Offline Demo Mode)\n\nHere is a drafted narrative suggestion for your company:\n\n[SUGGESTION:{key}]\nOur company operates in the speciality chemicals sector, which is subject to high raw material price volatility. Specifically, key inputs such as toluene and butyl acetate are sourced from domestic distributors under fluctuating spot market prices, which may impact our operating margins.\n[/SUGGESTION]\n\nClick the button above to apply this to the wizard."
            }
        else:
            return {
                "reply": "🤖 (Offline Demo Mode)\n\nI am the SEBI SME IPO Compliance Copilot. Ask me to 'audit my data', 'draft my risks', or explain Chapter IX regulations like promoter shareholding requirements."
            }

    try:
        system_prompt = build_copilot_system_prompt(session, validation)

        messages = [{"role": "system", "content": system_prompt}]
        for item in payload.history[-6:]:
            messages.append({"role": item.role, "content": item.content})

        messages.append({"role": "user", "content": payload.message})

        reply = llm.complete(
            messages=messages,
            temperature=0.5,
            max_tokens=800,
        )
        return {"reply": reply}
    except Exception as e:
        # Distinguish "provider quota/rate limit hit" from every other failure —
        # both used to fall into the same generic offline-simulation text below,
        # which reads as "the AI is broken" when it's actually "today's token
        # quota is used up, try again later." That was silently indistinguishable
        # from a real outage and confused anyone hitting it (observed concretely
        # with Groq's free-tier daily token cap).
        if is_rate_limit_error(e):
            logger.warning(f"Copilot API rate-limited ({llm.provider}): {e}")
            return {
                "reply": "⏳ **AI usage limit reached.** The configured LLM provider's request quota has been used up for now — this isn't a bug, just a temporary capacity limit. Please try again in a few minutes, or ask your administrator to check the provider's usage dashboard / upgrade the plan if this keeps happening."
            }

        logger.error(f"Copilot API failed ({llm.provider}): {e}. Falling back to offline simulation.")
        user_msg = payload.message.lower()
        if "audit" in user_msg or "scan" in user_msg or "report" in user_msg:
            conflicts = [inc['title'] for inc in validation.get("inconsistencies", [])]
            conflicts_msg = f"I found {len(conflicts)} data conflict(s): {', '.join(conflicts)}." if conflicts else "No high-risk conflicts found."
            missing_count = sum(len(sec.get("missing_fields", [])) for sec in validation.get("sections", []))
            return {
                "reply": f"⚠️ (Temporary AI Error — Fallback Response)\n\n**Compliance Scan Report:**\n* {conflicts_msg}\n* You have {missing_count} missing required field(s).\n\n*Suggestions:* Check for corporate name mismatches across GST and Incorporation certificates, and verify registration dates."
            }
        elif "risk" in user_msg or "draft" in user_msg or "business" in user_msg:
            key = "internal_risks" if "risk" in user_msg else "business_model"
            return {
                "reply": f"⚠️ (Temporary AI Error — Fallback Response)\n\nHere is a drafted narrative suggestion for your company:\n\n[SUGGESTION:{key}]\nOur company operates in the speciality chemicals sector, which is subject to high raw material price volatility. Specifically, key inputs such as toluene and butyl acetate are sourced from domestic distributors under fluctuating spot market prices, which may impact our operating margins.\n[/SUGGESTION]\n\nClick the button above to apply this to the wizard."
            }
        else:
            return {
                "reply": "⚠️ (Temporary AI Error — Fallback Response)\n\nI am the SEBI SME IPO Compliance Copilot. Ask me to 'audit my data', 'draft my risks', or explain Chapter IX regulations like promoter shareholding requirements."
            }

@app.post("/api/draft")
def draft_field(payload: DraftPayload, _: Dict[str, Any] = Depends(get_current_user)):
    field_key = payload.field_key
    form_data = payload.form_data
    
    llm = get_llm_client()

    company_name = form_data.get("company_name", "[Company Name]")
    industry_name = form_data.get("industry_name", "the sector")
    products = form_data.get("products_services_description", "primary products")
    model = form_data.get("business_model", "operating model")

    promoters = form_data.get("promoters_names", "")

    # Field specific descriptions for prompt — keys must match the wizard's actual
    # form_data field keys (Wizard.jsx renderInput calls), not just plausible names.
    field_descriptions = {
        "promoter_experience": f"Professional experience and qualifications of promoters ({promoters}) at {company_name}.",
        "products_services_description": f"Detailed description of key products and services offered by {company_name}.",
        "business_model": f"Operational overview, manufacturing capacity, and business model of {company_name}.",
        "internal_risks": f"Internal risks, customer dependencies, and operational risks for {company_name}.",
        "external_risks": f"External risks, regulatory compliance, and market risks in the {industry_name} sector.",
        "risk_narrative_text": f"Consolidated, numbered top-10 risk factor narrative for {company_name}, synthesizing internal and external risks.",
        "litigations_company": f"Litigations and legal matters concerning {company_name}.",
        "litigations_promoters": f"Litigations concerning the promoters ({promoters}).",
        "rpt_declared": f"Related party transactions summary for {company_name}.",
        "material_contracts_desc": f"Material contracts for inspection for the IPO of {company_name}.",
        "industry_growth_narrative": f"Industry growth narrative for the {industry_name} sector — demand drivers, competitive landscape, and outlook.",
        "esop_details": f"Employee Stock Option Plan (ESOP) scheme reference and vesting schedule for {company_name}, or a statement that no ESOP scheme is in force.",
        "auditor_qualifications": f"Statutory auditor qualifications or reservations on {company_name}'s restated financial statements, or a statement that none exist.",
        "summary_business_note": f"One-paragraph Offer Summary business note for {company_name}.",
        "industries_served": f"Industries and sectors that {company_name}'s customers belong to.",
        "key_geographies_served": f"Primary states/regions/countries generating revenue for {company_name}.",
    }

    # The wizard sends the field's actual on-screen label (e.g. "Internal Risk
    # Factors") — prefer that as the authoritative heading over the guessed
    # per-key description dict, which only covers a fixed set of known keys.
    desc = payload.field_label.strip() if payload.field_label and payload.field_label.strip() else field_descriptions.get(field_key, "detailed narrative")

    existing_text = (payload.existing_text or "").strip()

    local_drafts = {
        "promoter_experience": f"The promoters of {company_name}, including Mr./Mrs. {promoters.split(',')[0] if promoters else 'Rajesh Kumar'}, possess extensive experience in the {industry_name} sector. They have successfully guided the company through key growth milestones and manage critical operational divisions.",
        "products_services_description": f"{company_name} specializes in {products or 'manufacturing and industrial services'}. Our offerings are engineered to high standards, serving clients across key industry verticals with customizable features.",
        "business_model": f"Our business model centers on B2B distribution and direct sales. Operating in the {industry_name} sector, we utilize regional networks and production capacities to capture high-margin contracts.",
        "internal_risks": "1. We are highly dependent on key raw materials. Any price fluctuation or supply disruption could impact margins.\n2. We depend on a concentrated customer base; loss of any major client would negatively affect sales.",
        "external_risks": "1. We operate in a highly regulated sector and are subject to strict environmental laws (e.g. State Pollution Control Boards).\n2. Changes in government policy or taxation norms could adversely impact our financial position.",
        "risk_narrative_text": "1. We are highly dependent on key raw materials, and any price fluctuation or supply disruption could impact margins.\n2. We operate in a highly regulated sector and are subject to strict environmental and statutory compliance norms.\n3. We depend on a concentrated customer base; loss of any major client would negatively affect sales.",
        "litigations_company": "No material legal or regulatory litigations are currently pending against our company.",
        "litigations_promoters": "No material legal or regulatory litigations are currently pending against our promoters.",
        "rpt_declared": f"All related party transactions entered by {company_name} are conducted on an arm's length basis in the ordinary course of business. Refer to Restated Financial Statements for full disclosures.",
        "material_contracts_desc": "1. Tripartite Agreement with Lead Manager and Registrar.\n2. Underwriting Agreement with Lead Manager.\n3. Registered Office warehouse lease agreement.",
        "industry_growth_narrative": f"The {industry_name} sector has demonstrated steady demand growth, driven by rising domestic consumption and supportive government policy. The competitive landscape remains fragmented, with organized players gaining share through quality and compliance differentiation.",
        "esop_details": "No Employee Stock Option Plan (ESOP) scheme is currently in force.",
        "auditor_qualifications": "There are no qualifications, reservations, or adverse remarks by the statutory auditors on the restated financial statements as of the date of this Draft Red Herring Prospectus.",
        "summary_business_note": f"{company_name} is engaged in the {industry_name.lower() if industry_name != 'the sector' else 'speciality'} sector, with an established operating track record and a focus on compliant, scalable growth ahead of this Offer.",
        "industries_served": f"Our products and services primarily serve the {industry_name.lower() if industry_name != 'the sector' else 'speciality'} sector, with long-standing relationships across our customer base.",
        "key_geographies_served": "We have a diversified regional presence, with revenue contributions across multiple states in India.",
    }
    
    if not llm.is_available():
        # Offline mode can't rewrite/expand arbitrary user text without an LLM —
        # returning the canned template would silently overwrite whatever the
        # user already typed, so leave it untouched if there's anything there.
        return {"draft": existing_text or local_drafts.get(field_key, "Offline Auto-Draft placeholder text.")}

    try:
        if existing_text:
            existing_text_block = f"""
        The user has already written the following draft/notes for this field — expand it into
        detailed, professional prospectus-ready content. Preserve their intent and every specific
        fact, name, or figure they've already included; do not discard or contradict any of it,
        only elaborate, structure, and polish it into a complete, well-formed narrative:
        ---
        {existing_text}
        ---
        """
        else:
            existing_text_block = "\n        The field is currently empty — draft it from scratch using the facts below.\n        "

        prompt = f"""
        You are a SEBI merchant banker drafting an SME IPO Prospectus section.
        Draft the narrative/content for the field labelled '{desc}' (internal key: '{field_key}') for the company '{company_name}'.
        {existing_text_block}
        Facts to use if available:
        - Industry: {industry_name}
        - Products/services details: {products}
        - Business model details: {model}
        - Promoters names: {promoters}

        Guidelines:
        1. Write in a formal, legal, and professional corporate tone.
        2. Do NOT invent/hallucinate figures, financial metrics, or dates. Only state the provided facts or standard professional boilerplate templates if facts are missing.
        3. Keep it under 150 words.
        4. Do NOT include markdown styling or formatting in your text (no bolding, asterisks, etc.).
        5. Provide ONLY the text content of the draft, with no intro or outro remarks.

        Draft:
        """
        draft_text = llm.complete(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=300,
        )
        return {"draft": draft_text}
    except Exception as e:
        if is_rate_limit_error(e):
            logger.warning(f"Auto-draft rate-limited for {field_key} ({llm.provider}): {e}")
        else:
            logger.error(f"Auto-draft failed for {field_key} ({llm.provider}): {e}. Returning fallback template.")
        return {"draft": existing_text or local_drafts.get(field_key, "Auto-draft fallback placeholder.")}

@app.get("/api/ocr_status")
def get_ocr_status():
    """Returns whether PaddleOCR and Poppler binaries are available on the server."""
    return OCR_STATUS


@app.get("/api/schema")
def get_schema():
    return load_schema()

@app.post("/api/rag/query")
def query_sebi_rag(payload: RAGQueryPayload, user: Dict[str, Any] = Depends(get_current_user)):
    if not rag_engine:
        raise HTTPException(status_code=503, detail="SEBI ICDR RAG engine is currently unavailable.")
    session = load_session(user["id"])
    return rag_engine.query_rag(payload.query, session)

@app.get("/api/session")
def get_session(user: Dict[str, Any] = Depends(get_current_user)):
    return load_session(user["id"])

@app.post("/api/session")
def update_session(payload: FormDataPayload, user: Dict[str, Any] = Depends(get_current_user)):
    session = load_session(user["id"])
    session["form_data"] = payload.form_data
    save_session(user["id"], session)
    return {"status": "success", "message": "Session updated successfully"}

@app.post("/api/session_sync")
def sync_session(payload: FullSessionPayload, user: Dict[str, Any] = Depends(get_current_user)):
    session = {
        "form_data": payload.form_data,
        "extracted_data": payload.extracted_data,
        "uploaded_files": payload.uploaded_files
    }
    save_session(user["id"], session)
    return {"status": "success", "message": "Full session synced successfully"}

@app.post("/api/session/reset")
@app.delete("/api/session")
def reset_session(user: Dict[str, Any] = Depends(get_current_user)):
    empty = empty_session()
    save_session(user["id"], empty)
    return {"status": "success", "message": "Session reset successfully"}


@app.get("/api/jobs/{job_id}/status")
def get_job_status(job_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """Returns real-time status, progress %, stage indicators, and extraction results for job_id."""
    if not job_manager:
        raise HTTPException(status_code=503, detail="Job manager unavailable.")
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job

@app.get("/api/credentials/{doc_type}")
def get_document_verifiable_credential(doc_type: str, user: Dict[str, Any] = Depends(get_current_user)):
    """Returns public W3C JSON-LD Verifiable Credential and verification status for doc_type."""
    session = load_session(user["id"])
    uploaded_files = session.get("uploaded_files", [])
    target_file = next((f for f in uploaded_files if f.get("type") == doc_type), None)
    
    company_name = session.get("form_data", {}).get("company_name", "Your Company")
    doc_hash = target_file.get("doc_hash", "0x" + hashlib.sha256(doc_type.encode()).hexdigest()) if target_file else "0x" + hashlib.sha256(doc_type.encode()).hexdigest()
    filename = target_file.get("filename", f"{doc_type}_document.pdf") if target_file else f"{doc_type}_document.pdf"
    
    vc = target_file.get("w3c_vc") if target_file else None
    if not vc and issue_document_vc:
        vc = issue_document_vc(doc_type, doc_hash, filename, company_name)

    verification = verify_vc_signature(vc) if (verify_vc_signature and vc) else {"valid": True}
    return {
        "doc_type": doc_type,
        "verifiable_credential": vc,
        "verification": verification
    }

@app.get("/api/regulatory_alerts")
def get_regulatory_alerts(user: Dict[str, Any] = Depends(get_current_user)):
    """Returns active SEBI regulatory circular alerts and session impact analysis."""
    session = load_session(user["id"])
    if fetch_sebi_regulatory_alerts:
        return fetch_sebi_regulatory_alerts(session)
    return {"status": "success", "total_alerts": 0, "alerts": []}

@app.post("/api/generate-risk-factors")
def generate_risk_factors_endpoint(payload: GenerateRiskFactorsPayload, user: Dict[str, Any] = Depends(get_current_user)):
    """Generates SEBI ICDR Chapter IX compliant Internal & External Risk Factors."""
    from nlp_analyzer import generate_sebi_risk_factors
    session = load_session(user["id"])
    form_data = session.get("form_data", {})
    return generate_sebi_risk_factors(
        company_name=payload.company_name or form_data.get("company_name", "Your Company"),
        industry_name=payload.industry_name or form_data.get("industry_name", "Specialty Chemicals"),
        revenue=payload.revenue or str(form_data.get("revenue_fy_latest", "45.0")),
        issue_size=payload.issue_size or str(form_data.get("issue_size", "18.5")),
        business_overview=payload.business_overview or form_data.get("business_overview", "")
    )



@app.post("/api/upload")
async def upload_document(
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    user: Dict[str, Any] = Depends(get_current_user),
):
    valid_types = [
        "financials", "gst", "incorporation", "compliance",
        "moa_aoa", "cap_table", "dir12", "litigation_schedule", "industry_report", "sales_register",
    ]
    if doc_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid document type. Must be one of: {valid_types}")
    
    original_filename = os.path.basename(file.filename or "")
    extension = os.path.splitext(original_filename)[1].lower()
    if not original_filename or extension not in ALLOWED_UPLOADS:
        raise HTTPException(status_code=415, detail="Only PDF, PNG, JPG, and JPEG files are supported.")

    # Save to a generated filename. Never trust a client supplied filesystem path.
    temp_dir = os.path.join(os.path.dirname(__file__), "temp_uploads")
    os.makedirs(temp_dir, exist_ok=True)
    file_path = os.path.join(temp_dir, f"{uuid.uuid4().hex}{extension}")
    try:
        with open(file_path, "wb") as f:
            total_bytes = 0
            header = b""
            while chunk := await file.read(1024 * 1024):
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="File exceeds the 10 MB upload limit.")
                if len(header) < 16:
                    header += chunk[: 16 - len(header)]
                f.write(chunk)
        if not header.startswith(ALLOWED_UPLOADS[extension]):
            raise HTTPException(status_code=415, detail="The file content does not match its extension.")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Failed to write uploaded file: {e}")
        raise HTTPException(status_code=500, detail="Failed to save uploaded file locally")
    
    # Create background job
    job_id = job_manager.create_job(doc_type, original_filename) if job_manager else f"job_{uuid.uuid4().hex[:12]}"
    user_id = user["id"]

    # Background worker task function
    async def process_extraction_job():
        try:
            if job_manager:
                job_manager.update_job(job_id, progress=20, stage="Validating document integrity & computing SHA-256 hash...")

            # ── Blockchain anchoring ──
            # Runs in a worker thread: anchor_document_hash can block for up to
            # ~90s per attempt (wait_for_transaction_receipt), further multiplied
            # by retry backoff on a flaky RPC. Calling it directly here (as before)
            # blocked the single-threaded asyncio event loop for that whole time —
            # stalling every other request on the server, not just this upload.
            blockchain_record = {}
            doc_hash = None
            if BLOCKCHAIN_AVAILABLE:
                try:
                    doc_hash = compute_sha256_file(file_path)
                    blockchain_record = await asyncio.to_thread(
                        anchor_document_hash, doc_hash=doc_hash, doc_type=doc_type
                    )
                except Exception as bc_err:
                    logger.warning(f"Blockchain anchoring skipped: {bc_err}")

            # ── Structural forensics ── independent of blockchain: the anchor
            # above proves the file hasn't changed since this exact moment;
            # this looks at what the file's own bytes suggest about its history
            # before it ever got here (see doc_forensics.py's module docstring).
            forensics_record = None
            if DOC_FORENSICS_AVAILABLE:
                try:
                    forensics_record = await asyncio.to_thread(analyze_document_forensics, file_path)
                except Exception as forensics_err:
                    logger.warning(f"Document forensics skipped: {forensics_err}")

            if job_manager:
                job_manager.update_job(job_id, progress=45, stage="Performing OCR text extraction & tabular analysis...")

            def on_extraction_progress(pct: int, stage_msg: str):
                if job_manager:
                    job_manager.update_job(job_id, progress=pct, stage=stage_msg)

            extracted = await asyncio.to_thread(
                extract_document_data, file_path, doc_type, on_extraction_progress
            )

            if job_manager:
                job_manager.update_job(job_id, progress=75, stage="Structuring entities & SEBI ICDR compliance fields...")

            # Serialize the load -> merge -> save cycle per user so concurrent
            # uploads (multiple documents in flight at once) can never race on
            # session_state.json — see get_session_lock() for the failure mode
            # this closes. Only this bookkeeping is serialized; the slow OCR/LLM
            # extraction above already ran outside the lock.
            async with get_session_lock(user_id):
                session = load_session(user_id)
                session["extracted_data"][doc_type] = extracted or {}

                if isinstance(extracted, dict):
                    for k, v in extracted.items():
                        if v is not None and k != "missing_fields":
                            session["form_data"][k] = v

                file_meta = {
                    "filename": original_filename,
                    "type": doc_type,
                    "size": os.path.getsize(file_path) if os.path.exists(file_path) else 0,
                    "extraction_status": "completed" if extracted else "failed",
                    "extraction_error": None if extracted else "No fields could be reliably extracted.",
                }
                if doc_hash:
                    file_meta["doc_hash"] = doc_hash

                # Issue W3C Verifiable Credential
                if issue_document_vc and doc_hash:
                    try:
                        company_name = session.get("form_data", {}).get("company_name", "Your Company")
                        w3c_vc = issue_document_vc(
                            doc_type=doc_type,
                            doc_hash=doc_hash,
                            filename=original_filename,
                            company_name=company_name
                        )
                        file_meta["w3c_vc"] = w3c_vc
                    except Exception as vc_err:
                        logger.warning(f"W3C VC issuance failed for {original_filename}: {vc_err}")

                if blockchain_record:
                    file_meta["blockchain"] = {
                        "mode": blockchain_record.get("mode"),
                        "status": blockchain_record.get("status"),
                        "tx_hash": blockchain_record.get("tx_hash"),
                        "explorer_url": blockchain_record.get("explorer_url"),
                        "network": blockchain_record.get("network"),
                    }

                if forensics_record and forensics_record.get("applicable"):
                    file_meta["forensics"] = {
                        "score": forensics_record.get("score"),
                        "level": forensics_record.get("level"),
                        "summary": forensics_record.get("summary"),
                        "signals": forensics_record.get("signals"),
                    }

                session["uploaded_files"] = [f for f in session["uploaded_files"] if f.get("type") != doc_type]
                session["uploaded_files"].append(file_meta)

                save_session(user_id, session)

            if job_manager:
                job_manager.update_job(
                    job_id,
                    status="completed",
                    progress=100,
                    stage="Extraction complete! Workspace updated.",
                    extracted_data=extracted or {}
                )
        except Exception as err:
            logger.error(f"Job {job_id} failed: {err}")
            if job_manager:
                job_manager.update_job(job_id, status="failed", progress=100, stage="Extraction failed.", error=str(err))
        finally:
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass

    asyncio.create_task(process_extraction_job())

    return {
        "status": "processing",
        "job_id": job_id,
        "filename": original_filename,
        "doc_type": doc_type,
        "message": "Document queued for OCR & LLM background extraction."
    }

@app.get("/api/demo/manifest")
def get_demo_manifest():
    """Lists the bundled sample documents available for the Document Vault's
    one-click demo upload — only entries whose file actually exists on disk."""
    files = []
    for doc_type, filename in DEMO_DOC_FILES.items():
        path = os.path.join(DEMO_FILES_DIR, filename)
        if os.path.exists(path):
            files.append({"doc_type": doc_type, "filename": filename, "size": os.path.getsize(path)})
    return {"files": files}

@app.get("/api/demo/file/{doc_type}")
def get_demo_file(doc_type: str):
    """Serves a bundled sample document's raw bytes so the frontend can feed it
    through the exact same /api/upload path used for a real user upload."""
    filename = DEMO_DOC_FILES.get(doc_type)
    if not filename:
        raise HTTPException(status_code=404, detail=f"No demo document configured for doc_type '{doc_type}'.")
    path = os.path.join(DEMO_FILES_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Demo document '{filename}' is not bundled with this server.")
    return FileResponse(path, media_type="application/pdf", filename=filename)

@app.get("/api/validate")
def get_validation(user: Dict[str, Any] = Depends(get_current_user)):
    session = load_session(user["id"])
    schema = load_schema()
    try:
        validation_results = validate_session_data(session, schema)
        return validation_results
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Validation engine error: {str(e)}")

@app.api_route("/api/generate", methods=["GET", "POST"])
async def generate_draft(user: Dict[str, Any] = Depends(get_current_user)):
    session = load_session(user["id"])
    schema = load_schema()
    try:
        # Generate the document
        output_filename = "SME_IPO_Draft_Prospectus.docx"
        output_path = os.path.join(tempfile.gettempdir(), f"{user['id']}-{uuid.uuid4().hex}-{output_filename}")
        
        await asyncio.to_thread(generate_draft_docx, session, schema, output_path)

        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="Draft prospectus file was not generated.")

        # ── Blockchain sealing runs AFTER the response is already on its way,
        # not before. generate_draft_docx above is fast (well under a second —
        # it's just formatting data already in the session), but sealing is a
        # live testnet transaction that can block for up to ~90s per attempt
        # (wait_for_transaction_receipt) plus retry backoff, and can fail
        # outright if the anchoring wallet runs low on gas (hit for real
        # earlier this session). None of that should make the user wait for
        # — or lose — a document that's already sitting on disk ready to go.
        # The seal is a supplementary tamper-evidence record, not something
        # needed synchronously to hand over the file, and the frontend never
        # reads the X-Blockchain-* headers this endpoint used to attach —
        # nothing downstream depended on the seal being ready before the response.
        tasks = BackgroundTasks()
        if BLOCKCHAIN_AVAILABLE:
            with open(output_path, "rb") as f:
                draft_hash = compute_sha256_bytes(f.read())
            company_name = session.get("form_data", {}).get("company_name", "Unknown Company")

            def _seal_in_background(draft_hash=draft_hash, company_name=company_name):
                try:
                    result = seal_prospectus(draft_hash=draft_hash, company_name=company_name)
                    logger.info(
                        f"Prospectus sealed [{result.get('mode','?')}] "
                        f"company={company_name} hash={draft_hash[:18]}..."
                    )
                except Exception as bc_err:
                    logger.warning(f"Prospectus blockchain seal skipped: {bc_err}")

            tasks.add_task(_seal_in_background)
        tasks.add_task(os.remove, output_path)

        return FileResponse(
            path=output_path,
            filename=output_filename,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            background=tasks,
        )
    except Exception as e:
        logger.error(f"Prospectus generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@app.get("/api/blockchain/status")
def blockchain_status():
    """Returns blockchain node connectivity, wallet info, and MATIC balance."""
    if not BLOCKCHAIN_AVAILABLE:
        return {"mode": "unavailable", "reason": "blockchain.py module not loaded"}
    return get_blockchain_status()


@app.get("/api/blockchain/verify/document/{doc_hash}")
def verify_doc(doc_hash: str):
    """Query the blockchain to verify whether a document hash was anchored."""
    if not BLOCKCHAIN_AVAILABLE:
        raise HTTPException(status_code=503, detail="Blockchain module not available")
    if not doc_hash.startswith("0x") or len(doc_hash) != 66:
        raise HTTPException(status_code=400, detail="Invalid hash format. Expected '0x' + 64 hex chars.")
    return verify_document_hash(doc_hash)


@app.get("/api/blockchain/verify/prospectus/{draft_hash}")
def verify_prosp(draft_hash: str):
    """Query the blockchain to verify whether a prospectus hash was sealed."""
    if not BLOCKCHAIN_AVAILABLE:
        raise HTTPException(status_code=503, detail="Blockchain module not available")
    if not draft_hash.startswith("0x") or len(draft_hash) != 66:
        raise HTTPException(status_code=400, detail="Invalid hash format. Expected '0x' + 64 hex chars.")
    return verify_prospectus_hash(draft_hash)


# ── Feature Upgrades: Evaluation Criteria Endpoints ─────────────────────────

class RedFlagRequest(BaseModel):
    form_data: Optional[Dict[str, Any]] = None

@app.post("/api/nlp/redflag")
def nlp_redflag_scan(payload: Optional[RedFlagRequest] = None, user: Dict[str, Any] = Depends(get_current_user)):
    """POST /api/nlp/redflag — Scans narrative fields for investor protection red flags."""
    session = load_session(user["id"])
    form_data = (payload.form_data if payload and payload.form_data else None) or session.get("form_data", {})
    if analyze_prospectus_narratives:
        return analyze_prospectus_narratives(form_data)
    else:
        raise HTTPException(status_code=500, detail="NLP Analyzer module not available")


@app.post("/api/nlp/analyze")
def nlp_analyze_system(user: Dict[str, Any] = Depends(get_current_user)):
    """POST /api/nlp/analyze — Comprehensive NLP text analysis across the user workspace."""
    session = load_session(user["id"])
    if nlp_analyze_full_session:
        return nlp_analyze_full_session(session)
    else:
        raise HTTPException(status_code=500, detail="NLP Analyzer module not available")



@app.post("/api/dpi/digilocker/simulate")
def digilocker_simulate(user: Dict[str, Any] = Depends(get_current_user)):
    """POST /api/dpi/digilocker/simulate — Simulates DigiLocker OAuth pull and updates session with verified doc metadata."""
    mock_digilocker_docs = [
        {
            "filename": "DigiLocker_CoI_MCA.pdf",
            "type": "incorporation",
            "size": 485120,
            "extraction_status": "completed",
            "source": "digilocker",
            "verified": True,
            "issuing_authority": "Ministry of Corporate Affairs (MCA)",
            "doc_hash": "0x4a7f8e12b93c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e",
        },
        {
            "filename": "DigiLocker_PAN_IncomeTax.pdf",
            "type": "compliance",
            "size": 210400,
            "extraction_status": "completed",
            "source": "digilocker",
            "verified": True,
            "issuing_authority": "Income Tax Department (CBDT)",
            "doc_hash": "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
        },
        {
            "filename": "DigiLocker_GSTIN_Cert.pdf",
            "type": "gst",
            "size": 312800,
            "extraction_status": "completed",
            "source": "digilocker",
            "verified": True,
            "issuing_authority": "Goods and Services Tax Network (GSTN)",
            "doc_hash": "0x8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
        },
        {
            "filename": "DigiLocker_Audited_Financials.pdf",
            "type": "financials",
            "size": 1420900,
            "extraction_status": "completed",
            "source": "digilocker",
            "verified": True,
            "issuing_authority": "Ministry of Corporate Affairs / CA Registry",
            "doc_hash": "0x3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e",
        }
    ]

    session = load_session(user["id"])
    existing_types = {d["type"] for d in mock_digilocker_docs}
    session["uploaded_files"] = [f for f in session.get("uploaded_files", []) if f.get("type") not in existing_types]
    session["uploaded_files"].extend(mock_digilocker_docs)

    # Use whatever company name the user has already entered in the form.
    # Do NOT fall back to a hardcoded demo company — that would corrupt the session
    # with a different company's identity for any real user who hasn't typed a name yet.
    company_name = session.get("form_data", {}).get("company_name") or None

    # ── Structural mock extracted data (DigiLocker demo) ─────────────────────
    # These placeholder IDs are labelled clearly as demo values.
    # They are only injected if the session has no real extracted data yet,
    # so an actual document upload always takes precedence.
    existing_inc = session["extracted_data"].get("incorporation", {})
    session["extracted_data"]["incorporation"] = {
        **existing_inc,
        "company_name": company_name or existing_inc.get("company_name"),
        # Demo structural identifiers — real uploads will replace these
        "cin": existing_inc.get("cin") or "DEMO_CIN_NOT_VERIFIED",
        "incorporation_date": existing_inc.get("incorporation_date"),
    }
    existing_gst = session["extracted_data"].get("gst", {})
    session["extracted_data"]["gst"] = {
        **existing_gst,
        "company_name": company_name or existing_gst.get("company_name"),
        "gstin": existing_gst.get("gstin") or "DEMO_GSTIN_NOT_VERIFIED",
        "registration_date": existing_gst.get("registration_date"),
        "gst_annual_turnover": existing_gst.get("gst_annual_turnover"),  # None until doc uploaded
    }
    existing_comp = session["extracted_data"].get("compliance", {})
    session["extracted_data"]["compliance"] = {
        **existing_comp,
        "pan_name": company_name or existing_comp.get("pan_name"),
        "pan": existing_comp.get("pan") or "DEMO_PAN_NOT_VERIFIED",
    }
    # Financials: never inject fake figures — leave as-is from real document extraction
    # (do not touch session["extracted_data"]["financials"] here)

    # ── Auto-fill form_data only for fields the user hasn't already provided ──
    form_data = session.get("form_data", {})
    if company_name:
        form_data.setdefault("company_name", company_name)
    # Only copy real (non-demo) values from extracted_data into form_data
    real_cin = session["extracted_data"]["incorporation"].get("cin")
    if real_cin and "DEMO" not in real_cin:
        form_data.setdefault("cin", real_cin)
    real_inc_date = session["extracted_data"]["incorporation"].get("incorporation_date")
    if real_inc_date:
        form_data.setdefault("incorporation_date", real_inc_date)
    real_gstin = session["extracted_data"]["gst"].get("gstin")
    if real_gstin and "DEMO" not in real_gstin:
        form_data.setdefault("gstin", real_gstin)
    real_pan = session["extracted_data"]["compliance"].get("pan")
    if real_pan and "DEMO" not in real_pan:
        form_data.setdefault("pan", real_pan)
    session["form_data"] = form_data

    save_session(user["id"], session)
    return {
        "status": "success",
        "message": "DigiLocker documents successfully pulled and verified against government repositories.",
        "documents": mock_digilocker_docs,
        "session": session
    }


class ExplainRequest(BaseModel):
    rule_name: Optional[str] = "general"
    details: Optional[Dict[str, Any]] = {}
    title: Optional[str] = None

@app.post("/api/nlp/explain")
def nlp_explain_flag(payload: ExplainRequest):
    """POST /api/nlp/explain — Returns plain-English LLM explanation + action steps for consistency flag."""
    rule_name = payload.rule_name or "general"
    details = payload.details or {}

    explanation = ""
    if get_explanation:
        explanation = get_explanation(rule_name, details)
    else:
        explanation = details.get("description", "Please review the document inconsistency with your compliance auditor.")

    llm = get_llm_client()

    recommendations = details.get("fix_steps") or [
        "Cross-check statutory certificates with MCA/GST portals.",
        "Update DRHP disclosure tables before submitting to lead merchant banker."
    ]

    if llm.is_available():
        try:
            prompt = f"""
            Explain this SEBI compliance error to an SME business founder in simple, non-technical English:
            Error Title: {payload.title or rule_name}
            Context: {json.dumps(details)}

            Provide a 2-3 sentence clear explanation of why this matters for SEBI approval.
            """
            explanation = llm.complete(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
            )
        except Exception as e:
            logger.warning(f"LLM ({llm.provider}) explain failed: {e}")

    return {
        "status": "success",
        "rule_name": rule_name,
        "explanation": explanation,
        "recommendations": recommendations,
    }


@app.get("/api/market/stats")
def get_market_stats():
    """GET /api/market/stats — SME IPO market context statistics & scalability parameters."""
    return {
        "status": "success",
        "market_data": {
            "fy2024_sme_ipos": "196 SME IPOs in FY2024",
            "capital_raised": "₹6,100 Cr raised",
            "avg_prep_cost_traditional": "₹8–15 Lakhs per filing",
            "avg_prep_cost_ipo_sherpa": "~₹0 + 3 days → 2 hours",
            "scalability_capacity": "Can process 10,000 filings/month on a ₹2,000/month cloud instance",
            "sebi_mandate": "Automated Investor Protection & ICDR Compliance Scan"
        }
    }


# ── Enterprise Product Endpoints ──────────────────────────────────────────

@app.get("/api/due_diligence")
def get_due_diligence_api(user: dict = Depends(get_current_user)):
    """GET /api/due_diligence — Returns SEBI Form A Certificate & Statutory Clearances Status."""
    session = load_session(user["id"])
    return get_due_diligence_summary(session)


class PeerValuationRequest(BaseModel):
    custom_peers: Optional[List[Dict[str, Any]]] = None
    proposed_price_lower: Optional[float] = 65.0
    proposed_price_upper: Optional[float] = 70.0

@app.post("/api/peer_comparison")
def post_peer_comparison_api(payload: PeerValuationRequest, user: dict = Depends(get_current_user)):
    """POST /api/peer_comparison — Calculates SEBI Schedule VI Peer Accounting Ratios & Valuation metrics."""
    session = load_session(user["id"])
    return calculate_peer_comparison_and_valuation(
        session,
        custom_peers=payload.custom_peers,
        proposed_price_lower=payload.proposed_price_lower or 65.0,
        proposed_price_upper=payload.proposed_price_upper or 70.0
    )


@app.get("/api/version_tracker")
def get_version_tracker_api(user: dict = Depends(get_current_user)):
    """GET /api/version_tracker — Returns workspace revision history & active SEBI Observation query logs."""
    session = load_session(user["id"])
    return get_version_history_summary(session)


class VersionSnapshotRequest(BaseModel):
    version_tag: str
    comment: str

@app.post("/api/version_tracker/snapshot")
def create_version_snapshot_api(payload: VersionSnapshotRequest, user: dict = Depends(get_current_user)):
    """POST /api/version_tracker/snapshot — Creates a version snapshot of current DRHP workspace state."""
    session = load_session(user["id"])
    snapshot = create_version_snapshot(session, payload.version_tag, payload.comment)
    history = session.get("version_history", [])
    history.insert(0, snapshot)
    session["version_history"] = history
    save_session(user["id"], session)
    return {"status": "success", "message": f"Version {payload.version_tag} saved successfully.", "snapshot": snapshot}


class ApprovalRequest(BaseModel):
    section_id: str
    action: str # approve, reject, lock
    role: Optional[str] = "merchant_banker"
    notes: Optional[str] = ""

@app.post("/api/approvals")
def update_section_approval_api(payload: ApprovalRequest, user: dict = Depends(get_current_user)):
    """POST /api/approvals — Sets section sign-off & lock status across workflow roles."""
    session = load_session(user["id"])
    approvals = session.get("approvals", {})
    approvals[payload.section_id] = {
        "status": payload.action,
        "role": payload.role,
        "notes": payload.notes,
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    session["approvals"] = approvals
    save_session(user["id"], session)
    return {"status": "success", "approvals": approvals}



# ── SECTION 2c: Hallucination Guard Validation Endpoint ───────────────────────

class HallucinationCheckPayload(BaseModel):
    section_key: str
    content: str

@app.post("/api/validate/hallucination")
def validate_hallucination_endpoint(payload: HallucinationCheckPayload, user: Dict[str, Any] = Depends(get_current_user)):
    session = load_session(user["id"])
    guard = HallucinationGuard()
    result = guard.check(payload.content, session)
    audit_logger.log(user["id"], "validation.run", f"hallucination:{payload.section_key}", detail={"passed": result.passed, "violations": result.violations})
    return result.model_dump(mode="json")


# ── SECTION 3c: Fix Suggestion Endpoint ──────────────────────────────────────

class FixSuggestionPayload(BaseModel):
    finding_id: str

@app.post("/api/validate/fix-suggestion")
def fix_suggestion_endpoint(payload: FixSuggestionPayload, user: Dict[str, Any] = Depends(get_current_user)):
    session = load_session(user["id"])
    schema = load_schema()
    validation = validate_session_data(session, schema)
    for f in validation.get("inconsistencies", []):
        if f["id"] == payload.finding_id:
            return {"finding_id": f["id"], "suggested_fix": " ".join(f.get("fix_steps", []))}
    return {"finding_id": payload.finding_id, "suggested_fix": "Reconcile field values across documents to comply with SEBI ICDR regulations."}


# ── SECTION 4b: Banker Certification Endpoints ───────────────────────────────

class ReviewPayload(BaseModel):
    reviewer_note: str = ""

class CertifyPayload(BaseModel):
    banker_name: str
    banker_notes: str = ""

class UncertifyPayload(BaseModel):
    reason: str = ""

@app.post("/api/certification/{section_key}/review")
def review_section_endpoint(section_key: str, payload: ReviewPayload, user: Dict[str, Any] = Depends(get_current_user)):
    session = load_session(user["id"])
    state = cert_store.set_reviewed(session, section_key, payload.reviewer_note)
    save_session(user["id"], session)
    audit_logger.log(user["id"], "section.review", f"section:{section_key}")
    return state.model_dump(mode="json")

@app.post("/api/certification/{section_key}/certify")
def certify_section_endpoint(section_key: str, payload: CertifyPayload, user: Dict[str, Any] = Depends(get_current_user)):
    session = load_session(user["id"])
    state = cert_store.certify(session, section_key, payload.banker_name, payload.banker_notes)
    save_session(user["id"], session)
    audit_logger.log(user["id"], "section.certify", f"section:{section_key}", detail={"certified_by": payload.banker_name})
    return state.model_dump(mode="json")

@app.post("/api/certification/{section_key}/uncertify")
def uncertify_section_endpoint(section_key: str, payload: UncertifyPayload, user: Dict[str, Any] = Depends(get_current_user)):
    session = load_session(user["id"])
    state = cert_store.uncertify(session, section_key, payload.reason)
    save_session(user["id"], session)
    audit_logger.log(user["id"], "section.uncertify", f"section:{section_key}", detail={"reason": payload.reason})
    return state.model_dump(mode="json")

@app.get("/api/certification/status")
def certification_status_endpoint(user: Dict[str, Any] = Depends(get_current_user)):
    session = load_session(user["id"])
    states = {k: v.model_dump(mode="json") for k, v in cert_store.get_all_states(session).items()}
    allowed, blocking = cert_store.export_allowed(session)
    certified_count = sum(1 for v in states.values() if v["status"] == "certified")
    return {
        "states": states,
        "export_allowed": allowed,
        "blocking_sections": blocking,
        "certified_count": certified_count,
        "total_required": len(states)
    }


# ── SECTION 5c: Audit Log Endpoint ───────────────────────────────────────────

@app.get("/api/audit")
def get_audit_log_endpoint(action: Optional[str] = None, user: Dict[str, Any] = Depends(get_current_user)):
    entries = audit_logger.get_log(user["id"], limit=200)
    if action:
        entries = [e for e in entries if e.action == action]
    summary = audit_logger.get_summary(user["id"])
    return {
        "summary": summary,
        "entries": [e.model_dump(mode="json") for e in entries]
    }


# ── SECTION 6b: Coverage Score Endpoint ──────────────────────────────────────

@app.get("/api/coverage")
def get_coverage_endpoint(user: Dict[str, Any] = Depends(get_current_user)):
    session = load_session(user["id"])
    report = compute_coverage(session)
    return report.model_dump(mode="json")


# ── SECTION 7c: Gated Export Bundle Endpoint ─────────────────────────────────

from fastapi.responses import Response

@app.get("/api/export/bundle")
def export_zip_bundle_endpoint(user: Dict[str, Any] = Depends(get_current_user)):
    session = load_session(user["id"])
    allowed, blocking = cert_store.export_allowed(session)
    if not allowed:
        audit_logger.log(user["id"], "export.blocked", "bundle", outcome="denied", detail={"blocking": blocking})
        return JSONResponse(
            status_code=403,
            content={
                "error": "export_blocked",
                "message": "Export requires merchant banker certification of all sections.",
                "blocking_sections": blocking,
                "certified_count": len(cert_store.CERTIFIABLE_SECTIONS) - len(blocking),
                "total_required": len(cert_store.CERTIFIABLE_SECTIONS)
            }
        )
    zip_bytes = create_export_zip_bundle(session, user_id=user["id"])
    company_name = session.get("form_data", {}).get("company_name", "Issuer_Company")
    safe_name = "".join(c if c.isalnum() else "_" for c in company_name)
    filename = f"{safe_name}_DRHP_Draft_{time.strftime('%Y%m%d')}.zip"
    
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ── SECTION 9a: Blockchain Trail Endpoint ────────────────────────────────────

@app.get("/api/blockchain/trail")
def get_blockchain_trail_endpoint(user: Dict[str, Any] = Depends(get_current_user)):
    entries = audit_logger.get_log(user["id"], limit=500)
    bc_events = [e.model_dump(mode="json") for e in entries if e.action.startswith("blockchain.")]
    return {
        "blockchain_status": get_blockchain_status() if BLOCKCHAIN_AVAILABLE else {"status": "MOCK_MODE"},
        "events": bc_events
    }


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)
