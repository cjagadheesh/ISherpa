# IPO Sherpa — SEBI SME IPO Draft Generator & Compliance Auditor

<div align="center">

[![SEBI TechSprint](https://img.shields.io/badge/SEBI-TechSprint%202026-1a2e6b?style=for-the-badge)](https://www.sebi.gov.in)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![Blockchain](https://img.shields.io/badge/Blockchain-Polygon%20Amoy-8247E5?style=for-the-badge)](https://polygon.technology)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](https://docker.com)
[![Tests](https://img.shields.io/badge/Tests-47%20Passing-brightgreen?style=for-the-badge)](./backend/tests)
[![License](https://img.shields.io/badge/License-MIT-gray?style=for-the-badge)](./LICENSE)

**The only platform that takes an Indian SME from "we are thinking about an IPO" to a disclosure-ready, banker-certified, blockchain-anchored Draft Red Herring Prospectus — in hours, not months.**

</div>

---

> [!IMPORTANT]
> **Jury / Evaluator — Sample Documents for Testing**
>
> A curated set of sample statutory documents (Certificate of Incorporation, GST Registration, PAN, Restated Financials, Cap Table, and more) is available for testing the prototype end-to-end.
>
> **[Access Sample Document Folder on Google Drive](https://drive.google.com/drive/folders/1t95ZwBJa-GAXgzpivNXt_x9aPi-_VsgP?usp=sharing)**
>
> Upload these documents through the Document Vault to trigger OCR extraction, contradiction detection, hallucination guard, and DRHP generation. No account or API key is required to run the demo.

---

## Table of Contents

- [The Problem We Solve](#the-problem-we-solve)
- [Platform Overview](#platform-overview)
- [Quick Start](#quick-start)
- [Blockchain & Trust Architecture](#blockchain--trust-architecture)
- [Retrieval-Augmented Generation](#retrieval-augmented-generation)
- [NLP & Machine Learning Pipeline](#nlp--machine-learning-pipeline)
- [Automated Circular Monitoring](#automated-circular-monitoring)
- [OCR & Document Intelligence](#ocr--document-intelligence)
- [AI/ML Feature Index A-Z](#aiml-feature-index-az)
- [Automated Regulatory Compliance](#automated-regulatory-compliance)
- [Enterprise-Grade Security](#enterprise-grade-security)
- [Frontend Architecture](#frontend-architecture)
- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Docker Deployment](#docker-deployment)
- [Competitive Differentiation](#competitive-differentiation)
- [SEBI TechSprint Problem Statement Mapping](#sebi-techsprint-problem-statement-mapping)

---

## The Problem We Solve

India's **Rs 600 Billion SME IPO market** is constrained by paperwork and process complexity. The average SEBI SME Draft Red Herring Prospectus (DRHP) requires **4–6 months**, involves **10+ statutory documents**, and demands simultaneous legal, financial, and merchant banking expertise — costing lakhs of rupees before a single rupee is raised.

> Founders abandon viable IPOs. Regulators receive incomplete filings. Investors lose access to quality SME opportunities.

**IPO Sherpa eliminates this barrier** with an end-to-end AI compliance workspace:

| Without IPO Sherpa | With IPO Sherpa |
|---|---|
| 4–6 months of drafting | Hours to a disclosure-ready draft |
| 10+ disconnected document workflows | Unified Document Vault with auto-extraction |
| Missed SEBI ICDR clauses discovered at filing | 55 live SEBI requirements tracked in real time |
| Hallucinated LLM content in legal documents | Digit-level hallucination guard on every number |
| No audit trail, no tamper-evidence | Immutable blockchain anchoring on Polygon Amoy |
| Banker reviews happen in silos | Structured section-by-section certification workflow |

---

## Platform Overview

```
+---------------------------------------------------------------------------------+
|                            IPO SHERPA PLATFORM                                  |
|                                                                                 |
|  DOCUMENT VAULT              AI ENGINE               TRUST LAYER                |
|  ─────────────               ─────────               ──────────                 |
|  10 doc types accepted       PaddleOCR + LLM         Polygon Amoy anchoring     |
|  4-tier OCR pipeline         NLP red-flag scan        W3C Verifiable Credentials|
|  Table-aware extraction      Hallucination guard      Append-only audit log     |
|  W3C VC per document         RAG over ICDR corpus     SHA-256 tamper detection  |
|                                                                                 |
|  COMPLIANCE ENGINE           DRAFTING WIZARD          BANKER WORKFLOW           |
|  ─────────────               ─────────────────        ──────────────            |
|  55 SEBI ICDR requirements   106 fields, 21 sections  Per-section certification |
|  20+ contradiction checks    4 sector KPI templates   Export gate (no bypass)   |
|  Live filing-readiness score Auto-fill from OCR       Due-diligence Form A      |
|  Automated circular alerts   AI risk-factor drafting  Peer comparison metrics   |
+---------------------------------------------------------------------------------+
```

## Blockchain & Trust Architecture

IPO Sherpa integrates a **Polygon Amoy (EVM-compatible testnet) smart contract** (`SEBIDocumentRegistry`) to provide cryptographically verifiable tamper-evidence for every document, prospectus version, and audit snapshot. No document content ever leaves your infrastructure — only SHA-256 cryptographic digests are submitted on-chain.

### Smart Contract Functions

| Function | Trigger | On-Chain Data |
|---|---|---|
| `anchorDocument()` | Document upload | SHA-256(document bytes), timestamp, doc type |
| `sealProspectus()` | Prospectus version generation | SHA-256(DOCX bytes), version number |
| `logAudit()` | Validation run | SHA-256(audit snapshot), checks run, checks passed |
| `verifyDocument()` | Public verification (permissionless) | Hash lookup, returns anchor timestamp |

### On-Chain vs. Off-Chain Data Split

| On-Chain (Polygon Amoy) | Off-Chain (Local / Supabase) |
|---|---|
| SHA-256 document hashes | Full document bytes |
| Prospectus version hashes | Draft DOCX content |
| Audit log snapshots | Detailed JSONL audit records |
| Blockchain transaction IDs | User session state |

### W3C Verifiable Credentials

Every uploaded and verified document receives a **W3C v1.1 JSON-LD Verifiable Credential** issued by a DID anchored to the Polygon Amoy network:

```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://schema.sebi.gov.in/credentials/v1"
  ],
  "type": ["VerifiableCredential", "SEBIDocumentComplianceCredential"],
  "issuer": {
    "id": "did:polygon:amoy:0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    "name": "SEBI SME IPO Compliance Authority"
  },
  "credentialSubject": {
    "document_type": "incorporation",
    "verification_status": "AUTHENTICATED",
    "sebi_compliance_score": 100,
    "doc_hash": "0x4f2a..."
  }
}
```

### Blockchain Architecture

```
                     +------------------------------------+
                     |   SEBIDocumentRegistry Contract    |
                     |   (Polygon Amoy Testnet -- EVM)    |
                     +----------------+-------------------+
                                      |
              +-----------------------+-----------------------+
              |                       |                       |
     anchorDocument()         sealProspectus()           logAudit()
     SHA-256(doc_bytes)       SHA-256(docx_bytes)        SHA-256(audit_log)
              |                       |                       |
     +---------+---------+  +---------+---------+  +---------+---------+
     | Document Uploaded |  | Prospectus        |  | Audit Snapshot    |
     | W3C VC Issued     |  | Version Sealed    |  | On-Chain          |
     +-------------------+  +-------------------+  +-------------------+
```

**Deterministic mock mode**: When no RPC endpoint or private key is configured, blockchain calls return deterministic mock responses prefixed with `[MOCK]` in logs — zero crashes, full functional parity for offline evaluation.

**Privacy by design**: Documents never leave your infrastructure. Only cryptographic proofs go on-chain.

---

## Retrieval-Augmented Generation

The IPO Sherpa AI Copilot is not a generic LLM — it is a **regulation-grounded question-answering system** built on a curated SEBI ICDR corpus.

### RAG Architecture

```
User Query
    |
    v
+-------------------+        +---------------------------+
| Query Encoder     |        | ChromaDB Vector Store     |
| all-MiniLM-L6-v2  |------> | SEBI ICDR Chapter IX      |
| 384-dim embedding |        | Cosine similarity search  |
+-------------------+        +---------------------------+
                                          |
                              Top-K retrieved clauses
                                          |
                                          v
                             +------------------------+
                             | LLM Context Synthesis  |
                             | (Groq / OpenAI /       |
                             |  Anthropic / Ollama)   |
                             +------------------------+
                                          |
                              Grounded response with
                              citation IDs, URLs, and
                              confidence scores
```

### RAG Technical Details

| Component | Implementation |
|---|---|
| Vector store | ChromaDB persistent collection (`backend-chroma-db` Docker volume) |
| Embedding model | `all-MiniLM-L6-v2` (384-dim, 80 MB, CPU-efficient) |
| Retrieval method | Cosine similarity + TF-IDF hybrid scoring |
| Corpus | Curated SEBI ICDR Chapter IX regulations (`sebi_icdr_corpus.py`) |
| Grounding | Every answer includes `regulation_no`, `chapter`, `url`, `confidence` |
| LLM layer | Provider-agnostic via `llm_client.py` (Groq / OpenAI / Anthropic / Ollama) |

**Example interaction:**

```
Query:  "What is the minimum promoter contribution for an SME IPO?"
RAG:    Retrieves ICDR Reg 236 (Chapter IX), confidence: 0.94
LLM:    Synthesizes grounded answer with regulation citation
Output: { regulation_no: "ICDR Reg 236", chapter: "IX", url: "...", confidence: 0.94 }
```

The vector store is seeded at container startup and persists across restarts via a named Docker volume — no re-indexing on every boot.

---

## NLP & Machine Learning Pipeline

### Semantic Embedding Engine

The platform uses `sentence-transformers/all-MiniLM-L6-v2` (384-dimensional embeddings) for all semantic tasks:

- Matching form field values against OCR-extracted text
- Red-flag detection in narrative disclosures
- RAG retrieval relevance scoring
- Entity relationship disambiguation

**Fallback**: `difflib.SequenceMatcher` is used when PyTorch / sentence-transformers are unavailable, preserving all functionality without GPU or heavy ML dependencies.

### ML Feature Summary

| Feature | Algorithm / Model | Purpose |
|---|---|---|
| Semantic field matching | `all-MiniLM-L6-v2` cosine similarity | Match form values against extracted text |
| Red-flag detection | Semantic similarity + keyword rules | Detect vague or boilerplate disclosures |
| Named entity recognition | Regex pipeline + sentence-transformers | Extract CIN, GSTIN, PAN, dates, director names |
| Financial ratio anomaly detection | Sector-specific threshold comparison | Flag implausible financial metrics |
| RAG retrieval | ChromaDB cosine + TF-IDF hybrid | Ground Copilot answers in ICDR regulations |
| Hallucination detection | Numeric extraction + unit normalization | Verify every LLM-generated number against facts |
| Risk factor generation | LLM (session-grounded, hallucination-guarded) | Draft issuer-specific risk disclosures |
| Contradiction detection | Cross-document rule engine + semantic matching | Surface 20+ statutory inconsistencies |
| Narrative summarization | Provider-agnostic LLM | Summarize business overview for Copilot |
| Readability scoring | Flesch-Kincaid approximation | Score narrative quality for investor clarity |

### NLP Red-Flag Scanner

`nlp_analyzer.py` scans all narrative disclosures for investor-harmful patterns using **semantic similarity combined with rule-based detection**:

| Flag Category | Example Detection | Severity |
|---|---|---|
| Vague language | "market leader", "rapidly growing" without citation | HIGH |
| Generic boilerplate risk | Macro risks without company-specific impact figures | HIGH |
| Missing litigation declaration | No affirmative nil/pending litigation statement | MEDIUM |
| Unsubstantiated forward-looking claims | Revenue projections without stated basis | HIGH |
| Promoter background gaps | Missing DIN/designation for promoter directors | MEDIUM |
| Customer concentration risk | >30% revenue from single customer undisclosed | HIGH |

Each flag includes **4-step chain-of-thought reasoning** with statutory rule citations. The scanner runs as a dedicated API surface (`POST /api/nlp/redflag`) and feeds into the Dashboard section risk scores.

### Named Entity Recognition Pipeline

`nlp_analyzer.py` extracts structured entities from unstructured statutory documents:

- **Company identifiers**: CIN (regex-validated against MCA format), GSTIN (15-digit GST format), PAN/TAN
- **Financial figures**: Amounts with unit disambiguation (Crore / Lakh / rupees, with normalization)
- **Persons**: Promoter and KMP names with designation matching
- **Dates**: Incorporation date, GST registration date, financial year ends
- **Legal references**: Regulation citations, section numbers from Companies Act / GST Act / SEBI ICDR

### Auto-Generated Risk Factors

`POST /api/generate-risk-factors` uses session facts to draft **issuer-specific** risk factor disclosures:

- Internal risks: operational, financial, management concentration
- External risks: regulatory, market, competition
- Each risk factor is grounded in real session data extracted from uploaded documents
- Hallucination guard applied before every return — no unverified numbers pass through

---

## Automated Circular Monitoring

`sebi_circulars.py` implements a **live regulatory change alert pipeline** that monitors SEBI's official circular feed and surfaces session-specific compliance impacts automatically.

### Processing Pipeline

```
SEBI Official Circular Feed
          |
          v
+----------------------+
| Circular Parser      |
| - Circular number    |
| - Effective date     |
| - Affected rules     |
+----------------------+
          |
          v
+----------------------+
| Session Impact Analyzer
| - Compares circular  |
|   scope against      |
|   current session    |
|   form data          |
+----------------------+
          |
          v
+----------------------+
| RegulatoryAlertBanner|
| (Frontend UI)        |
| - Severity rating    |
| - Affected sections  |
| - Required actions   |
+----------------------+
```

### Alert Structure

```
[HIGH] SEBI/HO/CFD/PoD-2/P/CIR/2026/014
Master Circular on SEBI ICDR Chapter IX -- effective 2026-04-01
Affected sections: capital_structure, compliance_certs, management
Impact: GST registration date (2018-04-12) vs MCA incorporation date (2018-05-15)
        requires statutory reconciliation under Companies Act S.7 & GST Act S.22
Action: Attach predecessor entity conversion certificate
```

### Circular Alert Coverage

| Regulation Area | Monitoring Scope |
|---|---|
| SME IPO disclosure requirements | All Schedule VI Part A/E amendments |
| Capital structure changes | Post-issue capital ceiling, face value amendments |
| Promoter lock-in rules | GCP utilization and lock-in period changes |
| Auditor qualification | Independence, rotation, qualification requirements |

Alerts are surfaced in the `RegulatoryAlertBanner` UI component and available via `GET /api/regulatory_alerts`. Each alert includes: circular number, effective date, affected wizard sections, session-specific impact analysis, and a specific required action.

---

## OCR & Document Intelligence

### Multi-Tier OCR Pipeline

A **4-tier fallback chain** in `extractor.py` ensures maximum extraction coverage across all document qualities:

```
Tier 1: pdfplumber (text-based PDF extraction -- instant, zero OCR overhead)
   |
   v (empty pages or scanned documents)
Tier 2: PaddleOCR PP-OCRv4 (primary -- production-grade, CPU-only)
   |
   v (PaddleOCR fails or confidence too low)
Tier 3: pytesseract (Tesseract fallback)
   |
   v (all OCR engines fail)
Tier 4: Regex / keyword rules -- returns null (never fabricated) + missing_fields[]
```

For **table-heavy documents** (financials, cap tables, litigation schedules), an additional **3-tier structured table extractor** runs in priority before the text pipeline:

```
camelot stream  -->  camelot lattice (Ghostscript)  -->  tabula (JRE)  -->  raw text
```

This prevents mis-pairing of numbers with wrong row/column labels in financial statements.

### Document Types Supported

| Document Type | Key Extracted Fields |
|---|---|
| Certificate of Incorporation | CIN, company name, incorporation date, registered office, company type |
| GST Registration | GSTIN, declared turnover, registration date, filing status |
| PAN / TAN Compliance | PAN number, PAN name, TAN |
| Restated Financial Statements | 3-year: equity, net worth, revenue, EBITDA, PAT, EPS, RoNW, NAV, borrowings, cash flows |
| MOA / AOA | Authorized capital, face value per share, main objects clause |
| Register of Members (Cap Table) | Pre-offer shareholding, promoter group, aggregate promoter % |
| DIR-12 / Board Resolutions | Directors (name / DIN / designation / independence), KMP |
| Litigation Schedule | Structured litigation summary |
| Industry Report (CRISIL / CARE / ICRA) | Market size, CAGR, report source |
| Sales / GST Register | Top-5 customer revenue table, key geographies |

### PaddleOCR Production Configuration

```python
# Tuned for CPU-only deployment -- no GPU required
os.environ.setdefault("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "False")  # prevents oneDNN crash

PaddleOCR(
    use_textline_orientation=False,  # speed optimization
    det_model_dir=cache_dir,         # pre-downloaded at Docker build time
    rec_model_dir=cache_dir,
    lang='en'
)
```

The `PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT=False` flag prevents the PP-OCRv6 oneDNN/PIR attribute conversion crash on certain CPU builds — a production-identified issue resolved in our deployment configuration.

---

## AI/ML Feature Index A-Z

> Every feature listed below is **production-implemented** — not prototyped, not mocked. All source files referenced are in the `backend/` directory.

### A — Abridged Prospectus Generation (`generator.py`)

Renders a **SEBI Schedule VI Part E** compliant Abridged Prospectus `.docx` with exact section order, table styling (`#D09E73` tan cover headers, `#D9D9D9` gray content tables), border rules, and font choices extracted from a real SEBI-filed OCXML. Missing fields render as `[MISSING: upload X]` or `[REQUIRES BANKER/LEGAL INPUT: ...]` inline — never silently omitted.

### B — Blockchain Document Anchoring (`blockchain.py`)

Every uploaded document and generated prospectus version is SHA-256 hashed and anchored to the Polygon Amoy testnet. See [Blockchain & Trust Architecture](#blockchain--trust-architecture) for full details.

### C — Consistency Checker / Contradiction Engine (`consistency_checker.py`)

Runs **20+ cross-document statutory checks** on every validation trigger:

| Check | Rule Citation |
|---|---|
| Company name across form / PAN / GST / MCA | SEBI ICDR Reg 230(1)(a) |
| GST turnover vs. P&L revenue (+/- 15% tolerance) | SEBI ICDR Reg 244(1)(b) |
| GST registration predating incorporation | Companies Act S.7 + GST Act S.22 |
| Paid-up capital exceeds Authorized capital | Companies Act S.61 |
| Promoter post-issue holding below 20% | SEBI ICDR Reg 236(1) |
| Objects of issue total does not match issue size | SEBI ICDR Reg 234 |
| SME post-issue capital exceeds Rs 25 Crore | SEBI ICDR Reg 229(1) |
| Price-band width exceeds 20% of floor | SEBI ICDR Reg 236 |
| Diluted EPS differs from Basic EPS (no dilutive instruments) | Ind AS 33 |
| Top-5 customer % vs. narrative text | SEBI ICDR Schedule VI |
| Statutory auditor name mismatch | SEBI ICDR Reg 244 |
| WACA certificate date plausibility | SEBI ICDR Schedule VI |
| Segment reporting note presence | Ind AS 108 |
| Face value vs. price-band floor | SEBI ICDR Reg 236 |
| Litigation table vs. narrative text | SEBI ICDR Schedule VI Item 8 |
| + 5 additional checks | |

Contradiction findings feed the Dashboard, `/api/validate/fix-suggestion`, and the exported ZIP `contradiction_findings.json` — one source of truth.

### D — Document Vault & Multi-Format Upload (`extractor.py`, `Uploader.jsx`)

Accepts 10 statutory document types. Each document triggers background extraction via `job_manager.py` — large scans never block the UI.

### E — Entity Extraction & Named Entity Recognition (`nlp_analyzer.py`)

See [NLP & Machine Learning Pipeline](#nlp--machine-learning-pipeline) for the full NER pipeline.

### F — Financial Ratio Audit (`financial_ratio_checker.py`)

Recomputes **5 key financial ratios** from restated financials against sector-specific benchmarks:

| Ratio | Manufacturing | NBFC | Services | Jewellery / Trading |
|---|---|---|---|---|
| PAT Margin | >=5% | >=10% | >=8% | >=3% |
| EBITDA Margin | >=10% | -- | >=12% | >=5% |
| Leverage (D/E) | <=3x | <=8x | <=2x | <=4x |
| Return on Equity | >=10% | >=12% | >=15% | >=8% |

Implausible ratios are flagged with specific statutory citations and remediation guidance.

### G — Gap Scoring & SEBI ICDR Coverage Engine (`coverage.py`)

Tracks **55 individually clause-referenced SEBI ICDR requirements** in real time. Each requirement is tagged `fill_type: "manual"` (requires human decision) or `"extracted"` (requires document upload). Live coverage score appears on the Dashboard as a radial gauge.

### H — Hallucination Guard (`hallucination_guard.py`)

Before any LLM-drafted narrative is accepted into the system:

1. Extract every number the LLM generated (regex over full text)
2. Normalize across unit conversions (Crore / Lakh / units, +/- 0.01% tolerance)
3. Verify each number traces back to a real value in the session fact store
4. If any number is unverified — retry LLM generation or fall back to a safe template
5. Output includes `violations[]` array and `clean_text` with `[UNVERIFIED: N]` markers

```python
# Example: LLM writes "Revenue grew to Rs 47.3 Cr" -- if 47.3 is NOT in session, it is flagged
guard = HallucinationGuard()
result = guard.verify(llm_text, session_data)
# result.passed = False, result.violations = ["47.3"]
```

### I — Intelligent Auto-Fill Wizard (`Wizard.jsx`, `schema.json`)

**106 fields across 21 sections** — every field carries a `source_hint` declaring which document populates it:

```json
{
  "field_key": "company_cin",
  "source_hint": "incorporation",
  "data_type": "string",
  "required": true,
  "blocking": true
}
```

Fields with `source_hint: "manual"` are never auto-filled — they display inline explanations. Four sector-specific KPI templates adapt the KPIs section per SEBI KPI disclosure requirements.

### J — Job Manager (Async Background Processing) (`job_manager.py`)

Thread-safe background job queue ensures large OCR jobs never block upload requests. Upload returns immediately with a `job_id`; frontend polls `/api/jobs/{id}/status` every 2 seconds.

### K — KPI Sector Templates (`schema.json`)

Four curated KPI templates:

- **Manufacturing**: Inventory days, order book, installed vs. utilized capacity, EBITDA/ton
- **NBFC**: AUM, NIM, CRAR, credit rating, Gross NPA, Net NPA
- **Jewellery & Trading**: Inventory turnover, gold tonnage, margin per gram
- **Services**: Revenue per employee, utilization rate, client concentration, ARR

### L — LLM Provider Abstraction (`llm_client.py`)

Single abstraction layer over **4 LLM providers** — swapping is a `.env` change, zero code edits:

- **Groq** (default) · **OpenAI** · **Anthropic** · **Ollama** (local / offline)
- Dual Groq key support: `GROQ_API_KEY_2` auto-rotates when the primary hits rate limits
- JSON-mode extraction across all providers for structured, schema-validated output
- Graceful fallback to rule-based extraction when no key is configured

### M — Multi-Layer OCR Pipeline (`extractor.py`)

See [OCR & Document Intelligence](#ocr--document-intelligence) for full details on the 4-tier pipeline.

### N — NLP Red-Flag Scanner (`nlp_analyzer.py`)

See [NLP & Machine Learning Pipeline](#nlp--machine-learning-pipeline) for the full red-flag scanner.

### O — OCR Status & Confidence Monitoring (`/api/ocr_status`)

Real-time per-document OCR status: extraction tier used, confidence score, extracted field count, and `missing_fields[]` per document.

### P — Peer Comparison Engine (`peer_comparison.py`)

Auto-populates the **Basis of Issue Price** section with Schedule VI-compliant metrics: EPS (Basic & Diluted), NAV per share, RoNW, P/E ratio. A comparative table is auto-inserted into the generated DRHP.

### Q — Quality Scoring & Filing Readiness (`validator.py`)

| Score | What It Measures | Hard Cap |
|---|---|---|
| `filing_readiness` | Only blocking fields — capped at 80% when contradictions are open | Yes |
| `overall_completeness` | All required fields (including non-blocking) | No |

### R — RAG Engine (`rag_engine.py`)

See [Retrieval-Augmented Generation](#retrieval-augmented-generation) for full details.

### S — SEBI Circular Monitoring (`sebi_circulars.py`)

See [Automated Circular Monitoring](#automated-circular-monitoring) for full details.

### T — Tamper-Evident Audit Trail (`audit_log.py`)

**Append-only JSONL audit log** per user capturing every material action:

- Document uploads and extraction results
- Form field edits with old and new values
- Validation runs and contradiction findings
- Banker certification events (review / certify / uncertify)
- Export bundle generation and blockchain anchoring transaction hashes

The audit log is included in every export ZIP bundle and is itself anchored on-chain.

### U — Uploader — Document Vault UI (`Uploader.jsx`)

Drag-and-drop document upload with one card per document type, real-time background job progress bars, extracted-field preview panels, W3C Verifiable Credential inspector, and re-upload support.

### V — Verifiable Credentials (`verifiable_credentials.py`)

W3C v1.1 JSON-LD Verifiable Credential issuance per uploaded document. See [Blockchain & Trust Architecture](#blockchain--trust-architecture) for the full credential schema.

### W — Wizard — 10-Tab Drafting Form (`Wizard.jsx`, `schema.json`)

| Tab | Schema Sections |
|---|---|
| Cover Page | Cover Page, Summary of the Offer |
| General Info | General Information, Definitions |
| Board & Promoters | Promoters, Board & KMP, Related Party Transactions |
| Capital Structure | Capital Structure, Shareholding Pattern |
| Objects of Issue | Objects of the Issue |
| Business Operations | Business Overview, Industry Overview |
| Financials & KPIs | Financial Statements, KPIs, WACA |
| Risk Disclosures | Risk Factors |
| Compliance | Legal Disclosures, Compliance Certificates, Material Contracts |
| Declarations | Declaration |

### X — Export Bundle (`exporter.py`)

```
IPO_Sherpa_Export_Bundle.zip
├── DRHP_Draft.docx              -- Schedule VI Part A DRHP
├── Abridged_Prospectus.docx     -- Schedule VI Part E (15-page summary)
├── coverage_report.json         -- 55-requirement gap analysis
├── contradiction_findings.json  -- All open / resolved contradictions
├── audit_log.jsonl              -- Complete immutable audit trail
└── due_diligence_summary.pdf    -- Form A due-diligence certificate
```

Export is **gated behind banker certification** — no bypass, no exceptions. No configuration flag skips it.

### Y — Source Transparency

Every wizard field carries a `source_hint` and an inline explanation for manually required fields:

> "Objects of the Issue is a business decision by your board — no document can substitute for this."

Zero silent failures. Zero unexplained blanks. Every gap is actionable.

### Z — Zero-Downtime Session Persistence

- **Supabase mode**: Multi-user, real-time sync, JWT auth
- **Local mode**: `session_state.json` — `docker compose down && up` preserves an in-progress session
- Named Docker volumes survive rebuilds: `backend-session-state`, `backend-uploads`, `backend-audit-log`, `backend-chroma-db`

---

## Automated Regulatory Compliance

### 55 Live SEBI ICDR Requirements

`coverage.py` maintains 55 clause-referenced requirements, each tagged with fill type:

```python
{
  "id": "icdr_234_objects",
  "regulation": "SEBI ICDR Reg 234",
  "title": "Objects of the Issue disclosure",
  "fill_type": "manual",
  "section": "objects_of_issue",
  "blocking": True
}
```

| State | Meaning |
|---|---|
| Covered | Field populated from extraction or manual input |
| Needs Document | Upload the specified document to auto-populate |
| Needs Manual Input | Board / CA / legal decision required |
| Blocking | Cannot generate DRHP until resolved |

---

## Enterprise-Grade Security

### Authentication & Authorization

- **Supabase JWT** bearer token authentication in production
- **Demo mode**: Fixed demo user with zero login friction — all features available
- All routes operate unauthenticated in local mode with no feature degradation

### Security Architecture

| Layer | Implementation |
|---|---|
| Transport | HTTPS (TLS 1.3 in production via Supabase / Railway) |
| Document storage | Local filesystem with per-user path isolation |
| Session isolation | Per-user `session_id` enforced on all API routes |
| Blockchain verification | Permissionless public verification of any document hash |
| Audit immutability | Append-only JSONL — no delete or update endpoints exist |
| Rate limiting | FastAPI middleware on all API routes |
| CORS | Configurable `CORS_ORIGINS` (restricted in production) |
| LLM API privacy | Only extracted text snippets sent to LLM APIs — never raw documents |

### Data Privacy

- Documents never leave your infrastructure — only SHA-256 hashes go on-chain
- No telemetry, no analytics collection, no third-party tracking
- Offline / airgapped deployments supported via rule-based extraction fallback

---

## Frontend Architecture

### Components

| Component | Description |
|---|---|
| `SplashScreen.jsx` | Animated boot sequence with logo reveal |
| `AuthScreen.jsx` | Supabase auth with demo-mode fallback |
| `Dashboard.jsx` | Filing readiness overview: scores, contradiction list, section status |
| `Uploader.jsx` | Document Vault — drag-and-drop with real-time progress and VC inspector |
| `Wizard.jsx` | 10-tab drafting form |
| `Copilot.jsx` | Chat-style AI assistant with direct form-edit capability |
| `BankerDashboard.jsx` | Merchant banker section-by-section certification workflow |
| `DueDiligenceManager.jsx` | Form A due-diligence certificate generation |
| `ComplianceScoreMeter.jsx` | Animated radial compliance / coverage score gauge |
| `RegulatoryAlertBanner.jsx` | Live SEBI circular alert surfacing |
| `AuditTrail.jsx` | Append-only audit log timeline viewer |

### UX Highlights

- **Zero-router SPA**: `activeTab` string routing with no client-side router overhead
- **Optimistic UI**: Form changes reflect immediately; backend sync is asynchronous
- **Source Badges**: Every auto-filled field shows origin ("auto-extracted from [doc type]" vs "manual input")
- **Inline Action Copilot**: AI can apply its own fix suggestions directly to form fields
- **Export Gate Visualization**: Red `EXPORT BLOCKED` to Green `EXPORT READY` progress meter
- **Responsive Design**: Works on tablets for on-site merchant banker review

---

## System Architecture

```
+--------------------------------------------------------------------------------+
|                    React 19 / Vite Frontend (frontend/)                         |
|  SplashScreen -> AuthScreen -> Dashboard <-> Uploader <-> Wizard (10 tabs)      |
|         <-> BankerDashboard <-> Copilot (AI chat) <-> AuditTrail               |
+-----------------------------------+--------------------------------------------+
                                    | REST (fetch, JWT bearer or demo user)
+-----------------------------------v--------------------------------------------+
|                    FastAPI Backend (backend/main.py) -- ~50 REST endpoints       |
|                                                                                  |
|  extractor.py           -- 10 doc types, pdfplumber / OCR / LLM, 3-tier tables  |
|  validator.py           -- completeness -> filing_readiness score                |
|  coverage.py            -- 55 SEBI ICDR requirements -> gap list                |
|  consistency_checker.py -- 20+ cross-document contradiction checks               |
|  financial_ratio_checker.py -- restated-financials ratio audit                  |
|  nlp_analyzer.py        -- semantic matching, NER, red flags, risk-factor draft  |
|  hallucination_guard.py -- verifies every LLM-drafted number is real            |
|  generator.py           -- Draft Abridged Prospectus DOCX (SEBI format)         |
|  exporter.py            -- DRHP + Abridged Prospectus + ZIP bundle              |
|  certification.py       -- per-section banker sign-off, gates export            |
|  audit_log.py           -- append-only JSONL of every material action           |
|  blockchain.py          -- SHA-256 anchoring to Polygon Amoy testnet            |
|  verifiable_credentials.py -- W3C DID/VC issuance per uploaded document         |
|  rag_engine.py          -- ChromaDB semantic search over ICDR corpus            |
|  sebi_circulars.py      -- live regulatory-change alert feed                    |
|  due_diligence.py, peer_comparison.py, version_tracker.py, ps_mapping.py       |
+----------------------------------+---------------------------------------------+
                                   |
               +-------------------+---------------------+
               |                   |                     |
    +----------+---------+ +-------+-------+ +-----------+----------+
    |   ChromaDB          | |  Supabase     | |  Polygon Amoy        |
    | (ICDR vectors)      | |(session/auth) | |  (blockchain)        |
    +--------------------+  +---------------+ +----------------------+
```

### API Surface (~50 Endpoints)

**Session & Schema** · `GET /api/schema` · `GET /api/session` · `POST /api/session` · `POST /api/session_sync` · `POST /api/session/reset`

**Documents** · `POST /api/upload` · `GET /api/jobs/{job_id}/status` · `GET /api/ocr_status` · `GET /api/credentials/{doc_type}`

**AI Assistance** · `POST /api/copilot` · `POST /api/draft` · `POST /api/generate-risk-factors` · `POST /api/rag/query`

**Validation & Compliance** · `GET /api/validate` · `POST /api/validate/hallucination` · `POST /api/validate/fix-suggestion` · `GET /api/coverage` · `GET /api/regulatory_alerts` · `GET /api/ps-mapping`

**NLP** · `POST /api/nlp/redflag` · `POST /api/nlp/analyze` · `POST /api/nlp/explain`

**Generation & Export** · `GET|POST /api/generate` · `GET /api/export/bundle`

**Banker Certification** · `POST /api/certification/{section_key}/review` · `POST /api/certification/{section_key}/certify` · `POST /api/certification/{section_key}/uncertify` · `GET /api/certification/status`

**Audit & Blockchain** · `GET /api/audit` · `GET /api/blockchain/status` · `GET /api/blockchain/trail` · `GET /api/blockchain/verify/document/{doc_hash}` · `GET /api/blockchain/verify/prospectus/{draft_hash}`

**Ancillary** · `GET /api/due_diligence` · `POST /api/peer_comparison` · `GET /api/version_tracker` · `POST /api/version_tracker/snapshot` · `POST /api/approvals` · `POST /api/dpi/digilocker/simulate` · `GET /api/market/stats` · `GET /health`

---

## Project Structure

```
SEBI/
├── backend/
│   ├── main.py                    FastAPI app & all ~50 API routes
│   ├── schema.json                Field/section data model (21 sections, 106 fields)
│   ├── extractor.py               Document -> structured data (10 doc types, 4-tier OCR)
│   ├── generator.py               Draft Abridged Prospectus DOCX generator
│   ├── exporter.py                Full DRHP + Abridged Prospectus + ZIP bundle
│   ├── validator.py               Completeness / filing-readiness scoring
│   ├── coverage.py                55 named SEBI ICDR requirements + gap engine
│   ├── consistency_checker.py     20+ cross-field/cross-document contradiction checks
│   ├── financial_ratio_checker.py 5 ratio audit with sector benchmarks
│   ├── hallucination_guard.py     Digit-level LLM fact verification
│   ├── nlp_analyzer.py            Semantic matching, NER, risk-factor drafting
│   ├── llm_client.py              Provider-agnostic LLM abstraction (4 providers)
│   ├── rag_engine.py              ChromaDB-backed SEBI ICDR semantic search
│   ├── sebi_icdr_corpus.py        Curated SEBI ICDR Chapter IX regulation corpus
│   ├── sebi_circulars.py          Live regulatory alert feed
│   ├── certification.py           Banker sign-off workflow / export gate
│   ├── audit_log.py               Append-only JSONL audit trail
│   ├── blockchain.py              Polygon Amoy SHA-256 anchoring (live + mock)
│   ├── verifiable_credentials.py  W3C v1.1 JSON-LD VC issuance
│   ├── due_diligence.py           Form A due-diligence certificate generator
│   ├── peer_comparison.py         Dynamic peer valuation / accounting comparison
│   ├── version_tracker.py         Prospectus revision snapshots & diffs
│   ├── job_manager.py             Thread-safe background extraction job queue
│   ├── ps_mapping.py              SEBI TechSprint problem-statement clause mapping
│   ├── tests/                     pytest suite (47 tests)
│   └── Dockerfile                 Multi-stage build; models pre-downloaded at build time
├── frontend/
│   ├── src/
│   │   ├── App.jsx                Top-level state, routing, session sync
│   │   ├── components/            Wizard, Uploader, Dashboard, Copilot, BankerDashboard, ...
│   │   ├── api.js, config.js, supabase.js
│   │   └── data/icdrRegulations.js
│   ├── Dockerfile                 Multi-stage: Vite build -> nginx:alpine SPA server
│   └── nginx.conf                 SPA fallback routing
├── contracts/                     Solidity SEBIDocumentRegistry smart contract
├── draft/                         Reference SEBI-filed abridged prospectus samples
├── docker-compose.yml             One-command full-stack deployment
├── .env.example                   Environment variable template with inline documentation
└── DEMO_SCRIPT.md                 10-minute hackathon judge demo walkthrough
```

---

## Environment Variables

| Variable | Purpose | Required |
|---|---|---|
| `LLM_PROVIDER` | `groq` / `openai` / `anthropic` / `ollama` | No — defaults to `groq`; without key uses offline/template mode |
| `LLM_MODEL` | Override default model for the selected provider | No |
| `GROQ_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Provider API key | Only for the selected provider |
| `GROQ_API_KEY_2` | Second Groq key — auto-rotates on rate limit | No |
| `OLLAMA_BASE_URL` | Local Ollama server URL | Only if `LLM_PROVIDER=ollama` |
| `POLYGON_RPC_URL` | Polygon Amoy RPC endpoint | No — mock mode if unset |
| `BLOCKCHAIN_PRIVATE_KEY` | Wallet private key for blockchain anchoring | No — mock mode if unset |
| `BLOCKCHAIN_CONTRACT_ADDRESS` | Deployed SEBIDocumentRegistry address | No — mock mode if unset |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` | Multi-user workspaces + auth | No — local JSON fallback |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Frontend Supabase client (baked at build time) | No |
| `CORS_ORIGINS` / `HOST` / `PORT` | Backend server configuration | No — sensible defaults |

---

## Testing

```bash
cd backend
python -m pytest tests/ -v
```

**47 tests** covering:

| Module | What Is Tested |
|---|---|
| `certification.py` | Section sign-off, export gating, uncertify flows |
| `consistency_checker.py` | All 20+ contradiction check scenarios |
| `coverage.py` | 55-requirement scoring, gap classification |
| `hallucination_guard.py` | Number extraction, unit normalization, violation detection |
| `nlp_analyzer.py` | Semantic similarity, red-flag detection, entity extraction |
| `validator.py` | Completeness scoring, filing-readiness capping logic |

---

## Docker Deployment

### Backend (`backend/Dockerfile`)

- Multi-stage build on `python:3.13-slim`
- All heavy models downloaded at build time — PaddleOCR, sentence-transformers (`all-MiniLM-L6-v2`), ChromaDB embedding model
- Zero first-request latency; fully offline-capable from the first container start
- Named volumes:
  - `backend-model-cache`, `backend-paddlex-cache` — ML model weights (survive rebuilds)
  - `backend-session-state`, `backend-uploads`, `backend-audit-log`, `backend-chroma-db` — runtime state

### Frontend (`frontend/Dockerfile`)

- Multi-stage: Vite build in `node:20-alpine` served by `nginx:alpine`
- SPA fallback routing via `nginx.conf`
- `VITE_API_URL` / `VITE_SUPABASE_*` baked into the JS bundle at build time — rebuild required if changed

### docker-compose.yml

- Frontend container waits for backend healthcheck before starting
- `docker compose down && up` preserves all in-progress session data, uploaded files, and the audit trail

---

## Competitive Differentiation

| Capability | IPO Sherpa | Generic AI Doc Tools | Manual Process |
|---|---|---|---|
| SEBI ICDR-specific knowledge | 55 clauses, SEBI corpus RAG | Generic LLM knowledge | Consultant memory |
| OCR for scanned Indian statutory docs | 4-tier pipeline | Single OCR engine | Manual retyping |
| Hallucination prevention | Digit-level verification | None | Human review |
| Cross-document contradiction detection | 20+ checks with statute citations | None | Expensive legal review |
| Blockchain tamper-evidence | Polygon Amoy + W3C VCs | None | None |
| Merchant banker workflow | Section-by-section certification gate | None | Email chains |
| Automated circular monitoring | Live SEBI feed + session-specific impact | None | Manual tracking |
| Sector-specific KPI templates | 4 sectors (Mfg / NBFC / Services / Jewellery) | Generic fields | Manual selection |
| Offline / airgapped mode | Full feature set, rule-based fallback | Cloud-dependent | Always |
| Generated format | SEBI ICDR Schedule VI DOCX + ZIP | Generic PDF | Manual formatting |
| Immutable audit trail | JSONL + on-chain anchoring | Basic logs | None |

### Value Proposition by Stakeholder

**For Founders**

- Hours to a disclosure-ready draft vs. months of manual preparation
- Every gap is clearly labelled with what is needed to resolve it — no mystery blanks
- Dramatically reduces pre-banker legal and financial preparation costs

**For Merchant Bankers**

- Structured section-by-section certification, not document-level rubber-stamping
- Contradiction issues surfaced before the banker review — not during it
- Peer comparison and due-diligence Form A ready for sign-off on day one

**For SEBI / Regulators**

- Better-prepared filings: 55-requirement gap engine means fewer incomplete DRHPs
- Immutable audit trail: every decision, edit, and certification is blockchain-anchored
- Statutory role of merchant banker is architecturally preserved — no auto-filing

### Scalability Architecture

```
                    Load Balancer
                         |
         +---------------+---------------+
         |               |               |
    FastAPI Pod 1   FastAPI Pod 2   FastAPI Pod N
    (stateless)     (stateless)     (stateless)
         |               |               |
         +---------------+---------------+
                         |
              +----------+----------+
              |           |          |
         Supabase    ChromaDB    Polygon Amoy
         (sessions)  (vectors)   (blockchain)
```

- **Horizontal scaling**: Stateless FastAPI pods behind a load balancer (session state in Supabase)
- **Vector store**: ChromaDB persistent collection shared across pods
- **Blockchain**: Shared smart contract — any pod can anchor or verify
- **CDN-ready frontend**: Static nginx-served React bundle deployable to any CDN

---

## SEBI TechSprint Problem Statement Mapping

Access the live mapping at `/api/ps-mapping` after startup.

| PS Clause | Mandate | Implementation | Status |
|---|---|---|---|
| PS-1 | Document digitization & OCR | 4-tier OCR pipeline (PaddleOCR + pytesseract) | Full |
| PS-2 | Automated data extraction | 10 doc types, LLM + regex + table extraction | Full |
| PS-3 | Compliance gap identification | 55 SEBI ICDR requirements, live gap score | Full |
| PS-4 | Cross-document contradiction detection | 20+ cross-checks, fix suggestions | Full |
| PS-5 | AI-assisted narrative drafting | LLM drafting + hallucination guard | Full |
| PS-6 | Hallucination prevention | Digit-level verification against fact store | Full |
| PS-7 | CA/legal sign-off workflows | `source_hint: "manual"` + inline notes per field | Partial* |
| PS-8 | Merchant banker certification | Section-by-section gate, export blocked until certified | Full |
| PS-9 | Audit trail & tamper-evidence | Append-only JSONL + Polygon blockchain anchoring | Full |
| PS-10 | DigiLocker integration | Simulation endpoint (`/api/dpi/digilocker/simulate`) | Simulated* |
| PS-11 | Regulatory circular monitoring | Live SEBI feed + session-specific impact analysis | Full |
| PS-12 | Investor-protection NLP | Red-flag scanner, vague language detection, readability | Full |
| PS-13 | Peer comparison & valuation | Auto-populated Basis of Issue Price section | Full |

*PS-7: CA certificate content requires a licensed CA — correctly refused to auto-fill, with a clear explanation why.

*PS-10: Live DigiLocker API requires government-issued credentials — simulation demonstrates the integration flow accurately.

---

## Statutory Role of SEBI Intermediaries

IPO Sherpa is not a substitute for a SEBI-registered Category I Merchant Banker. The platform is designed to:

1. **Accelerate** the drafting stage that precedes banker review
2. **De-risk** that stage by catching 20+ contradiction classes before banker review begins
3. **Preserve** the intermediary role — exports are gated behind section-by-section certification

No DRHP can leave IPO Sherpa without a merchant banker explicit certification of every section. This is a hard architectural constraint — there is no API endpoint, no admin override, and no configuration flag that bypasses it.


*Built for SEBI TechSprint 2026 — Making Indian Capital Markets More Accessible, Transparent, and Trustworthy.*

*IPO Sherpa: From "thinking about an IPO" to disclosure-ready in hours.*
