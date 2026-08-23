"""
sebi_icdr_corpus.py — SEBI ICDR Chapter IX & Schedule VI Statutory Regulation Corpus
=====================================================================================
Contains structured, indexed legal regulation texts from the Securities and Exchange Board
of India (Issue of Capital and Disclosure Requirements) Regulations, 2018 (as amended).
"""

SEBI_ICDR_CORPUS = [
    {
        "id": "REG_228",
        "regulation_no": "Regulation 228",
        "chapter": "Chapter IX — SME IPO Eligibility",
        "title": "Entities Ineligible to Make an Initial Public Offer on SME Platform",
        "citation": "SEBI (ICDR) Regulations, 2018 — Reg. 228",
        "key_terms": ["ineligible", "debarment", "fugitive economic offender", "wilful defaulter", "promoter debarred"],
        "text": """An issuer shall not be eligible to make an initial public offer on the SME platform:
(a) if the issuer, any of its promoters, promoter group or directors, or selling shareholders are debarred from accessing the capital market by the Board;
(b) if any of the promoters or directors of the issuer is a promoter or director of any other company which is debarred from accessing the capital market by the Board;
(c) if the issuer or any of its promoters or directors is a wilful defaulter or a fugitive economic offender;
(d) if there are any outstanding convertible securities or any other right which would entitle any person with any option to receive equity shares of the issuer prior to the IPO.""",
        "url": "https://www.sebi.gov.in/legal/regulations/sep-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html"
    },
    {
        "id": "REG_229",
        "regulation_no": "Regulation 229",
        "chapter": "Chapter IX — SME IPO Eligibility",
        "title": "Eligibility Requirements for SME IPO",
        "citation": "SEBI (ICDR) Regulations, 2018 — Reg. 229",
        "key_terms": ["eligibility", "post issue paid up capital", "25 crore", "bse sme", "nse emerge", "net worth"],
        "text": """An issuer making an initial public offer on the SME platform shall satisfy the following conditions:
1. The post-issue paid-up capital of the issuer shall not exceed twenty-five crore rupees (₹25 Crores).
2. The minimum post-issue face value capital shall be three crore rupees (₹3 Crores).
3. The issuer shall have a track record of operational profits from operations for at least two preceding financial years out of three preceding years.
4. The net worth of the issuer shall be positive in the preceding financial year.
5. The issue shall be 100% underwritten by the lead manager(s), with at least 15% underwritten on their own account.""",
        "url": "https://www.sebi.gov.in/legal/regulations/sep-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html"
    },
    {
        "id": "REG_236",
        "regulation_no": "Regulation 236",
        "chapter": "Chapter IX — Promoter Contribution",
        "title": "Promoters' Minimum Contribution & 3-Year Lock-in",
        "citation": "SEBI (ICDR) Regulations, 2018 — Reg. 236(1)",
        "key_terms": ["promoter contribution", "lock in", "20 percent", "3 years", "three years", "minimum contribution"],
        "text": """The promoters of the issuer shall contribute not less than twenty per cent (20%) of the post-issue capital:
Provided that in case the post-issue capital exceeds twenty per cent, the minimum promoter contribution shall be locked in for a period of three (3) years from the date of commencement of commercial production or date of allotment in the initial public offer, whichever is later.
Promoter holding in excess of minimum twenty per cent (20%) shall be locked in for a period of one (1) year under Regulation 238.""",
        "url": "https://www.sebi.gov.in/legal/regulations/sep-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html"
    },
    {
        "id": "REG_238",
        "regulation_no": "Regulation 238",
        "chapter": "Chapter IX — Promoter Contribution",
        "title": "Lock-in of Specified Securities Held by Promoters & Other Pre-IPO Investors",
        "citation": "SEBI (ICDR) Regulations, 2018 — Reg. 238",
        "key_terms": ["1 year lock in", "pre ipo lock in", "excess promoter holding", "statutory lock in", "one year"],
        "text": """In an initial public offer on SME platform:
(a) The minimum promoters' contribution (20%) shall be locked in for a period of three (3) years.
(b) The remaining pre-issue equity capital held by promoters in excess of 20% shall be locked in for a period of one (1) year.
(c) The entire pre-issue equity capital held by persons other than promoters shall be locked in for a period of one (1) year from the date of allotment in the IPO.""",
        "url": "https://www.sebi.gov.in/legal/regulations/sep-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html"
    },
    {
        "id": "REG_244",
        "regulation_no": "Regulation 244",
        "chapter": "Chapter IX — Offer Document Disclosures",
        "title": "General Information Disclosures in SME Prospectus",
        "citation": "SEBI (ICDR) Regulations, 2018 — Reg. 244 & Schedule VI",
        "key_terms": ["cover page", "general information", "cin", "pan", "gstin", "auditor", "lead manager", "registrar"],
        "text": """The draft offer document and offer document shall contain all material disclosures which are true, correct, and adequate to enable applicants to take an informed investment decision:
1. Cover page disclosures specifying Issuer Name, CIN, Registered Office, Contact details, Issue Size, Price Band, and Lead Manager names.
2. Names, addresses, DIN, and membership numbers of Statutory Auditors and Merchant Bankers.
3. Details of Permanent Account Number (PAN) and GSTIN matching MCA incorporation records.""",
        "url": "https://www.sebi.gov.in/legal/regulations/sep-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html"
    },
    {
        "id": "REG_246",
        "regulation_no": "Regulation 246",
        "chapter": "Chapter IX — Capital Structure",
        "title": "Disclosures Pertaining to Capital Structure & Shareholding",
        "citation": "SEBI (ICDR) Regulations, 2018 — Reg. 246",
        "key_terms": ["capital structure", "authorized capital", "paid up capital", "promoter shareholding", "cap table"],
        "text": """The offer document shall contain complete details of capital structure:
1. Authorized share capital, Issued, Subscribed, and Paid-up share capital before and after the issue.
2. Shareholding pattern of Promoters and Promoter Group before and after the public offer.
3. Details of equity share capital built up over time by promoters, including cost of acquisition per share.""",
        "url": "https://www.sebi.gov.in/legal/regulations/sep-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html"
    },
    {
        "id": "REG_247",
        "regulation_no": "Regulation 247",
        "chapter": "Chapter IX — Objects of Issue",
        "title": "Objects of the Issue & Means of Finance Disclosures",
        "citation": "SEBI (ICDR) Regulations, 2018 — Reg. 247",
        "key_terms": ["objects of issue", "use of proceeds", "expansion", "working capital", "general corporate purposes", "issue expenses"],
        "text": """The offer document shall disclose the specific objects for which funds are being raised:
1. Requirement of funds for expansion, capital expenditure, working capital, and debt repayment.
2. General Corporate Purposes (GCP) allocation shall not exceed twenty-five per cent (25%) of the total net issue proceeds.
3. Firm means of finance must be tied up for at least 75% of the project cost before filing the prospectus.""",
        "url": "https://www.sebi.gov.in/legal/regulations/sep-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html"
    },
    {
        "id": "REG_250",
        "regulation_no": "Regulation 250",
        "chapter": "Chapter IX — Risk Factors",
        "title": "Internal and External Risk Disclosures",
        "citation": "SEBI (ICDR) Regulations, 2018 — Reg. 250",
        "key_terms": ["risk factors", "internal risks", "external risks", "litigations", "customer concentration", "regulatory risks"],
        "text": """Risk factors shall be disclosed in order of priority (most significant first):
1. Internal risks specific to the issuer business, including customer concentration, raw material price volatility, and pending litigations against promoters/directors.
2. External risks including industry regulatory changes, environmental sanctions, and tax laws.
3. Material outstanding litigations involving the company, promoters, or directors.""",
        "url": "https://www.sebi.gov.in/legal/regulations/sep-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html"
    }
]
