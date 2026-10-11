import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import numpy as np
from langchain_core.documents import Document
from pypdf import PdfWriter
from typesense.exceptions import ObjectNotFound

from src.chunking import split_documents
from src.embeddings import EmbeddingManager
from src.llm import LLMProvider
from src.loaders import load_documents
from src.vector_store import VectorStore


class LoaderTests(unittest.TestCase):
    def test_loads_text_markdown_json_and_pdf_files(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            (directory / "notes.txt").write_text("plain text", encoding="utf-8")
            (directory / "notes.md").write_text("# Markdown", encoding="utf-8")
            (directory / "records.json").write_text(
                json.dumps({"name": "Ada"}),
                encoding="utf-8",
            )
            writer = PdfWriter()
            writer.add_blank_page(width=72, height=72)
            with (directory / "page.pdf").open("wb") as pdf_file:
                writer.write(pdf_file)

            documents = load_documents(directory)

        sources = {
            Path(document.metadata["source"]).suffix.lower()
            for document in documents
        }
        self.assertEqual(sources, {".txt", ".md", ".json", ".pdf"})
        self.assertTrue(any('"name": "Ada"' in doc.page_content for doc in documents))

    def test_loads_urls_from_a_list_file(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            directory = root / "source"
            directory.mkdir()
            urls_file = root / "web_urls.txt"
            urls_file.write_text(
                "https://example.test/page\n# ignored\n",
                encoding="utf-8",
            )
            expected = [Document(page_content="page", metadata={"source": "https://example.test/page"})]
            with patch(
                "langchain_community.document_loaders.WebBaseLoader.load",
                return_value=expected,
            ) as load:
                documents = load_documents(directory, urls_file)

        self.assertEqual(documents, expected)
        load.assert_called_once()

    def test_rejects_non_http_web_urls(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            urls_file = Path(temporary_directory) / "web_urls.txt"
            urls_file.write_text("file:///etc/passwd\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Invalid web page URL"):
                load_documents(Path(temporary_directory), urls_file)


class ChunkingTests(unittest.TestCase):
    def test_configured_strategies_split_and_preserve_metadata(self) -> None:
        documents = [
            Document(
                page_content="alpha beta gamma delta " * 20,
                metadata={"source_file": "example.txt"},
            )
        ]

        for strategy in ("recursive", "character"):
            with self.subTest(strategy=strategy):
                chunks = split_documents(
                    documents,
                    chunk_size=40,
                    chunk_overlap=5,
                    strategy=strategy,
                )
                self.assertGreater(len(chunks), 1)
                self.assertTrue(
                    all(chunk.metadata == documents[0].metadata for chunk in chunks)
                )

    def test_rejects_invalid_strategy_and_chunk_settings(self) -> None:
        with self.assertRaisesRegex(ValueError, "Unsupported chunking strategy"):
            split_documents([], strategy="unknown")
        with self.assertRaisesRegex(ValueError, "Chunk overlap"):
            split_documents([], chunk_size=10, chunk_overlap=10)
        long_word = [Document(page_content="supercalifragilisticexpialidocious")]
        chunks = split_documents(
            long_word,
            chunk_size=10,
            chunk_overlap=2,
            strategy="character",
        )
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(chunk.page_content) <= 10 for chunk in chunks))


class EmbeddingConfigurationTests(unittest.TestCase):
    def test_loads_configured_sentence_transformer_model(self) -> None:
        model = Mock()
        model.get_embedding_dimension.return_value = 2
        model.encode.return_value = np.asarray([[0.25, 0.75]])
        with patch.dict(os.environ, {"EMBEDDING_MODEL_NAME": "test/model"}):
            with patch("src.embeddings.load_dotenv"):
                with patch(
                    "src.embeddings.SentenceTransformer",
                    return_value=model,
                ) as factory:
                    embedding_manager = EmbeddingManager()

        factory.assert_called_once_with("test/model")
        self.assertEqual(
            embedding_manager.embed_query("query"),
            [0.25, 0.75],
        )


class VectorStoreTests(unittest.TestCase):
    def test_faiss_persists_cosine_search_and_upserts_identical_chunks(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            store = VectorStore(
                2,
                backend="faiss",
                faiss_directory=Path(temporary_directory),
                embedding_model_name="test/model",
            )
            documents = [
                Document(page_content="alpha", metadata={"source_file": "a.txt"}),
                Document(page_content="beta", metadata={"source_file": "b.txt"}),
            ]
            embeddings = np.asarray([[1.0, 0.0], [0.0, 1.0]])
            store.add_documents(documents, embeddings)
            store.add_documents(documents[:1], embeddings[:1])

            self.assertEqual(len(store.backend.documents_by_id), 2)
            result = store.search(np.asarray([0.9, 0.1]), 1)[0]
            self.assertEqual(result["content"], "alpha")
            self.assertLess(result["distance"], 0.1)

            restored = VectorStore(
                2,
                backend="faiss",
                faiss_directory=Path(temporary_directory),
                embedding_model_name="test/model",
            )
            self.assertEqual(
                restored.search(np.asarray([0.9, 0.1]), 1)[0]["content"],
                "alpha",
            )
            with self.assertRaisesRegex(ValueError, "does not match the FAISS index"):
                VectorStore(
                    2,
                    backend="faiss",
                    faiss_directory=Path(temporary_directory),
                    embedding_model_name="other/model",
                )

    def test_typesense_creates_collection_and_upserts_documents(self) -> None:
        collection = Mock()
        collection.retrieve.side_effect = ObjectNotFound("missing")
        collection.documents.import_.return_value = [{"success": True}]

        class Collections(dict[str, Mock]):
            def __init__(self) -> None:
                super().__init__({"document_embeddings": collection})
                self.create = Mock()

        client = Mock()
        client.collections = Collections()
        client.multi_search.perform.return_value = {
            "results": [
                {
                    "hits": [
                        {
                            "document": {
                                "id": "doc",
                                "content": "alpha",
                                "metadata": {"source_file": "a.txt"},
                            },
                            "vector_distance": 0.1,
                        }
                    ]
                }
            ]
        }
        environment = {
            "TYPESENSE_HOST": "example.test",
            "TYPESENSE_PORT": "443",
            "TYPESENSE_ADMIN_KEY": "not-a-real-key",
        }
        with patch.dict(os.environ, environment), patch("src.vector_store.load_dotenv"):
            with patch("src.vector_store.typesense.Client", return_value=client):
                store = VectorStore(
                    2,
                    backend="typesense",
                    embedding_model_name="test/model",
                )
                store.add_documents(
                    [Document(page_content="alpha", metadata={"source_file": "a.txt"})],
                    np.asarray([[1.0, 0.0]]),
                )
                result = store.search(np.asarray([1.0, 0.0]), 1)

        schema = client.collections.create.call_args.args[0]
        self.assertEqual(schema["fields"][0]["num_dim"], 2)
        self.assertEqual(
            collection.documents.import_.call_args.args[1],
            {"action": "upsert"},
        )
        imported_document = collection.documents.import_.call_args.args[0][0]
        self.assertEqual(
            imported_document["embedding_model"],
            store.backend.embedding_model_id,
        )
        self.assertEqual(
            client.multi_search.perform.call_args.args[0]["searches"][0]["filter_by"],
            f"embedding_model:={store.backend.embedding_model_id}",
        )
        self.assertEqual(result[0]["content"], "alpha")


class LLMProviderTests(unittest.TestCase):
    def test_gemini_provider_uses_configured_model_and_returns_text(self) -> None:
        gemini_client = Mock()
        gemini_client.interactions.create.return_value.output_text = "answer"
        with patch.dict(os.environ, {"GEMINI_API_KEY": "not-a-real-key"}):
            with patch("src.llm.load_dotenv"):
                with patch("google.genai.Client", return_value=gemini_client) as factory:
                    provider = LLMProvider(provider="gemini", model_name="test-model")

        self.assertEqual(provider.generate("prompt"), "answer")
        factory.assert_called_once_with(api_key="not-a-real-key")
        gemini_client.interactions.create.assert_called_once_with(
            model="test-model",
            input="prompt",
        )

    def test_groq_provider_uses_configured_model_and_returns_text(self) -> None:
        groq_client = Mock()
        groq_client.invoke.return_value.content = "answer"
        environment = {"GROQ_API_KEY": "not-a-real-key"}
        with patch.dict(os.environ, environment), patch("src.llm.load_dotenv"):
            with patch("langchain_groq.ChatGroq", return_value=groq_client) as factory:
                provider = LLMProvider(provider="groq", model_name="test-model")

        self.assertEqual(provider.generate("prompt"), "answer")
        factory.assert_called_once_with(api_key="not-a-real-key", model="test-model")


if __name__ == "__main__":
    unittest.main()
