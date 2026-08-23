import json
import os
import unittest
from validator import validate_session_data

SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "..", "schema.json")


class ValidatorDeclarationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(SCHEMA_PATH) as f:
            cls.schema = json.load(f)

    def test_declaration_signed_with_missing_blocking_fields_is_flagged(self):
        session = {"form_data": {"declaration_signed": True}, "extracted_data": {}}
        result = validate_session_data(session, self.schema)
        ids = [f["id"] for f in result["inconsistencies"]]
        self.assertIn("declaration_signed_prematurely", ids)

    def test_declaration_not_signed_is_never_flagged(self):
        session = {"form_data": {"declaration_signed": False}, "extracted_data": {}}
        result = validate_session_data(session, self.schema)
        ids = [f["id"] for f in result["inconsistencies"]]
        self.assertNotIn("declaration_signed_prematurely", ids)

    def test_declaration_signed_with_all_blocking_fields_present_is_not_flagged(self):
        # Mirrors tests/test_coverage.py's "complete session" fixture — every
        # required+blocking field across the current schema populated.
        form_data = {
            "company_name": "Sunrise Ceramics Limited",
            "cin": "U26933RJ2018PLC062145",
            "registered_office": "Industrial Zone, Jaipur",
            "company_secretary_name": "Priya Shah",
            "contact_email": "cs@sunriseceramics.com",
            "contact_phone": "+91 22 4000 1234",
            "promoter_names": [{"name": "Rajesh Kumar"}],
            "company_acronym": "SCL",
            "lead_manager": "IPO Sherpa Merchant Bankers",
            "registrar": "Link Intime India Private Limited",
            "issue_size": 18.5,
            "price_band": "100 - 105",
            "fresh_issue_size_cr": 18.5,
            "face_value_per_share": 10,
            "internal_risks": "Raw material price volatility risk",
            "external_risks": "GST policy change risk",
            "auditor_name": "Audit Firm LLP",
            "auditor_membership": "084532N",
            "authorized_capital": 25.0,
            "paid_up_capital_pre": 10.0,
            "expansion_amount": 8.0,
            "working_capital_amount": 5.5,
            "debt_repayment_amount": 0.0,
            "issue_expenses": 0.5,
            "general_corp_amount": 4.5,
            "use_of_proceeds": [{"particular": "Expansion", "estimated_amount_cr": 8.0}],
            "products_services_description": "Tiles and ceramics manufacturing",
            "industries_served": "Construction, real estate",
            "typical_customers": "Retail tile distributors",
            "segment_reporting_applicable": False,
            "segment_reporting_note": "Single reportable segment.",
            "key_geographies_served": "Rajasthan, Gujarat",
            "top5_customer_revenue_table": [{"customer_name": "Top 5", "fy1_revenue": 20.0, "fy1_pct": 44.0}],
            "business_strengths": [{"strength": "Established distribution network"}],
            "business_strategies": [{"strategy": "Capacity expansion"}],
            "business_model": "Direct B2B institutional sales",
            "industry_name": "Tiles and Ceramics",
            "industry_report_source": "CRISIL Report",
            "promoters": [{"name": "Rajesh Kumar", "designation": "Managing Director", "din": "01234567"}],
            "directors": [{"name": "Rajesh Kumar", "din": "01234567", "designation": "Managing Director"}],
            "kmp": [{"name": "Anil Sharma", "designation": "CFO"}],
            "rpt_declared": "Director remuneration disclosed",
            "equity_share_capital": [{"fy": "FY24", "value": 10.0}],
            "net_worth": [{"fy": "FY24", "value": 28.0}],
            "revenue_from_operations": [{"fy": "FY24", "value": 42.5}],
            "ebitda": [{"fy": "FY24", "value": 7.5}],
            "pat": [{"fy": "FY24", "value": 4.8}],
            "eps_basic": [{"fy": "FY24", "value": 4.8}],
            "eps_diluted": [{"fy": "FY24", "value": 4.8}],
            "total_borrowings": [{"fy": "FY24", "value": 12.4}],
            "auditor_qualifications": "None",
            "kpi_sector": "Manufacturing",
            "kpi_values": [{"kpi_name": "EBITDA Margin", "unit": "%", "fy1_value": 17.6}],
            "pre_offer_shareholding": [{"shareholder": "Rajesh Kumar", "shares": 1000000, "pct": 68.0}],
            "promoter_shareholding_pre_pct": 68.0,
            "promoter_group_members": [{"name": "Sunita Kumar", "relationship": "Spouse"}],
            "waca_table": [{"shareholder": "Rajesh Kumar", "shares_held": 1000000, "waca_per_share": 5.0}],
            "waca_ca_certificate_date": "2026-06-01",
            "litigation_summary": [{"entity_type": "Company - By", "criminal_count": 0, "tax_count": 0, "statutory_regulatory_count": 0, "civil_litigation_count": 0, "aggregate_amount_cr": 0}],
            "pan": "ABCDE1234F",
            "material_contracts_desc": "Underwriting agreement dated Jan 2026",
            "incorporation_date": "2018-04-12",
            "declaration_signed": True,
        }
        session = {"form_data": form_data, "extracted_data": {}}
        result = validate_session_data(session, self.schema)
        ids = [f["id"] for f in result["inconsistencies"]]
        self.assertNotIn("declaration_signed_prematurely", ids)


if __name__ == "__main__":
    unittest.main()
