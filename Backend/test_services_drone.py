"""
Test all AI services using the Drone Warfare PDF.
Outputs results to test_output.txt

Usage:  python test_services_drone.py
Requires the server running on http://localhost:8000
"""

import json
import os
import sys
import time
import requests

BASE = "http://localhost:8000/api/ai"
PDF_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "Drone Warfare in the Russia-Ukraine Conflict-8164.pdf",
)
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_output.txt")


def extract_pdf_text(path: str) -> str:
    """Extract text from PDF using the same method the backend uses."""
    from langchain_community.document_loaders import PyPDFLoader
    loader = PyPDFLoader(path)
    pages = loader.load()
    return "\n\n".join(p.page_content for p in pages)


def pretty(data: dict) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False)


def write(f, text: str):
    """Write to both file and stdout."""
    print(text)
    f.write(text + "\n")


def test_endpoint(f, name: str, endpoint: str, payload: dict, timeout: int = 180) -> dict | None:
    write(f, "")
    write(f, "=" * 70)
    write(f, f"  {name}")
    write(f, "=" * 70)
    start = time.time()
    try:
        r = requests.post(f"{BASE}/{endpoint}", json=payload, timeout=timeout)
        elapsed = time.time() - start
        data = r.json()
        if r.status_code == 200:
            write(f, f"  STATUS: {r.status_code} OK  ({elapsed:.1f}s)")
        else:
            write(f, f"  STATUS: {r.status_code} FAIL  ({elapsed:.1f}s)")
        write(f, "-" * 70)
        write(f, pretty(data))
        return data if r.status_code == 200 else None
    except Exception as e:
        elapsed = time.time() - start
        write(f, f"  ERROR ({elapsed:.1f}s): {e}")
        return None


def main():
    # Check PDF exists
    if not os.path.exists(PDF_PATH):
        print(f"ERROR: PDF not found at {PDF_PATH}")
        sys.exit(1)

    # Extract text from PDF
    print("Extracting text from drone warfare PDF...")
    pdf_text = extract_pdf_text(PDF_PATH)
    # Use first ~4000 chars to keep within model token limits
    text_chunk = pdf_text[:4000]
    print(f"Extracted {len(pdf_text)} total chars, using first {len(text_chunk)} chars for testing.\n")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        write(f, "=" * 70)
        write(f, "  AI SERVICES TEST OUTPUT")
        write(f, f"  PDF: Drone Warfare in the Russia-Ukraine Conflict")
        write(f, f"  Date: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        write(f, f"  Text length: {len(text_chunk)} chars")
        write(f, "=" * 70)

        # ── 1. SUMMARIZE ─────────────────────────────────────────────────
        summary_result = test_endpoint(
            f,
            "1. SUMMARIZER  [Model: gemma-3-27b-it]",
            "summarize",
            {"text": text_chunk},
        )
        summary_text = summary_result["summary"] if summary_result else None

        # ── 2. QUIZ GENERATION ───────────────────────────────────────────
        test_endpoint(
            f,
            "2. QUIZ GENERATOR  [Model: gemma-3-27b-it]",
            "generate-quiz",
            {"text": text_chunk, "n_items": 5, "n_options": 4},
        )

        # ── 3. CHATBOT ──────────────────────────────────────────────────
        test_endpoint(
            f,
            "3. CHATBOT / RAG TUTOR  [Model: gemma-3-27b-it]",
            "chat",
            {
                "course_id": 1,
                "question": "What are the main types of drones used in the Russia-Ukraine conflict and how have they changed warfare?",
                "conversation_id": "drone-test-1",
            },
        )

        # ── 4. EVALUATOR ────────────────────────────────────────────────
        # Create a deliberately incomplete student summary for evaluation
        student_summary = (
            "The Russia-Ukraine conflict has seen extensive use of drones by both sides. "
            "Ukraine uses Turkish Bayraktar TB2 drones for strikes. Russia also uses drones "
            "for reconnaissance. Drones have changed modern warfare by providing cheap "
            "surveillance capabilities."
        )

        eval_payload = {
            "student_summary": student_summary,
            "lecture_text": text_chunk,
        }
        # If summarizer succeeded, pass its output as reference (ground truth)
        if summary_text:
            eval_payload["reference_summary"] = summary_text

        test_endpoint(
            f,
            "4. EVALUATOR  [Model: gemma-3-12b-it, Ground Truth: Summarizer output]",
            "evaluate",
            eval_payload,
            timeout=300,  # evaluator makes many LLM calls
        )

        write(f, "")
        write(f, "=" * 70)
        write(f, "  ALL TESTS COMPLETE")
        write(f, "=" * 70)

    print(f"\nFull output saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
