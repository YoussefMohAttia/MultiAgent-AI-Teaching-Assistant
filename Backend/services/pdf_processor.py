"""
PDF loading, chunking, and vector-store management.

Extracted from Ai Team/Main/chatbot.ipynb — sections 4 & 5.

Uses ChromaDB's built-in default embedding function (onnxruntime-based
all-MiniLM-L6-v2) to avoid heavy torch/sentence-transformers dependency.

OCR fallback: When a PDF page has no extractable text layer (e.g. scanned
slides, image-based lecture PDFs), Tesseract OCR is used automatically.
"""

import hashlib
import io
import os
import time
from typing import List

import fitz
import chromadb
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document

from Core.config import settings

# ── OCR helpers ────────────────────────────────────────────────────────────────

# Minimum characters a page must yield from get_text() to be considered
# truly text-based.  Pages below this threshold are sent through OCR.
MIN_TEXT_CHARS = 50

_OCR_AVAILABLE: bool | None = None  # lazy-checked once


def _check_ocr_available() -> bool:
    """Check if Tesseract OCR is installed and usable."""
    global _OCR_AVAILABLE
    if _OCR_AVAILABLE is not None:
        return _OCR_AVAILABLE
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        _OCR_AVAILABLE = True
    except Exception:
        _OCR_AVAILABLE = False
        print("⚠️  Tesseract OCR not available — image-based PDF pages will be skipped.")
    return _OCR_AVAILABLE


def _sanitize_text(text: str) -> str:
    """Remove null bytes and other problematic characters that PostgreSQL rejects."""
    if not text:
        return text
    # PostgreSQL TEXT/VARCHAR cannot store null bytes
    return text.replace("\x00", "")


def _ocr_page(page: fitz.Page, dpi: int = 300) -> str:
    """Render a PDF page to an image and run Tesseract OCR on it.

    Returns the OCR'd text, or an empty string on failure.
    """
    if not _check_ocr_available():
        return ""
    try:
        import pytesseract
        from PIL import Image

        # Render page at high resolution for better OCR accuracy
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        text = pytesseract.image_to_string(img)
        return _sanitize_text(text.strip())
    except Exception as e:
        print(f"⚠️  OCR failed on page {page.number}: {e}")
        return ""


# ── PDF loading ────────────────────────────────────────────────────────────────

def load_pdf(pdf_path: str) -> List[Document]:
    """Load a PDF and return a list of LangChain Document objects (one per page).

    Falls back to PyMuPDF + OCR for pages where PyPDFLoader returns no text.
    """
    loader = PyPDFLoader(pdf_path)
    docs = loader.load()

    # Check if any pages came back empty — if so, try fitz + OCR for those
    sparse_pages = [
        i for i, d in enumerate(docs)
        if len(d.page_content.strip()) < MIN_TEXT_CHARS
    ]
    if sparse_pages:
        try:
            with fitz.open(pdf_path) as pdf_doc:
                for page_idx in sparse_pages:
                    if page_idx < len(pdf_doc):
                        page = pdf_doc[page_idx]
                        text = _sanitize_text(page.get_text().strip())
                        if len(text) < MIN_TEXT_CHARS:
                            # Not enough text — fall back to OCR
                            ocr_text = _ocr_page(page)
                            text = ocr_text or text  # prefer OCR, keep native as fallback
                        if text:
                            docs[page_idx].page_content = text
        except Exception as e:
            print(f"⚠️  Fitz/OCR fallback failed for {pdf_path}: {e}")

    return docs

def load_pdf_from_bytes(file_bytes: bytes) -> List[Document]:
    """Load a PDF from bytes and return a list of LangChain Document objects.

    Automatically applies OCR for pages with no extractable text layer.
    """
    docs = []
    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        for i, page in enumerate(doc):
            text = _sanitize_text(page.get_text().strip())
            if len(text) < MIN_TEXT_CHARS:
                # Page text is below threshold — try OCR
                ocr_text = _ocr_page(page)
                text = ocr_text or text  # prefer OCR, keep native as fallback
            docs.append(Document(page_content=text, metadata={"page": i}))
    return docs

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

def extract_text_from_pdf_bytes(file_bytes: bytes) -> str:
    """Load a PDF from bytes and return its full plain text."""
    docs = load_pdf_from_bytes(file_bytes)
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


def index_pdf_for_course(
    pdf_path: str,
    course_id: int,
    document_id: int | None = None,
) -> int:
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
        metadata = {
            "source": pdf_path,
            "page": chunk.metadata.get("page", 0),
            "chunk_index": i,
        }
        if document_id is not None:
            metadata["document_id"] = document_id
        metadatas.append(metadata)

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


def index_text_for_course(
    text: str,
    course_id: int,
    document_id: int | None = None,
) -> int:
    """
    Chunk plain text and upsert it into the course's ChromaDB collection.
    Returns the number of chunks indexed.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        separators=["\n\n", "\n", " ", ""],
    )
    chunks = splitter.split_text(text)
    collection = _get_collection(course_id)

    ids = []
    texts = []
    metadatas = []
    for i, chunk_text in enumerate(chunks):
        chunk_key = f"{course_id}:{document_id}:{i}"
        chunk_id = hashlib.md5(chunk_key.encode()).hexdigest()
        ids.append(chunk_id)
        texts.append(chunk_text)
        metadata = {
            "source": f"document:{document_id}" if document_id is not None else "text",
            "page": None,
            "chunk_index": i,
        }
        if document_id is not None:
            metadata["document_id"] = document_id
        metadatas.append(metadata)

    batch_size = 100
    for start in range(0, len(ids), batch_size):
        end = start + batch_size
        collection.upsert(
            ids=ids[start:end],
            documents=texts[start:end],
            metadatas=metadatas[start:end],
        )

    return len(chunks)


def query_course_documents(
    course_id: int,
    query: str,
    n_results: int = 4,
    retries: int = 2,
    backoff_s: float = 0.25,
    source_path: str | None = None,
    document_id: int | None = None,
    document_text: str | None = None,
) -> List[dict]:
    """
    Query the course's vector store and return relevant document chunks.

    Returns a list of dicts with keys: content, metadata, distance.
    """
    collection = _get_collection(course_id)
    last_error: Exception | None = None

    for attempt in range(retries + 1):
        try:
            total = collection.count()
            if total == 0:
                if document_text:
                    try:
                        index_text_for_course(
                            document_text,
                            course_id,
                            document_id=document_id,
                        )
                        total = collection.count()
                    except Exception as index_error:
                        print(f"⚠️  Chroma text index failed for course {course_id}: {index_error}")
                if total == 0 and source_path and os.path.exists(source_path):
                    try:
                        index_pdf_for_course(
                            source_path,
                            course_id,
                            document_id=document_id,
                        )
                        total = collection.count()
                    except Exception as index_error:
                        print(f"⚠️  Chroma reindex failed for course {course_id}: {index_error}")
                if total == 0:
                    return []

            query_kwargs = {
                "query_texts": [query],
                "n_results": min(n_results, total),
            }
            if document_id is not None:
                query_kwargs["where"] = {"document_id": document_id}
            elif source_path:
                query_kwargs["where"] = {"source": source_path}

            def build_docs(results: dict) -> List[dict]:
                docs: List[dict] = []
                if not results or not results.get("documents"):
                    return docs
                for i in range(len(results["documents"][0])):
                    docs.append({
                        "content": results["documents"][0][i],
                        "metadata": results["metadatas"][0][i] if results.get("metadatas") else {},
                        "distance": results["distances"][0][i] if results.get("distances") else None,
                    })
                return docs

            results = collection.query(**query_kwargs)
            docs = build_docs(results)

            if document_text and not docs:
                try:
                    index_text_for_course(
                        document_text,
                        course_id,
                        document_id=document_id,
                    )
                    results = collection.query(**query_kwargs)
                    docs = build_docs(results)
                except Exception as index_error:
                    print(f"⚠️  Chroma text index failed for course {course_id}: {index_error}")

            if source_path and not docs and os.path.exists(source_path):
                try:
                    index_pdf_for_course(
                        source_path,
                        course_id,
                        document_id=document_id,
                    )
                    results = collection.query(**query_kwargs)
                    docs = build_docs(results)
                except Exception as index_error:
                    print(f"⚠️  Chroma reindex failed for course {course_id}: {index_error}")

            return docs
        except Exception as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(backoff_s * (2 ** attempt))
                continue
            print(f"⚠️  Chroma query failed for course {course_id}: {exc}")
            return []

    if last_error:
        print(f"⚠️  Chroma query failed for course {course_id}: {last_error}")
    return []
