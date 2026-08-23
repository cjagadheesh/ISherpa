import unittest
from hallucination_guard import HallucinationGuard

class TestHallucinationGuard(unittest.TestCase):
    def setUp(self):
        self.guard = HallucinationGuard()
        self.session = {
            "form_data": {
                "issue_size_cr": 18.5,
                "revenue_fy24": 42.5,
                "company_name": "Sunrise Ceramics Limited",
                "promoter_holding_pct": 68.0,
            }
        }

    def test_numbers_in_session_are_allowed(self):
        text = "The issue size is 18.5 Crores and FY24 revenue was 42.5 Crores."
        res = self.guard.check(text, self.session)
        self.assertTrue(res.passed)
        self.assertEqual(len(res.violations), 0)

    def test_invented_number_is_caught(self):
        text = "The company generated revenue of 99.9 Crores in FY24."
        res = self.guard.check(text, self.session)
        self.assertFalse(res.passed)
        self.assertIn("99.9", res.violations)

    def test_crore_to_lakh_conversion_not_flagged(self):
        # 18.5 Cr = 1850 Lakhs
        text = "The issue size aggregates to 1850 Lakhs."
        res = self.guard.check(text, self.session)
        self.assertTrue(res.passed)

    def test_clean_text_returned_when_no_violations(self):
        text = "Revenue was 42.5 Crores."
        res = self.guard.check(text, self.session)
        self.assertEqual(res.clean_text, text)

    def test_violation_marked_in_output(self):
        text = "Revenue was 999.9 Crores."
        res = self.guard.check(text, self.session)
        self.assertIn("⚠️[UNVERIFIED: 999.9]", res.clean_text)

if __name__ == '__main__':
    unittest.main()
