from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, Mock, patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient

from api.main import app



class APITests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_health_check(self) -> None:
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["service"], "rag-saas-api")

    def test_system_config(self) -> None:
        response = self.client.get("/api/config")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("llm_provider", data)
        self.assertIn("vector_store_backend", data)
        self.assertIn("embedding_model", data)

    @patch("api.services.RAGService.get_stats", new_callable=AsyncMock)
    def test_vector_store_stats(self, mock_stats: AsyncMock) -> None:
        mock_stats.return_value = {
            "backend": "typesense",
            "collection_name": "test_collection",
            "total_chunks": 42,
            "embedding_dimension": 384,
            "embedding_model_id": "test_id",
        }
        response = self.client.get("/api/vector-store/stats")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["backend"], "typesense")
        self.assertEqual(data["total_chunks"], 42)

    @patch("api.services.RAGService.list_documents", new_callable=AsyncMock)
    def test_list_documents(self, mock_list: AsyncMock) -> None:
        mock_list.return_value = [
            {
                "source": "sample.txt",
                "source_name": "sample.txt",
                "chunks_count": 3,
                "format": "txt",
                "sample_content": "hello world",
            }
        ]
        response = self.client.get("/api/documents")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_documents"], 1)
        self.assertEqual(data["total_chunks"], 3)
        self.assertEqual(data["documents"][0]["source"], "sample.txt")

    @patch("api.services.RAGService.query_chat", new_callable=AsyncMock)
    def test_chat_query(self, mock_query: AsyncMock) -> None:
        mock_query.return_value = {
            "answer": "ChatGPT is an AI assistant.",
            "sources": [
                {
                    "source": "doc1.txt",
                    "page": 1,
                    "score": 0.88,
                    "preview": "ChatGPT is created by OpenAI...",
                }
            ],
            "confidence": 0.88,
            "context": "full context string",
        }
        response = self.client.post(
            "/api/chat/query",
            json={"query": "What is ChatGPT?", "top_k": 3, "min_score": 0.2},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["answer"], "ChatGPT is an AI assistant.")
        self.assertEqual(len(data["sources"]), 1)
        self.assertEqual(data["confidence"], 0.88)

    @patch("api.services.RAGService.ingest_file", new_callable=AsyncMock)
    def test_upload_document(self, mock_ingest: AsyncMock) -> None:
        mock_ingest.return_value = 5
        response = self.client.post(
            "/api/documents/upload",
            files={"file": ("test_doc.txt", b"This is a test document content.", "text/plain")},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["chunks_created"], 5)

    @patch("api.services.RAGService.delete_document", new_callable=AsyncMock)
    def test_delete_document(self, mock_delete: AsyncMock) -> None:
        mock_delete.return_value = 4
        response = self.client.delete("/api/documents/sample.txt")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["deleted_chunks"], 4)


if __name__ == "__main__":
    unittest.main()
