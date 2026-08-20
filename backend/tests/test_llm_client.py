import os
import threading
import unittest
from unittest.mock import MagicMock, patch


def _fake_groq_ctor_factory(call_log, fail_keys=frozenset()):
    """Builds a fake groq.Groq(api_key=...) constructor. Clients created for a
    key in `fail_keys` raise a RateLimitError-named exception on every call;
    others return a canned successful completion recording which key answered.
    """
    class FakeRateLimitError(Exception):
        pass
    FakeRateLimitError.__name__ = "RateLimitError"

    def ctor(api_key):
        client = MagicMock()

        def create(**kwargs):
            call_log.append(api_key)
            if api_key in fail_keys:
                raise FakeRateLimitError(f"{api_key} exhausted")
            resp = MagicMock()
            resp.choices = [MagicMock(message=MagicMock(content=f"reply-from-{api_key}"))]
            return resp

        client.chat.completions.create.side_effect = create
        return client

    return ctor


class LLMClientGroqPoolTests(unittest.TestCase):
    def setUp(self):
        os.environ["LLM_PROVIDER"] = "groq"
        for var in ("GROQ_API_KEY", "GROQ_API_KEY_2", "GROQ_API_KEY_3", "GROQ_API_KEYS"):
            os.environ.pop(var, None)

    def test_single_key_behaves_normally(self):
        os.environ["GROQ_API_KEY"] = "key-A"
        call_log = []
        with patch("groq.Groq", side_effect=_fake_groq_ctor_factory(call_log)):
            from llm_client import LLMClient
            llm = LLMClient(provider="groq")
            result = llm.complete(messages=[{"role": "user", "content": "hi"}])
        self.assertEqual(result, "reply-from-key-A")
        self.assertEqual(call_log, ["key-A"])

    def test_round_robins_across_pool_regardless_of_failure(self):
        os.environ["GROQ_API_KEY"] = "key-A"
        os.environ["GROQ_API_KEY_2"] = "key-B"
        os.environ["GROQ_API_KEY_3"] = "key-C"
        call_log = []
        with patch("groq.Groq", side_effect=_fake_groq_ctor_factory(call_log)):
            from llm_client import LLMClient
            llm = LLMClient(provider="groq")
            for _ in range(6):
                llm.complete(messages=[{"role": "user", "content": "hi"}])
        # 3 keys, 6 calls: each key used exactly twice, in rotation order.
        self.assertEqual(call_log, ["key-A", "key-B", "key-C"] * 2)

    def test_groq_api_keys_comma_separated_also_pooled(self):
        os.environ["GROQ_API_KEY"] = "key-A"
        os.environ["GROQ_API_KEYS"] = "key-B, key-C"
        call_log = []
        with patch("groq.Groq", side_effect=_fake_groq_ctor_factory(call_log)):
            from llm_client import LLMClient
            llm = LLMClient(provider="groq")
            self.assertEqual(len(llm._groq_clients), 3)

    def test_duplicate_keys_across_sources_not_double_counted(self):
        os.environ["GROQ_API_KEY"] = "key-A"
        os.environ["GROQ_API_KEY_2"] = "key-A"
        with patch("groq.Groq", side_effect=_fake_groq_ctor_factory([])):
            from llm_client import LLMClient
            llm = LLMClient(provider="groq")
            self.assertEqual(len(llm._groq_clients), 1)

    def test_rate_limited_key_retries_next_key_in_pool(self):
        os.environ["GROQ_API_KEY"] = "key-A"
        os.environ["GROQ_API_KEY_2"] = "key-B"
        call_log = []
        with patch("groq.Groq", side_effect=_fake_groq_ctor_factory(call_log, fail_keys={"key-A"})):
            from llm_client import LLMClient
            llm = LLMClient(provider="groq")
            result = llm.complete(messages=[{"role": "user", "content": "hi"}])
        self.assertEqual(result, "reply-from-key-B")
        self.assertEqual(call_log, ["key-A", "key-B"])

    def test_all_keys_rate_limited_raises(self):
        os.environ["GROQ_API_KEY"] = "key-A"
        os.environ["GROQ_API_KEY_2"] = "key-B"
        from llm_client import is_rate_limit_error
        with patch("groq.Groq", side_effect=_fake_groq_ctor_factory([], fail_keys={"key-A", "key-B"})):
            from llm_client import LLMClient
            llm = LLMClient(provider="groq")
            with self.assertRaises(Exception) as ctx:
                llm.complete(messages=[{"role": "user", "content": "hi"}])
        self.assertTrue(is_rate_limit_error(ctx.exception))

    def test_concurrent_calls_never_collide_on_the_same_start_index(self):
        # Verifies the round-robin counter is safe under concurrent complete()
        # calls from multiple threads (mirrors real usage: several document
        # uploads extracted in parallel background jobs sharing one LLMClient).
        os.environ["GROQ_API_KEY"] = "key-A"
        os.environ["GROQ_API_KEY_2"] = "key-B"
        os.environ["GROQ_API_KEY_3"] = "key-C"
        call_log = []
        lock = threading.Lock()

        def ctor(api_key):
            client = MagicMock()

            def create(**kwargs):
                with lock:
                    call_log.append(api_key)
                resp = MagicMock()
                resp.choices = [MagicMock(message=MagicMock(content="ok"))]
                return resp

            client.chat.completions.create.side_effect = create
            return client

        with patch("groq.Groq", side_effect=ctor):
            from llm_client import LLMClient
            llm = LLMClient(provider="groq")
            threads = [threading.Thread(target=llm.complete, kwargs={"messages": [{"role": "user", "content": "hi"}]}) for _ in range(30)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        self.assertEqual(len(call_log), 30)
        # Even distribution: no key silently starved or double-hit far more than others.
        counts = {k: call_log.count(k) for k in ("key-A", "key-B", "key-C")}
        self.assertEqual(sum(counts.values()), 30)
        self.assertTrue(all(c == 10 for c in counts.values()), counts)


if __name__ == "__main__":
    unittest.main()
