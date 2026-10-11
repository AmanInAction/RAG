import json
import os
from pathlib import Path
from typing import List, Protocol
from urllib.parse import urlparse

os.environ.setdefault("USER_AGENT", "local-rag/0.1")

from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_core.documents import Document


class DocumentLoader(Protocol):
    def load(self) -> List[Document]: ...


class LocalDocumentLoader:
    """Load supported document formats from a directory tree."""

    def __init__(self, directory: Path) -> None:
        self.directory = Path(directory)

    def load(self) -> List[Document]:
        if not self.directory.exists():
            raise FileNotFoundError(
                f"Document directory does not exist: {self.directory}"
            )
        if not self.directory.is_dir():
            raise NotADirectoryError(
                f"Document path is not a directory: {self.directory}"
            )

        documents: List[Document] = []
        for file_path in sorted(self.directory.rglob("*")):
            if file_path.is_file() and file_path.suffix.lower() in {
                ".txt",
                ".md",
                ".markdown",
                ".json",
                ".pdf",
            }:
                documents.extend(_load_file(file_path))
        return documents


class WebPageLoader:
    """Load static web pages listed one URL per line."""

    def __init__(self, urls_file: Path) -> None:
        self.urls_file = Path(urls_file)

    def load(self) -> List[Document]:
        if not self.urls_file.exists():
            return []
        urls = [
            line.strip()
            for line in self.urls_file.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        ]
        if not urls:
            return []
        for url in urls:
                parsed_url = urlparse(url)
                if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
                    raise ValueError(f"Invalid web page URL: {url}")

        from langchain_community.document_loaders import WebBaseLoader

        loader = WebBaseLoader(
            web_paths=urls,
            requests_per_second=2,
            requests_kwargs={"timeout": 20},
            continue_on_failure=False,
            raise_for_status=True,
        )
        return loader.load()


def _load_file(file_path: Path) -> List[Document]:
    extension = file_path.suffix.lower()
    if extension == ".pdf":
        return PyPDFLoader(str(file_path)).load()
    if extension == ".json":
        with file_path.open(encoding="utf-8") as file:
            content = json.dumps(json.load(file), ensure_ascii=False, indent=2)
        return [
            Document(
                page_content=content,
                metadata={
                    "source": str(file_path),
                    "source_file": str(file_path),
                    "format": "json",
                },
            )
        ]
    return TextLoader(str(file_path), encoding="utf-8").load()


def load_documents(
    directory: Path,
    urls_file: Path | None = None,
) -> List[Document]:
    """Load supported local files and optional web pages through one interface."""
    loaders: List[DocumentLoader] = [LocalDocumentLoader(directory)]
    if urls_file is not None:
        loaders.append(WebPageLoader(urls_file))
    return [document for loader in loaders for document in loader.load()]


def create_sample_texts(output_directory: Path) -> None:
    """Create the sample input used by the original notebook."""
    output_directory.mkdir(parents=True, exist_ok=True)
    (output_directory / "sample1.txt").write_text(
        "This is the content of sample text file 1.",
        encoding="utf-8",
    )


def load_text_file(file_path: Path) -> List[Document]:
    """Load one UTF-8 text file."""
    return TextLoader(str(file_path), encoding="utf-8").load()


def load_text_directory(directory: Path) -> List[Document]:
    """Load all UTF-8 text files below a directory."""
    if not directory.exists():
        raise FileNotFoundError(f"Document directory does not exist: {directory}")
    return [
        document
        for file_path in sorted(directory.rglob("*"))
        if file_path.is_file() and file_path.suffix.lower() == ".txt"
        for document in TextLoader(str(file_path), encoding="utf-8").load()
    ]


def load_pdf_directory(directory: Path) -> List[Document]:
    """Load all PDF files below a directory."""
    if not directory.exists():
        raise FileNotFoundError(f"Document directory does not exist: {directory}")
    return [
        document
        for file_path in sorted(directory.rglob("*"))
        if file_path.is_file() and file_path.suffix.lower() == ".pdf"
        for document in PyPDFLoader(str(file_path)).load()
    ]
