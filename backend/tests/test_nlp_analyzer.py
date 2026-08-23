import json
import unittest
from unittest.mock import MagicMock, patch
from nlp_analyzer import (
    analyze_prospectus_narratives,
    nlp_semantic_match,
    nlp_extract_entities,
    nlp_assess_readability_and_quality,
    nlp_summarize_text,
    nlp_analyze_full_session,
    _NARRATIVE_SCAN_CACHE,
)

class NLPAnalyzerTests(unittest.TestCase):
    def test_analyze_prospectus_narratives_returns_flags(self):
        form_data = {
            "products_services_description": "We are a market leader rapidly growing across India.",
            "internal_risks": "General economic downturn could affect our business.",
            "promoter_experience": "Promoters have 20 years of experience."
        }
        res = analyze_prospectus_narratives(form_data)
        self.assertEqual(res["status"], "success")
        self.assertGreaterEqual(res["total_flags"], 1)
        self.assertIn("investor_protection_score", res)
        self.assertIn("nlp_quality", res)
        self.assertIsInstance(res["red_flags"], list)

    def test_analyze_empty_narratives_handles_gracefully(self):
        res = analyze_prospectus_narratives({})
        self.assertEqual(res["status"], "success")
        self.assertIsInstance(res["red_flags"], list)

    def test_narrative_llm_scan_is_cached_on_identical_content(self):
        _NARRATIVE_SCAN_CACHE.clear()
        mock_llm = MagicMock()
        mock_llm.is_available.return_value = True
        mock_llm.provider = "groq"
        mock_llm.complete.return_value = json.dumps([])
        form_data = {"internal_risks": "Raw material price volatility of key chemical inputs."}
        with patch("nlp_analyzer.get_llm_client", return_value=mock_llm):
            first = analyze_prospectus_narratives(form_data)
            second = analyze_prospectus_narratives(dict(form_data))
        self.assertEqual(first["source"], "llm_scan")
        self.assertEqual(second["source"], "llm_scan")
        self.assertEqual(mock_llm.complete.call_count, 1)
        _NARRATIVE_SCAN_CACHE.clear()

    def test_narrative_llm_scan_rescans_on_changed_content(self):
        _NARRATIVE_SCAN_CACHE.clear()
        mock_llm = MagicMock()
        mock_llm.is_available.return_value = True
        mock_llm.provider = "groq"
        mock_llm.complete.return_value = json.dumps([])
        with patch("nlp_analyzer.get_llm_client", return_value=mock_llm):
            analyze_prospectus_narratives({"internal_risks": "Raw material price volatility."})
            analyze_prospectus_narratives({"internal_risks": "A completely different risk narrative."})
        self.assertEqual(mock_llm.complete.call_count, 2)
        _NARRATIVE_SCAN_CACHE.clear()

    def test_nlp_semantic_match(self):
        # Legal suffix variation
        match_res = nlp_semantic_match("Vertex Chemtech Pvt Ltd", "Vertex Chemtech Private Limited")
        self.assertTrue(match_res["is_match"])
        self.assertGreaterEqual(match_res["score"], 0.75)

        # Mismatched company names
        no_match = nlp_semantic_match("Vertex Chemtech Ltd", "Global Bio-Tech Industries")
        self.assertFalse(no_match["is_match"])

    def test_nlp_extract_entities(self):
        sample_text = "Vertex Chemtech Ltd (CIN: U24110RJ2018PLC062145) reported revenue of INR 42.5 Crores under SEBI guidelines on 2024-03-31."
        entities = nlp_extract_entities(sample_text)
        self.assertIn("SEBI", entities["regulatory_bodies"])
        self.assertIn("U24110RJ2018PLC062145", entities["identifiers"])
        self.assertTrue(len(entities["monetary_amounts"]) > 0)

    def test_nlp_assess_readability_and_quality(self):
        text = "We are a market leader providing world class products with guaranteed growth in an unprecedented market."
        quality = nlp_assess_readability_and_quality(text)
        self.assertGreater(quality["vagueness_score"], 0)
        self.assertEqual(quality["clarity_rating"], "NEEDS_IMPROVEMENT")
        self.assertIn("market leader", quality["vague_phrases"])

    def test_nlp_summarize_text(self):
        text = "Vertex Chemtech Limited is a chemical manufacturing enterprise based in Rajasthan. The company manufactures industrial solvents and speciality reagents for pharmaceutical clients across Western India. In FY2024, the company recorded total sales of 42.5 Crores."
        summary = nlp_summarize_text(text, target_words=50)
        self.assertTrue(len(summary) > 0)

    def test_nlp_analyze_full_session(self):
        session = {
            "form_data": {
                "company_name": "Vertex Chemtech Limited",
                "business_overview": "Vertex Chemtech Limited produces specialty chemical reagents for pharma partners.",
                "risk_factors": "Raw material price volatility of key chemical inputs."
            },
            "extracted_data": {}
        }
        res = nlp_analyze_full_session(session)
        self.assertEqual(res["status"], "success")
        self.assertIn("entity_extraction", res)
        self.assertIn("quality_metrics", res)
        self.assertIn("summary", res)

if __name__ == '__main__':
    unittest.main()

