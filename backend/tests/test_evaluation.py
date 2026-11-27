import unittest

from src.evaluation import average_precision_at_k


class RetrievalMetricTests(unittest.TestCase):
    def test_average_precision_perfect_order(self):
        self.assertEqual(average_precision_at_k(["a", "b", "c"], {"a", "b"}), 1.0)

    def test_average_precision_penalizes_late_relevant_chunks(self):
        self.assertEqual(average_precision_at_k(["x", "a", "y", "b"], {"a", "b"}), 0.5)

    def test_average_precision_without_labels_is_unavailable(self):
        self.assertIsNone(average_precision_at_k(["a"], set()))


if __name__ == "__main__":
    unittest.main()
