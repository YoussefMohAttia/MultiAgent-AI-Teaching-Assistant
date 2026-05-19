import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from services.progress_service import event_to_metric_delta, resolve_level


class ResolveLevelTests(unittest.TestCase):
    def test_resolve_level_floor(self):
        level, rank, next_xp, progress = resolve_level(-5)
        self.assertEqual(level, 1)
        self.assertEqual(rank, "Copper")
        self.assertEqual(next_xp, 100)
        self.assertEqual(progress, 0.0)

    def test_resolve_level_mid(self):
        level, rank, next_xp, progress = resolve_level(130)
        self.assertEqual(level, 2)
        self.assertEqual(rank, "Copper")
        self.assertEqual(next_xp, 220)
        self.assertAlmostEqual(progress, (130 - 100) / (220 - 100))

    def test_resolve_level_high(self):
        level, rank, next_xp, progress = resolve_level(5000)
        self.assertEqual(level, 14)
        self.assertEqual(rank, "Diamond")
        self.assertEqual(next_xp, 5400)

    def test_resolve_level_max(self):
        level, rank, next_xp, progress = resolve_level(14000)
        self.assertEqual(level, 20)
        self.assertEqual(rank, "Legend")
        self.assertEqual(progress, 1.0)


class EventToMetricDeltaTests(unittest.TestCase):
    def test_summary_created(self):
        xp_delta, deltas = event_to_metric_delta("summary_created", 2, None)
        self.assertEqual(xp_delta, 60)
        self.assertEqual(deltas, [("summaries", 2)])

    def test_quiz_completed(self):
        xp_delta, deltas = event_to_metric_delta("quiz_completed", 3, 2)
        self.assertEqual(xp_delta, 34)
        self.assertEqual(deltas, [("quizzes_taken", 3), ("quiz_correct", 2)])

    def test_unknown_event(self):
        xp_delta, deltas = event_to_metric_delta("unknown", 5, 1)
        self.assertEqual(xp_delta, 0)
        self.assertEqual(deltas, [])

if __name__ == "__main__":
    unittest.main()
