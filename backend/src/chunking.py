import os
from typing import List

from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_text_splitters import CharacterTextSplitter, RecursiveCharacterTextSplitter

from .config import DEFAULT_CHUNK_OVERLAP, DEFAULT_CHUNK_SIZE


def split_documents(
    documents: List[Document],
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
    strategy: str | None = None,
) -> List[Document]:
    """Split documents with the configured recursive or character strategy."""
    load_dotenv()
    chunk_size = (
        chunk_size
        if chunk_size is not None
        else int(os.getenv("CHUNK_SIZE", str(DEFAULT_CHUNK_SIZE)))
    )
    chunk_overlap = (
        chunk_overlap
        if chunk_overlap is not None
        else int(os.getenv("CHUNK_OVERLAP", str(DEFAULT_CHUNK_OVERLAP)))
    )
    strategy = (strategy or os.getenv("CHUNKING_STRATEGY", "recursive")).lower()
    if chunk_size <= 0:
        raise ValueError("Chunk size must be positive.")
    if chunk_overlap < 0 or chunk_overlap >= chunk_size:
        raise ValueError("Chunk overlap must be non-negative and smaller than chunk size.")

    splitter_types = {
        "recursive": RecursiveCharacterTextSplitter,
        "character": CharacterTextSplitter,
    }
    try:
        splitter_type = splitter_types[strategy]
    except KeyError as error:
        supported = ", ".join(sorted(splitter_types))
        raise ValueError(
            f"Unsupported chunking strategy {strategy!r}; use {supported}."
        ) from error

    splitter = splitter_type(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        **({"separator": ""} if strategy == "character" else {}),
    )
    chunks = splitter.split_documents(documents)
    print(f"Split {len(documents)} documents into {len(chunks)} chunks")
    if chunks:
        print(f"\nExample chunk:\nContent: {chunks[0].page_content[:200]}...")
        print(f"Metadata: {chunks[0].metadata}")
    return chunks
