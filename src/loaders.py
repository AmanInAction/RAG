from pathlib import Path
from typing import List

from langchain_community.document_loaders import DirectoryLoader, PyPDFLoader, TextLoader
from langchain_core.documents import Document


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
    loader = DirectoryLoader(
        str(directory),
        glob="**/*.txt",
        loader_cls=TextLoader,
        loader_kwargs={"encoding": "utf-8"},
        show_progress=True,
    )
    return loader.load()


def load_pdf_directory(directory: Path) -> List[Document]:
    """Load all PDF files below a directory."""
    loader = DirectoryLoader(
        str(directory),
        glob="**/*.pdf",
        loader_cls=PyPDFLoader,
    )
    return loader.load()
