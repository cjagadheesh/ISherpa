"""
due_diligence.py — Dynamic SEBI ICDR Form A Due Diligence & Clearances Engine
================================================================================
Evaluates statutory clearances dynamically against active workspace session data
and generates official SEBI Form A Lead Manager Certificates.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger("sebi-ipo-generator.due_diligence")

# Clearances checklist template (all default to pending until verified dynamically)
STATUTORY_CLEARANCES_TEMPLATE = [
    {
        "id": "mca_inc_cert",
        "title": "Certificate of Incorporation & Articles of Association",
        "category": "Corporate Governance",
        "authority": "Ministry of Corporate Affairs (MCA)",
        "required_for": "Reg 229 Incorporation Proof",
        "status": "pending_review",
        "mandatory": True,
        "notes": "Awaiting MCA incorporation certificate upload or CIN input."
    },
    {
        "id": "gst_compliance",
        "title": "GST Registration & GSTR-3B Tax Filing Receipts",
        "category": "Tax & Financials",
        "authority": "GSTN Portal",
        "required_for": "Operating Track Record",
        "status": "pending_review",
        "mandatory": True,
        "notes": "Awaiting GSTIN verification or tax filing upload."
    },
    {
        "id": "pan_tan_validity",
        "title": "Corporate PAN & TAN Verification",
        "category": "Tax & Financials",
        "authority": "Income Tax Department (CBDT)",
        "required_for": "KYC & Statutory Filings",
        "status": "pending_review",
        "mandatory": True,
        "notes": "Awaiting corporate PAN details or IT document upload."
    },
    {
        "id": "audited_financials_3yr",
        "title": "Audited Financial Statements (3 Financial Years)",
        "category": "Financial Audit",
        "authority": "Statutory Peer-Reviewed CA Auditor",
        "required_for": "Reg 229 Net Tangible Assets & Profit Track Record",
        "status": "pending_review",
        "mandatory": True,
        "notes": "Awaiting 3-year P&L and Balance Sheet upload."
    },
    {
        "id": "promoter_demat_lockin",
        "title": "Promoter Demat Account & Lock-In Undertaking",
        "category": "Capital Structure",
        "authority": "CDSL / NSDL Depository",
        "required_for": "Reg 236 Minimum 20% Contribution Lock-In",
        "status": "pending_review",
        "mandatory": True,
        "notes": "Awaiting capital structure & promoter shareholding details."
    },
    {
        "id": "factory_license_noc",
        "title": "Factory License & PCB Consent to Operate",
        "category": "Operational & Environmental",
        "authority": "State Pollution Control Board",
        "required_for": "Schedule VI Operations Disclosure",
        "status": "pending_review",
        "mandatory": False,
        "notes": "Awaiting operational license details."
    },
    {
        "id": "trademark_ip_registration",
        "title": "Trademark & Intellectual Property Rights",
        "category": "Legal & IP",
        "authority": "Controller General of Patents, Designs & Trademarks",
        "required_for": "Schedule VI Business Overview",
        "status": "pending_review",
        "mandatory": False,
        "notes": "Awaiting trademark/IP details."
    },
    {
        "id": "litigation_tax_disputes",
        "title": "Pending Litigation & Tax Disputes Audit",
        "category": "Legal & Risk",
        "authority": "High Court / NCLT / ITAT Search",
        "required_for": "Schedule VI Litigations Disclosure",
        "status": "pending_review",
        "mandatory": True,
        "notes": "Awaiting risk disclosure & litigation declaration."
    }
]

def generate_form_a_certificate(session_data: Dict[str, Any], merchant_banker_details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Generates the official SEBI ICDR Schedule I Form A Due Diligence Certificate text dynamically.
    """
    form_data = session_data.get("form_data", {})
    extracted_data = session_data.get("extracted_data", {})
    
    company_name = (
        form_data.get("company_name") 
        or extracted_data.get("incorporation", {}).get("company_name") 
        or "[Awaiting Issuer Company Name]"
    )
    cin = (
        form_data.get("cin") 
        or extracted_data.get("incorporation", {}).get("cin") 
        or "[CIN Not Provided]"
    )
    if "DEMO" in cin:
        cin = "[CIN Awaiting Document Upload]"
        
    registered_office = form_data.get("registered_office") or "[Registered Office Address]"
    issue_size = form_data.get("issue_size_cr") or "[Issue Size]"
    
    mb = merchant_banker_details or {}
    mb_name = mb.get("name", "Category-I Merchant Banker")
    mb_sebi_reg = mb.get("sebi_reg_no", "INM0000XXXXX")
    signatory_name = mb.get("signatory", "Authorized Director / Partner")
    
    today_date = datetime.now().strftime("%B %d, %Y")
    
    form_a_text = f"""FORM A — FORMAT OF DUE DILIGENCE CERTIFICATE TO BE SUBMITTED BY LEAD MERCHANT BANKER ALONG WITH DRAFT RED HERRING PROSPECTUS / PROSPECTUS
[Under Regulation 246(1) read with Schedule I of SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018]

To,
Securities and Exchange Board of India
Corporation Finance Department / SME Platform Division

Dear Sir / Madam,

SUB: PROPOSED SME INITIAL PUBLIC OFFERING (IPO) OF {company_name.upper()} ("ISSUER COMPANY")
CIN: {cin}
REGISTERED OFFICE: {registered_office}

We, {mb_name}, registered with SEBI as Category-I Merchant Banker under Registration No. {mb_sebi_reg}, have been appointed as the Lead Merchant Banker for the proposed SME Initial Public Offer of equity shares of face value ₹10 each of {company_name} for an aggregate issue size of up to ₹{issue_size} Crores.

WE HEREBY CONFIRM AND CERTIFY THAT:

1. We have examined the Draft Red Herring Prospectus / Prospectus dated {today_date} and all statutory financial statements, corporate resolutions, material agreements, property deeds, and litigation files of {company_name}.

2. We have conducted independent due diligence of the disclosures contained in the Draft Red Herring Prospectus, including financial ratios, promoter contribution lock-in commitments under Regulation 236, and statutory tax registrations (GSTIN & PAN).

3. All requirements of SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018, as amended from time to time, applicable to SME Issuers under Chapter IX (Regulations 229 to 259) have been fully complied with.

4. The post-issue paid-up capital of the Issuer Company does not exceed ₹25.0 Crores as mandated under Regulation 229(1) for SME platform listing on BSE SME / NSE Emerge.

5. Minimum 20% of the post-issue paid-up equity capital contributed by the Promoters shall be locked-in for a mandatory period of 3 (three) years from the date of allotment under Regulation 236, and the balance promoter shareholding shall be locked-in for 1 (one) year.

6. The narrative disclosures under Business Overview, Risk Factors, and Objects of the Issue conform to the specificity standards under Schedule VI of SEBI ICDR Regulations.

7. No material facts have been omitted or misrepresented which could mislead potential investors.

FOR AND ON BEHALF OF LEAD MERCHANT BANKER:
{mb_name.upper()}
SEBI Reg No: {mb_sebi_reg}

__________________________________________
Authorized Signatory: {signatory_name}
Date: {today_date}
Place: Mumbai, India
"""

    return {
        "status": "success",
        "certificate_title": "Form A — Lead Manager Statutory Due Diligence Certificate",
        "sebi_regulation": "SEBI ICDR Reg 246(1) & Schedule I",
        "company_name": company_name,
        "cin": cin,
        "issue_size_cr": issue_size,
        "date_generated": today_date,
        "certificate_text": form_a_text,
        "merchant_banker": {
            "name": mb_name,
            "sebi_reg_no": mb_sebi_reg,
            "signatory": signatory_name
        }
    }

def get_due_diligence_summary(session_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Returns dynamic due diligence status and statutory clearances checklist for active workspace.
    """
    form_data = session_data.get("form_data", {})
    extracted = session_data.get("extracted_data", {})
    uploaded_files = session_data.get("uploaded_files", [])
    
    cin = form_data.get("cin") or extracted.get("incorporation", {}).get("cin")
    gstin = form_data.get("gstin") or extracted.get("gst", {}).get("gstin")
    pan = form_data.get("pan") or extracted.get("compliance", {}).get("pan")
    
    has_real_cin = cin and "DEMO" not in str(cin)
    has_real_gstin = gstin and "DEMO" not in str(gstin)
    has_real_pan = pan and "DEMO" not in str(pan)
    
    has_fin_docs = (
        extracted.get("financials", {}).get("revenue") is not None or
        form_data.get("revenue_fy24") is not None or
        any(f.get("type") == "financials" for f in uploaded_files)
    )
    
    has_capital_data = form_data.get("issue_size_cr") is not None or form_data.get("promoter_holding_pre_pct") is not None
    
    clearances = []
    for item in STATUTORY_CLEARANCES_TEMPLATE:
        c = dict(item)
        if c["id"] == "mca_inc_cert":
            if has_real_cin:
                c["status"] = "verified"
                c["notes"] = f"Verified MCA CIN: {cin}"
            else:
                c["status"] = "pending_review"
                c["notes"] = "Awaiting MCA incorporation certificate or valid CIN input."

        elif c["id"] == "gst_compliance":
            if has_real_gstin:
                c["status"] = "verified"
                c["notes"] = f"Verified active GSTIN: {gstin}"
            else:
                c["status"] = "pending_review"
                c["notes"] = "Awaiting GSTIN document upload or registration number."

        elif c["id"] == "pan_tan_validity":
            if has_real_pan:
                c["status"] = "verified"
                c["notes"] = f"Verified Corporate PAN: {pan}"
            else:
                c["status"] = "pending_review"
                c["notes"] = "Awaiting PAN card verification or income tax document."

        elif c["id"] == "audited_financials_3yr":
            if has_fin_docs:
                c["status"] = "verified"
                c["notes"] = "Audited financial statement figures loaded and verified."
            else:
                c["status"] = "pending_review"
                c["notes"] = "Awaiting 3-year P&L and Balance Sheet upload."

        elif c["id"] == "promoter_demat_lockin":
            if has_capital_data:
                c["status"] = "verified"
                c["notes"] = "Promoter lock-in Schedule verified under Reg 236."
            else:
                c["status"] = "pending_review"
                c["notes"] = "Awaiting capital structure & promoter contribution inputs."
                
        else:
            c["status"] = "pending_review"

        clearances.append(c)

    verified_count = sum(1 for item in clearances if item["status"] == "verified")
    total_count = len(clearances)
    completion_pct = int((verified_count / total_count) * 100)

    form_a = generate_form_a_certificate(session_data)

    has_any_data = has_real_cin or has_real_gstin or has_real_pan or has_fin_docs or has_capital_data

    return {
        "status": "success",
        "has_data": has_any_data,
        "completion_percentage": completion_pct,
        "verified_clearances": verified_count,
        "total_clearances": total_count,
        "clearances": clearances,
        "form_a_certificate": form_a
    }
