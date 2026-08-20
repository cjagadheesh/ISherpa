import unittest
from consistency_checker import (
    check_capital_structure, check_gstin_format, check_objects_vs_issue, check_pan_format,
    check_eps_consistency, check_face_value_vs_price_band, check_litigation_narrative_consistency,
    check_auditor_consistency, check_waca_date_plausibility, check_segment_reporting_note,
    check_customer_concentration_consistency, check_cash_flow_pat_conversion,
    check_receivables_outpacing_revenue, run_all_consistency_checks,
)

class ConsistencyCheckerTests(unittest.TestCase):
    def test_valid_identity_formats_are_not_flagged(self):
        self.assertIsNone(check_pan_format('ABCDE1234F'))
        self.assertIsNone(check_gstin_format('27ABCDE1234F1Z5'))
    def test_invalid_identity_formats_are_flagged(self):
        self.assertEqual(check_pan_format('BAD')['id'], 'pan_format')
        self.assertEqual(check_gstin_format('BAD')['id'], 'gstin_format')
    def test_capital_structure_checks_authorized_capital(self):
        self.assertEqual(check_capital_structure(10, 12, None, None, None)[0]['id'], 'capital_exceeds_auth')
    def test_sme_paidup_cap_needs_price_band_to_compute(self):
        # fresh_issue_size_cr is money raised at issue price, not face value —
        # without a price band there's no way to size the new shares, so a
        # large fresh issue alone (e.g. a real main-board IPO) must not misfire.
        self.assertEqual(check_capital_structure(10, 4.5, 400.0, 10, None), [])
    def test_sme_paidup_cap_flagged_when_computable_and_exceeded(self):
        # 20 Cr paid-up + (30 Cr fresh issue / 10 issue price * 10 face value) = 50 Cr > 25 Cr cap
        flags = check_capital_structure(60, 20.0, 30.0, 10, '10 - 12')
        self.assertIn('sme_paidup_cap', [f['id'] for f in flags])
    def test_sme_paidup_cap_not_flagged_when_within_cap(self):
        flags = check_capital_structure(10, 1.0, 5.0, 10, '100 - 105')
        self.assertNotIn('sme_paidup_cap', [f['id'] for f in flags])
    def test_objects_total_must_match_issue_size(self):
        data = {'issue_size': 10, 'expansion_amount': 2, 'working_capital_amount': 2, 'debt_repayment_amount': 2, 'general_corp_amount': 2, 'issue_expenses': 1}
        self.assertEqual(check_objects_vs_issue(data)['id'], 'objects_vs_issue')
    def test_issue_proceeds_do_not_infer_promoter_holding(self):
        flags = run_all_consistency_checks({'promoter_shareholding_pre_pct': 30, 'issue_size': 100, 'paid_up_capital_pre': 10}, {})
        self.assertNotIn('promoter_lockdown', [flag['id'] for flag in flags])

    def test_diluted_eps_exceeding_basic_is_flagged(self):
        eps_basic = [{'fy': 'FY26', 'value': 5.0}]
        eps_diluted = [{'fy': 'FY26', 'value': 6.0}]
        self.assertEqual(check_eps_consistency(eps_basic, eps_diluted)['id'], 'eps_diluted_exceeds_basic')
    def test_diluted_eps_within_basic_is_not_flagged(self):
        eps_basic = [{'fy': 'FY26', 'value': 5.0}]
        eps_diluted = [{'fy': 'FY26', 'value': 4.5}]
        self.assertIsNone(check_eps_consistency(eps_basic, eps_diluted))

    def test_face_value_above_price_band_floor_is_flagged(self):
        self.assertEqual(check_face_value_vs_price_band(10, '8 - 9')['id'], 'face_value_exceeds_price_band')
    def test_face_value_below_price_band_floor_is_not_flagged(self):
        self.assertIsNone(check_face_value_vs_price_band(10, '100 - 105'))

    def test_litigation_table_vs_denying_narrative_is_flagged(self):
        summary = [{'entity_type': 'Company - Against', 'criminal_count': 0, 'tax_count': 2, 'statutory_regulatory_count': 0, 'civil_litigation_count': 0}]
        flag = check_litigation_narrative_consistency(summary, 'No material litigations are pending against the Company.')
        self.assertEqual(flag['id'], 'litigation_narrative_mismatch')
    def test_litigation_table_matching_narrative_is_not_flagged(self):
        summary = [{'entity_type': 'Company - Against', 'criminal_count': 0, 'tax_count': 2, 'statutory_regulatory_count': 0, 'civil_litigation_count': 0}]
        self.assertIsNone(check_litigation_narrative_consistency(summary, 'One tax proceeding is pending against the Company.'))
    def test_zero_litigation_summary_is_not_flagged(self):
        summary = [{'entity_type': 'Company - Against', 'criminal_count': 0, 'tax_count': 0, 'statutory_regulatory_count': 0, 'civil_litigation_count': 0}]
        self.assertIsNone(check_litigation_narrative_consistency(summary, 'No material litigations are pending.'))

    def test_auditor_name_mismatch_is_flagged(self):
        flag = check_auditor_consistency('Vikram Rao & Co', 'Kothari Mehta & Associates, Chartered Accountants')
        self.assertEqual(flag['id'], 'auditor_mismatch')
    def test_auditor_name_match_is_not_flagged(self):
        self.assertIsNone(check_auditor_consistency('Kothari Mehta & Associates', 'Kothari Mehta & Associates, Chartered Accountants'))

    def test_waca_date_before_incorporation_is_flagged(self):
        flag = check_waca_date_plausibility('2010-01-01', '2011-04-12')
        self.assertEqual(flag['id'], 'waca_date_implausible')
    def test_waca_date_after_incorporation_is_not_flagged(self):
        self.assertIsNone(check_waca_date_plausibility('2026-07-25', '2011-04-12'))

    def test_segment_reporting_note_missing_is_flagged(self):
        flag = check_segment_reporting_note(False, '')
        self.assertEqual(flag['id'], 'segment_reporting_note_missing')
    def test_segment_reporting_note_present_is_not_flagged(self):
        self.assertIsNone(check_segment_reporting_note(False, 'Single reportable segment.'))
    def test_segment_reporting_applicable_true_is_not_flagged(self):
        self.assertIsNone(check_segment_reporting_note(True, ''))

    def test_customer_concentration_mismatch_is_flagged(self):
        table = [{'customer_name': 'A', 'fy1_pct': 40.0}]
        flag = check_customer_concentration_consistency(10.0, table)
        self.assertEqual(flag['id'], 'customer_concentration_mismatch')
    def test_customer_concentration_match_is_not_flagged(self):
        table = [{'customer_name': 'A', 'fy1_pct': 18.0}, {'customer_name': 'B', 'fy1_pct': 12.0}]
        self.assertIsNone(check_customer_concentration_consistency(30.0, table))

    def test_weak_cash_flow_pat_conversion_is_flagged(self):
        merged = {
            'cash_flow_operating': [{'fy': 'FY26', 'value': 2.0}],
            'pat': [{'fy': 'FY26', 'value': 10.0}],  # CFO is 20% of PAT
        }
        flag = check_cash_flow_pat_conversion(merged)
        self.assertEqual(flag['id'], 'cash_flow_pat_conversion_weak')
    def test_healthy_cash_flow_pat_conversion_is_not_flagged(self):
        merged = {
            'cash_flow_operating': [{'fy': 'FY26', 'value': 9.0}],
            'pat': [{'fy': 'FY26', 'value': 10.0}],  # CFO is 90% of PAT
        }
        self.assertIsNone(check_cash_flow_pat_conversion(merged))
    def test_negative_pat_is_not_flagged(self):
        merged = {
            'cash_flow_operating': [{'fy': 'FY26', 'value': -1.0}],
            'pat': [{'fy': 'FY26', 'value': -5.0}],
        }
        self.assertIsNone(check_cash_flow_pat_conversion(merged))

    def test_receivables_outpacing_revenue_is_flagged(self):
        merged = {
            'trade_receivables': [{'fy': 'FY26', 'value': 40.0}, {'fy': 'FY25', 'value': 20.0}],   # +100%
            'revenue_from_operations': [{'fy': 'FY26', 'value': 110.0}, {'fy': 'FY25', 'value': 100.0}],  # +10%
        }
        flag = check_receivables_outpacing_revenue(merged)
        self.assertEqual(flag['id'], 'receivables_outpacing_revenue')
    def test_receivables_growth_tracking_revenue_is_not_flagged(self):
        merged = {
            'trade_receivables': [{'fy': 'FY26', 'value': 22.0}, {'fy': 'FY25', 'value': 20.0}],   # +10%
            'revenue_from_operations': [{'fy': 'FY26', 'value': 110.0}, {'fy': 'FY25', 'value': 100.0}],  # +10%
        }
        self.assertIsNone(check_receivables_outpacing_revenue(merged))
    def test_receivables_check_needs_two_years_of_both_fields(self):
        merged = {
            'trade_receivables': [{'fy': 'FY26', 'value': 40.0}],  # only 1 year
            'revenue_from_operations': [{'fy': 'FY26', 'value': 110.0}, {'fy': 'FY25', 'value': 100.0}],
        }
        self.assertIsNone(check_receivables_outpacing_revenue(merged))

if __name__ == '__main__': unittest.main()
