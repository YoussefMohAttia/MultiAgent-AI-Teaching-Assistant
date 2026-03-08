"""
Quick test script for all 5 AI service endpoints.
Run:  python test_all_services.py
Requires the server to be running on http://localhost:8000
"""

import requests, json, time

BASE = "http://localhost:8000/api/ai"
PASS = "\033[92m✓ PASS\033[0m"
FAIL = "\033[91m✗ FAIL\033[0m"

def pretty(data):
    return json.dumps(data, indent=2, ensure_ascii=False)

def test(name, endpoint, payload):
    print(f"\n{'='*60}")
    print(f"  {name}")
    print(f"{'='*60}")
    try:
        r = requests.post(f"{BASE}/{endpoint}", json=payload, timeout=120)
        data = r.json()
        status = PASS if r.status_code == 200 else FAIL
        print(f"Status: {r.status_code} {status}")
        print(f"Response:\n{pretty(data)}")
        return r.status_code == 200
    except Exception as e:
        print(f"{FAIL} Error: {e}")
        return False

results = []

# 1. Summarize
results.append(test(
    "1. SUMMARIZE SERVICE",
    "summarize",
    {
        "text": (
            "Machine learning is a branch of artificial intelligence that focuses on "
            "building systems that learn from data. Unlike traditional programming where "
            "rules are explicitly coded, machine learning algorithms identify patterns in "
            "data and make decisions with minimal human intervention. There are three main "
            "types: supervised learning uses labeled data, unsupervised learning finds "
            "hidden patterns, and reinforcement learning learns through trial and error "
            "with rewards. Deep learning is a subset of machine learning that uses "
            "artificial neural networks with multiple layers."
        )
    }
))

# 2. Generate Quiz
results.append(test(
    "2. QUIZ GENERATION SERVICE",
    "generate-quiz",
    {
        "text": (
            "Machine learning is a branch of artificial intelligence that focuses on "
            "building systems that learn from data. There are three main types: supervised "
            "learning uses labeled data, unsupervised learning finds hidden patterns, and "
            "reinforcement learning learns through trial and error with rewards. Deep "
            "learning uses neural networks with many layers."
        ),
        "n_items": 3,
        "n_options": 4
    }
))

# 3. Evaluate
results.append(test(
    "3. EVALUATION SERVICE (10 metrics)",
    "evaluate",
    {
        "student_summary": (
            "Machine learning is AI that learns from data. It has supervised and "
            "unsupervised types."
        ),
        "lecture_text": (
            "Machine learning is a branch of artificial intelligence that focuses on "
            "building systems that learn from data. There are three main types: supervised "
            "learning uses labeled data, unsupervised learning finds hidden patterns, and "
            "reinforcement learning learns through trial and error with rewards. Deep "
            "learning uses neural networks with many layers."
        )
    }
))

# 4. Chat
results.append(test(
    "4. CHATBOT / RAG TUTOR SERVICE",
    "chat",
    {
        "course_id": 1,
        "question": "What is machine learning and what are its main types?",
        "conversation_id": "test-session-1"
    }
))

# 5. Index Document (will 404 since no document exists yet — expected)
results.append(test(
    "5. INDEX DOCUMENT SERVICE (expects 404 — no doc uploaded yet)",
    "index-document",
    {
        "document_id": 999,
        "course_id": 1
    }
))

# Summary
print(f"\n{'='*60}")
print(f"  RESULTS SUMMARY")
print(f"{'='*60}")
labels = ["Summarize", "Quiz Generation", "Evaluate", "Chat", "Index Document"]
for label, ok in zip(labels, results):
    mark = PASS if ok else (FAIL if label != "Index Document" else "\033[93m~ EXPECTED 404\033[0m")
    print(f"  {mark}  {label}")
print()
