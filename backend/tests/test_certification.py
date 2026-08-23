import unittest
from certification import CertificationStore, CERTIFIABLE_SECTIONS

class TestCertification(unittest.TestCase):
    def setUp(self):
        self.store = CertificationStore()
        self.session = {}

    def test_export_blocked_without_certification(self):
        allowed, blocking = self.store.export_allowed(self.session)
        self.assertFalse(allowed)
        self.assertEqual(len(blocking), len(CERTIFIABLE_SECTIONS))

    def test_export_allowed_after_all_sections_certified(self):
        for sec in CERTIFIABLE_SECTIONS:
            self.store.certify(self.session, sec, banker_name="Senior Banker", banker_notes="Approved")
        allowed, blocking = self.store.export_allowed(self.session)
        self.assertTrue(allowed)
        self.assertEqual(len(blocking), 0)

    def test_certify_records_banker_name_and_timestamp(self):
        sec = CERTIFIABLE_SECTIONS[0]
        state = self.store.certify(self.session, sec, banker_name="John Doe", banker_notes="Looks complete")
        self.assertEqual(state.status, "certified")
        self.assertEqual(state.certified_by, "John Doe")
        self.assertIsNotNone(state.certified_at)

    def test_uncertify_resets_to_reviewed(self):
        sec = CERTIFIABLE_SECTIONS[0]
        self.store.certify(self.session, sec, banker_name="John Doe")
        state = self.store.uncertify(self.session, sec, reason="Need updated risk disclosure")
        self.assertEqual(state.status, "reviewed")
        allowed, blocking = self.store.export_allowed(self.session)
        self.assertFalse(allowed)
        self.assertIn(sec, blocking)

if __name__ == '__main__':
    unittest.main()
