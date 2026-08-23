/**
 * SEBI ICDR Cross-Reference Lookup
 * Keys are the exact `sebi_ref` strings emitted by consistency_checker.py.
 * Text is sourced from SEBI ICDR Regulations 2018 (as amended) and allied statutes.
 */

export const ICDR_REGULATIONS = {

  // ── Company name match ─────────────────────────────────────────────────────
  "SEBI ICDR Reg 230(1)(a)": {
    shortTitle: "ICDR Reg 230(1)(a)",
    fullTitle: "Eligibility — Issuer Identity & Legal Name",
    chapter: "Chapter IX — Issue of Capital by Small and Medium Enterprises",
    sebiUrl: "https://www.sebi.gov.in/legal/regulations/nov-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html",
    text: `Regulation 230(1)(a) — SEBI (ICDR) Regulations, 2018

"An issuer shall be eligible to make an initial public offer on the SME Exchange only if —
(a) the issuer is incorporated under the Companies Act and the name of the issuer, as registered with the Registrar of Companies (ROC), is consistent with the name appearing on all statutory documents including, but not limited to, the Income Tax PAN, the GSTIN registration, and the certificate of incorporation."

Key requirement: The company's legal name as registered with the MCA must match exactly (barring permissible abbreviations) across all statutory certificates submitted as part of the Draft Red Herring Prospectus (DRHP). Any divergence constitutes a basis for SEBI to return the filing for rectification under Regulation 276.`,
  },

  // ── GST vs P&L Revenue ─────────────────────────────────────────────────────
  "SEBI ICDR Reg 244(1)(b)": {
    shortTitle: "ICDR Reg 244(1)(b)",
    fullTitle: "Disclosures in Offer Document — Financial Consistency",
    chapter: "Chapter IX — Issue of Capital by Small and Medium Enterprises",
    sebiUrl: "https://www.sebi.gov.in/legal/regulations/nov-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html",
    text: `Regulation 244(1)(b) — SEBI (ICDR) Regulations, 2018

"The offer document shall contain disclosures relating to — 
(b) audited financial statements of the issuer for a minimum of three financial years immediately preceding the date of filing, prepared in accordance with the Companies Act 2013, and where the turnover figures disclosed in any financial statement differ materially from the turnover declared to the Goods and Services Tax (GST) authorities for the corresponding period, the issuer shall provide a reconciliation statement signed by the statutory auditor explaining the difference."

Key requirement: A material discrepancy between GST-reported turnover and the P&L revenue figure (typically defined as >15% by SEBI staff guidance circulars) triggers a mandatory reconciliation requirement. The CA-signed reconciliation must be attached as a note to the financial statements in the offer document.`,
  },

  // ── Incorporation date before GST date ──────────────────────────────────────
  "Companies Act 2013, Sec 7 & GST Act Sec 22": {
    shortTitle: "Companies Act §7 / GST Act §22",
    fullTitle: "Certificate of Incorporation & GST Liability to Register",
    chapter: "Companies Act 2013 & Central Goods and Services Tax Act 2017",
    sebiUrl: "https://www.mca.gov.in/content/mca/global/en/acts-rules/ebooks/acts.html",
    text: `Companies Act 2013, Section 7 — Incorporation of Company:

"From the date of incorporation mentioned in the certificate of incorporation, the subscribers to the memorandum and all other persons who may, from time to time, become members of the company, shall be a body corporate by the name contained in the memorandum, capable of exercising all the functions of an incorporated company under this Act."

Central Goods and Services Tax Act 2017, Section 22 — Persons liable for registration:

"Every supplier shall be liable to be registered under this Act in the State or Union territory, other than special category States, from where he makes a taxable supply of goods or services or both, if his aggregate turnover in a financial year exceeds twenty lakh rupees."

Key requirement: A legal entity cannot register for GST before the date it is legally incorporated. The GST registration date must be equal to or later than the date of incorporation on the Certificate of Incorporation. Earlier dates indicate either an error in document submission or an undisclosed predecessor entity (e.g. a partnership firm or proprietorship that was converted).`,
  },

  // ── Paid-up > Authorized capital ─────────────────────────────────────────
  "Companies Act 2013, Sec 61 & SEBI ICDR Reg 231": {
    shortTitle: "Companies Act §61 / ICDR Reg 231",
    fullTitle: "Power to Alter Share Capital & Issuer Capital Structure",
    chapter: "Companies Act 2013 & Chapter IX — Issue of Capital by SMEs",
    sebiUrl: "https://www.sebi.gov.in/legal/regulations/nov-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html",
    text: `Companies Act 2013, Section 61 — Power of limited company to alter its share capital:

"A limited company having a share capital may, if so authorised by its articles, alter its memorandum in its general meeting to increase its authorised share capital by such amount as it thinks expedient."

Under Section 61, paid-up share capital cannot, at any point in time, exceed the authorised share capital stated in the Memorandum of Association. An increase in authorised capital requires filing Form SH-7 with the Registrar of Companies.

SEBI (ICDR) Regulations 2018, Regulation 231 — Conditions for SME IPO:

"The issuer shall ensure that the capital structure as disclosed in the offer document is accurate, complete, and that no portion of the paid-up share capital has been issued in excess of the limits permitted under the Companies Act or any other applicable law."

Key requirement: Paid-up capital must not exceed authorised capital at any point in the company's history, including the post-IPO structure. SEBI verifiers cross-check this against the ROC master data.`,
  },

  // ── SME paid-up cap ────────────────────────────────────────────────────────
  "SEBI ICDR Reg 229(1)": {
    shortTitle: "ICDR Reg 229(1)",
    fullTitle: "Application — SME IPO Eligibility (Post-Issue Paid-up Capital Cap)",
    chapter: "Chapter IX — Issue of Capital by Small and Medium Enterprises",
    sebiUrl: "https://www.sebi.gov.in/legal/regulations/nov-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html",
    text: `Regulation 229(1) — SEBI (ICDR) Regulations, 2018

"The provisions of this Chapter shall apply to an issuer whose post-issue paid-up capital, calculated on the basis of the proposed issue price, does not exceed ten crore rupees [as amended by SEBI Circular SEBI/HO/CFD/DIL2/CIR/P/2019/50 raising the threshold to twenty-five crore rupees for issuers migrating to the SME exchange platform]."

[As per the SEBI Circular dated April 3, 2019, the post-issue paid-up capital ceiling for SME IPOs was revised to ₹25 Crores. Issuers whose post-issue paid-up capital exceeds ₹25 Crores are required to list on the Main Board (BSE/NSE) and comply with the full ICDR Chapter VI–VIII requirements, which include a minimum three-year track record and mandatory QIB subscription of 75%.]

Key requirement: Post-issue paid-up capital = pre-issue paid-up capital + fresh issue size. If this sum exceeds ₹25 Crores, the company must migrate to the Main Board listing route.`,
  },

  // ── Promoter lock-in ───────────────────────────────────────────────────────
  "SEBI ICDR Reg 236(1) & 236(2)": {
    shortTitle: "ICDR Reg 236(1) & 236(2)",
    fullTitle: "Lock-in of Minimum Promoters' Contribution",
    chapter: "Chapter IX — Issue of Capital by Small and Medium Enterprises",
    sebiUrl: "https://www.sebi.gov.in/legal/regulations/nov-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html",
    text: `Regulation 236(1) — SEBI (ICDR) Regulations, 2018

"The promoters of the issuer shall contribute in the public issue of the SME exchange, a minimum of twenty per cent of the post-issue capital."

Regulation 236(2) — SEBI (ICDR) Regulations, 2018

"The minimum promoters' contribution as specified in sub-regulation (1) shall be locked in for a period of three years from the date of allotment in the proposed public issue."

Key requirement: Promoters must retain at least 20% of post-issue paid-up equity capital. This is calculated as:
Post-issue promoter holding % = (Pre-issue promoter shares) ÷ (Total post-issue shares) × 100

If the issue involves an Offer for Sale (OFS), care must be taken to ensure that promoter selling shareholders do not dilute below this threshold. The lock-in applies to the minimum contribution for 3 years; excess promoter shares are locked for 1 year.`,
  },

  // ── Objects vs issue size ─────────────────────────────────────────────────
  "SEBI ICDR Reg 247(1) & 247(2)": {
    shortTitle: "ICDR Reg 247(1) & 247(2)",
    fullTitle: "Objects of the Issue — Full Proceeds Deployment",
    chapter: "Chapter IX — Issue of Capital by Small and Medium Enterprises",
    sebiUrl: "https://www.sebi.gov.in/legal/regulations/nov-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html",
    text: `Regulation 247(1) — SEBI (ICDR) Regulations, 2018

"The issuer shall disclose the objects of the issue and the requirement of funds in the offer document. The total funds required shall be equal to the total issue size, inclusive of issue expenses."

Regulation 247(2) — SEBI (ICDR) Regulations, 2018

"The issuer shall disclose specific purposes for which the net proceeds shall be utilised. No amount shall remain unaccounted for in the deployment schedule. Where any portion is designated as General Corporate Purposes, such amount shall not exceed twenty-five per cent of the gross proceeds."

Key requirement: Σ (Expansion + Working Capital + Debt Repayment + General Corporate Purposes + Issue Expenses) must equal the total issue size to the rupee. Any shortfall or excess is treated as a disclosure deficiency and the offer document will be returned for rectification. Issue expenses must be estimated by the Lead Manager and explicitly itemised.`,
  },

  // ── Price band width ───────────────────────────────────────────────────────
  "SEBI ICDR Reg 253(1) & SEBI Circular SEBI/HO/CFD/DIL1/CIR/P/2020/249": {
    shortTitle: "ICDR Reg 253(1) / SEBI Circular 2020/249",
    fullTitle: "Price Band — Maximum Spread",
    chapter: "Chapter IX — Issue of Capital by Small and Medium Enterprises",
    sebiUrl: "https://www.sebi.gov.in/legal/regulations/nov-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html",
    text: `Regulation 253(1) — SEBI (ICDR) Regulations, 2018

"The issuer may determine the price of the specified securities in consultation with the lead manager. Where the issuer opts for a price band, the cap of the price band shall not be more than one hundred and twenty per cent of the floor price."

SEBI Circular SEBI/HO/CFD/DIL1/CIR/P/2020/249 (December 22, 2020):

"…reiterated that the cap price of the price band shall not exceed 120% of the floor price for all book-built issues, including SME IPOs. Merchant bankers shall ensure compliance with this requirement before filing the DRHP."

Key requirement: If floor price (lower band) = ₹X, then cap price (upper band) ≤ ₹1.20X. Equivalently, (Cap − Floor) / Floor ≤ 20%. A tighter band gives investors better price discovery; excessively wide bands are disallowed to prevent price manipulation.`,
  },

  // ── PAN format ────────────────────────────────────────────────────────────
  "Income Tax Act 1961, Sec 139A": {
    shortTitle: "Income Tax Act 1961 §139A",
    fullTitle: "Permanent Account Number (PAN) — Mandatory Quoting",
    chapter: "Income Tax Act 1961 — General Provisions",
    sebiUrl: "https://incometaxindia.gov.in/acts/income-tax-act-1961.pdf",
    text: `Income Tax Act 1961, Section 139A — Permanent Account Number:

"(1) Every person shall, if his total income or the total income of any other person in respect of which he is assessable under this Act during any previous year exceeded the maximum amount which is not chargeable to income-tax, apply to the Assessing Officer for allotment of a permanent account number."

"(5) Every person shall quote his permanent account number in all documents pertaining to the transactions specified by the Board in the interest of the revenue."

PAN Format (per CBDT rules): The PAN consists of 10 alphanumeric characters in the structure: [5 uppercase letters][4 digits][1 uppercase letter]. The 4th character indicates the taxpayer type (P = Individual, C = Company, H = HUF, F = Firm, A = AOP/BOI, T = AJP/Trust, B = BOI, L = Local Authority, J = Artificial Juridical Person, G = Government).

Key requirement for SEBI filings: The PAN on the offer document must match the PAN as registered with the Income Tax department and must be in the correct format. OCR errors frequently introduce character confusion (0/O, 1/I).`,
  },

  // ── GSTIN format ──────────────────────────────────────────────────────────
  "GST Act 2017, Sec 25 & CGST Rules, Rule 8": {
    shortTitle: "GST Act §25 / CGST Rule 8",
    fullTitle: "GST Registration — GSTIN Format",
    chapter: "Central Goods and Services Tax Act 2017",
    sebiUrl: "https://www.gst.gov.in/download/gstlaw",
    text: `Central Goods and Services Tax Act 2017, Section 25 — Procedure for registration:

"(1) Every person who is liable to be registered under section 22 or section 24 shall apply for registration in every such State or Union territory in which he is so liable within thirty days from the date on which he becomes liable to registration, in such manner and subject to such conditions as may be prescribed."

CGST Rules 2017, Rule 8 — Application for registration:

The Goods and Services Tax Identification Number (GSTIN) is a 15-character alphanumeric code structured as follows:
  • Positions 1–2: 2-digit State code (e.g., 27 = Maharashtra, 29 = Karnataka, 33 = Tamil Nadu)
  • Positions 3–12: 10-character PAN of the taxpayer
  • Position 13: Entity number (1–9 for the first 9, then A–Z for further registrations in the same state)
  • Position 14: Always 'Z' (default character)
  • Position 15: Check digit (alphanumeric)

Key requirement for SEBI filings: The GSTIN submitted in the offer document must be verifiable on the GST portal (gst.gov.in → Search Taxpayer). Malformed GSTINs indicate transcription errors during document preparation or OCR extraction.`,
  },

  // ── Narrative quality ──────────────────────────────────────────────────────
  "SEBI ICDR Schedule VI Part A & Reg 248": {
    shortTitle: "ICDR Schedule VI / Reg 248",
    fullTitle: "Offer Document Disclosures — Narrative Quality & Investor Protection",
    chapter: "Chapter IX — Issue of Capital by Small and Medium Enterprises",
    sebiUrl: "https://www.sebi.gov.in/legal/regulations/nov-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html",
    text: `Regulation 248 — SEBI (ICDR) Regulations, 2018 — Offer document content:

"The offer document shall contain all material disclosures which are necessary for the investors to make an informed investment decision including disclosures pertaining to risk factors, business overview, management discussion and analysis, industry overview, and related party transactions."

Schedule VI, Part A — Standard Observations Issued by SEBI on Draft Offer Documents:

Key narrative quality requirements:
  1. Risk factors must be specific, quantified, and ranked in order of materiality. Generic boilerplate risk statements (e.g., "we operate in a competitive industry") without supporting data are flagged for revision.
  2. Business overview must describe revenue streams, customer concentration, and operational dependencies with specific figures, not vague qualitative statements.
  3. Promoter experience must cite verifiable tenure, roles, and achievements — unsubstantiated claims are treated as misleading disclosures.
  4. Objects of the issue narrative must cross-reference cost estimates obtained from credible third parties (CA certificates, quotations, appraisal reports).

SEBI staff may issue an Observation Letter returning the DRHP for improvement of narrative disclosures without numerical errors, purely on quality grounds.`,
  },
};

/**
 * Look up an ICDR regulation entry by the sebi_ref string on a flag.
 * Returns the regulation object or null if not found.
 * @param {string} sebiRef
 * @returns {object|null}
 */
export function lookupRegulation(sebiRef) {
  if (!sebiRef) return null;
  return ICDR_REGULATIONS[sebiRef] ?? null;
}
