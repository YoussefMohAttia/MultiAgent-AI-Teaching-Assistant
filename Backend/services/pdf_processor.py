"""
PDF loading, chunking, and vector-store management.

Extracted from Ai Team/Main/chatbot.ipynb — sections 4 & 5.

Uses ChromaDB's built-in default embedding function (onnxruntime-based
all-MiniLM-L6-v2) to avoid heavy torch/sentence-transformers dependency.
"""

import hashlib
import os
from typing import List

import chromadb
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document

from Core.config import settings


def load_pdf(pdf_path: str) -> List[Document]:
    """Load a PDF and return a list of LangChain Document objects (one per page)."""
    loader = PyPDFLoader(pdf_path)
    return loader.load()


def split_documents(
    documents: List[Document],
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> List[Document]:
    """Split documents into smaller chunks for better retrieval."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", " ", ""],
    )
    return splitter.split_documents(documents)


def extract_text_from_pdf(pdf_path: str) -> str:
    """Load a PDF and return its full plain text (all pages joined)."""
    docs = load_pdf(pdf_path)
    return "\n\n".join(doc.page_content for doc in docs)


# ---------------------------------------------------------------------------
# Vector-store helpers (ChromaDB, persisted per-course)
# ---------------------------------------------------------------------------

def _persist_dir_for_course(course_id: int) -> str:
    """Each course gets its own sub-directory inside the chroma root."""
    base = settings.CHROMA_PERSIST_DIR
    path = os.path.join(base, f"course_{course_id}")
    os.makedirs(path, exist_ok=True)
    return path


def _get_chroma_client(course_id: int) -> chromadb.ClientAPI:
    """Get a persistent ChromaDB client for the given course."""
    persist_dir = _persist_dir_for_course(course_id)
    return chromadb.PersistentClient(path=persist_dir)


def _get_collection(course_id: int) -> chromadb.Collection:
    """Get or create the ChromaDB collection for a course."""
    client = _get_chroma_client(course_id)
    return client.get_or_create_collection(
        name=f"course_{course_id}",
        metadata={"hnsw:space": "cosine"},
    )


def index_pdf_for_course(pdf_path: str, course_id: int) -> int:
    """
    Process a PDF, chunk it, and upsert the chunks into the course's
    ChromaDB collection.  Returns the number of chunks indexed.
    """
    documents = load_pdf(pdf_path)
    chunks = split_documents(documents)
    collection = _get_collection(course_id)

    # Build IDs, documents, and metadata for ChromaDB
    ids = []
    texts = []
    metadatas = []
    for i, chunk in enumerate(chunks):
        chunk_id = hashlib.md5(f"{pdf_path}:{i}".encode()).hexdigest()
        ids.append(chunk_id)
        texts.append(chunk.page_content)
        metadatas.append({
            "source": pdf_path,
            "page": chunk.metadata.get("page", 0),
            "chunk_index": i,
        })

    # Upsert in batches of 100
    batch_size = 100
    for start in range(0, len(ids), batch_size):
        end = start + batch_size
        collection.upsert(
            ids=ids[start:end],
            documents=texts[start:end],
            metadatas=metadatas[start:end],
        )

    return len(chunks)


def query_course_documents(course_id: int, query: str, n_results: int = 4) -> List[dict]:
    """
    Query the course's vector store and return relevant document chunks.

    Returns a list of dicts with keys: content, metadata, distance.
    """
    collection = _get_collection(course_id)
    if collection.count() == 0:
        return []

    results = collection.query(
        query_texts=[query],
        n_results=min(n_results, collection.count()),
    )

    docs = []
    for i in range(len(results["documents"][0])):
        docs.append({
            "content": results["documents"][0][i],
            "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
            "distance": results["distances"][0][i] if results["distances"] else None,
        })
    return docs
