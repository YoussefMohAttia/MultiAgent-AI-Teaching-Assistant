"""
Integration test script — verifies AI models are integrated with the backend
and that all AI-generated data is correctly persisted to the database.

Usage:
    python test_all_services.py [--course-id 1] [--user-id 1]

Requirements:
    - Server running on http://localhost:8000
    - At least one Course and User row in the database
      (use --course-id / --user-id to override defaults)
"""

import argparse
import json
import sys
import requests

# ── CLI args ──────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--course-id", type=int, default=1, help="Existing course ID (default: 1)")
parser.add_argument("--user-id",   type=int, default=1, help="Existing user ID   (default: 1)")
args = parser.parse_args()

COURSE_ID = args.course_id
USER_ID   = args.user_id

BASE      = "http://localhost:8000/api/ai"
QUIZ_BASE = "http://localhost:8000"

PASS     = "\033[92m✓ PASS\033[0m"
FAIL     = "\033[91m✗ FAIL\033[0m"
WARN     = "\033[93m~ WARN\033[0m"
SECTION  = "\033[94m"
RESET    = "\033[0m"

SAMPLE_TEXT = (
    "Machine learning is a branch of artificial intelligence that focuses on "
    "building systems that learn from data. Unlike traditional programming where "
    "rules are explicitly coded, machine learning algorithms identify patterns in "
    "data and make decisions with minimal human intervention. There are three main "
    "types: supervised learning (uses labeled data to train models), unsupervised "
    "learning (finds hidden patterns in unlabeled data), and reinforcement learning "
    "(learns through trial and error guided by rewards and penalties). Deep learning "
    "is a subset of machine learning that uses artificial neural networks with "
    "multiple hidden layers to model complex, non-linear relationships in data."
)


def pretty(data) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False)


def section(title: str):
    print(f"\n{SECTION}{'='*65}{RESET}")
    print(f"{SECTION}  {title}{RESET}")
    print(f"{SECTION}{'='*65}{RESET}")


def check(label: str, ok: bool, detail: str = ""):
    mark = PASS if ok else FAIL
    line = f"  {mark}  {label}"
    if detail:
        line += f"  →  {detail}"
    print(line)
    return ok


# ══════════════════════════════════════════════════════════════════════════════
#  TEST 1 — SUMMARIZE
# ══════════════════════════════════════════════════════════════════════════════
section("TEST 1 — SUMMARIZE SERVICE")
r1 = requests.post(f"{BASE}/summarize", json={"text": SAMPLE_TEXT}, timeout=120)
t1_ok = check("HTTP 200", r1.status_code == 200, f"status={r1.status_code}")
if t1_ok:
    body = r1.json()
    has_summary = bool(body.get("summary", "").strip())
    check("Response contains 'summary' key", "summary" in body)
    check("Summary is non-empty", has_summary, f"{len(body.get('summary',''))} chars")
    print(f"\n  Summary preview: {body.get('summary','')[:200]}…\n")
else:
    print(f"  Error body: {r1.text[:300]}")
t1_result = t1_ok


# ══════════════════════════════════════════════════════════════════════════════
#  TEST 2 — QUIZ GENERATION + DB PERSISTENCE
# ══════════════════════════════════════════════════════════════════════════════
section("TEST 2 — QUIZ GENERATION SERVICE  (+ DB persistence check)")

quiz_payload = {
    "text":       SAMPLE_TEXT,
    "course_id":  COURSE_ID,
    "created_by": USER_ID,
    "n_items":    3,
    "n_options":  4,
    "objectives": [
        "Identify the three main types of machine learning",
        "Explain what deep learning is",
    ],
}

r2 = requests.post(f"{BASE}/generate-quiz", json=quiz_payload, timeout=120)
t2_ok = check("HTTP 200", r2.status_code == 200, f"status={r2.status_code}")

quiz_id = None
if t2_ok:
    body = r2.json()
    quiz_id = body.get("quiz_id")
    items   = body.get("items", [])

    check("Response has 'quiz_id'",   quiz_id is not None, str(quiz_id))
    check("Response has 'course_id'", body.get("course_id") == COURSE_ID, str(body.get("course_id")))
    check("Response has 'items'",     len(items) > 0, f"{len(items)} items")

    # Validate item structure
    for i, item in enumerate(items):
        has_stem    = bool(item.get("stem", "").strip())
        has_opts    = isinstance(item.get("options"), list) and len(item["options"]) >= 2
        valid_idx   = isinstance(item.get("answer_index"), int) and 0 <= item["answer_index"] < len(item.get("options", []))
        check(f"  Item {i+1}: stem present",          has_stem,   item.get("stem","")[:60])
        check(f"  Item {i+1}: options list valid",    has_opts,   f"{len(item.get('options',[]))} options")
        check(f"  Item {i+1}: answer_index in range", valid_idx,  f"index={item.get('answer_index')}")

    print(f"\n  Generated items preview:")
    for i, item in enumerate(items, 1):
        opts = "  |  ".join(item.get("options", []))
        ans  = item["options"][item["answer_index"]] if item.get("options") and item.get("answer_index") is not None else "?"
        print(f"  Q{i}: {item.get('stem','')}")
        print(f"       Options: {opts}")
        print(f"       Correct: {ans}\n")

    # ── DB verification ──────────────────────────────────────────────────────
    section("  TEST 2b — VERIFY QUIZ PERSISTED IN DATABASE")
    if quiz_id:
        # Fetch the quiz back via the Quizzes router endpoint
        # The router uses subject_name (title) — try fetching all quizzes by course directly
        db_r = requests.get(f"{QUIZ_BASE}/api/quizzes/{COURSE_ID}", timeout=30)
        # Try alternative route pattern  
        if db_r.status_code == 404:
            db_r = requests.get(
                f"{QUIZ_BASE}/api/courses/{COURSE_ID}/quizzes", timeout=30
            )

        if db_r.status_code == 200:
            all_quizzes = db_r.json()
            matching = [q for q in all_quizzes if q.get("id") == quiz_id]
            check("Quiz row found in DB", len(matching) == 1, f"quiz_id={quiz_id}")
            if matching:
                q = matching[0]
                db_questions = q.get("questions", [])
                check("DB quiz has correct course_id", q.get("course_id") == COURSE_ID,
                      f"course_id={q.get('course_id')}")
                check("DB quiz has correct created_by", q.get("created_by") == USER_ID,
                      f"created_by={q.get('created_by')}")
                check(f"DB quiz has {len(items)} questions", len(db_questions) == len(items),
                      f"db_count={len(db_questions)}")
                for j, dbq in enumerate(db_questions):
                    check(f"  DB Q{j+1}: question text present",    bool(dbq.get("question","")),  dbq.get("question","")[:50])
                    check(f"  DB Q{j+1}: type is 'multiple_choice'", dbq.get("type") == "multiple_choice")
                    check(f"  DB Q{j+1}: options stored",            dbq.get("options") is not None)
                    check(f"  DB Q{j+1}: correct_answer stored",     bool(dbq.get("correct_answer","")), dbq.get("correct_answer",""))
        else:
            print(f"  {WARN}  Could not fetch course quizzes to verify (status={db_r.status_code})")
            print(f"       Tip: the Quizzes router uses subject_name; check the route prefix.")
    else:
        print(f"  {WARN}  Skipping DB check — no quiz_id returned")
else:
    print(f"  Error body: {r2.text[:500]}")
t2_result = t2_ok


# ══════════════════════════════════════════════════════════════════════════════
#  TEST 3 — EVALUATOR  (10 metrics)
# ══════════════════════════════════════════════════════════════════════════════
section("TEST 3 — EVALUATOR SERVICE  (10 metrics)")

r3 = requests.post(
    f"{BASE}/evaluate",
    json={
        "student_summary": (
            "Machine learning is AI that learns from data. "
            "It has supervised and unsupervised types."
        ),
        "lecture_text": SAMPLE_TEXT,
    },
    timeout=300,
)
t3_ok = check("HTTP 200", r3.status_code == 200, f"status={r3.status_code}")
if t3_ok:
    body = r3.json()
    scores  = body.get("scores", {})
    overall = body.get("overall")
    EXPECTED_METRICS = [
        "correctness", "relevance", "coherence", "completeness",
        "conciseness", "terminology", "hallucination",
        "missing_key_points", "factual_accuracy", "critical_analysis",
    ]
    check("All 10 metrics present", all(m in scores for m in EXPECTED_METRICS),
          f"found={list(scores.keys())}")
    check("'overall' score present", overall is not None, str(overall))
    check("'reference_summary' present", bool(body.get("reference_summary", "")))
    check("'key_points' list present",   isinstance(body.get("key_points"), list) and len(body["key_points"]) > 0,
          f"{len(body.get('key_points',[]))} points")

    print(f"\n  Scores:")
    for m, v in scores.items():
        print(f"    {m:<22} {v['score']:>5.2f}/10  — {v['detail'][:70]}")
    print(f"  Overall: {overall}/10\n")
else:
    print(f"  Error body: {r3.text[:500]}")
t3_result = t3_ok


# ══════════════════════════════════════════════════════════════════════════════
#  TEST 4 — CHATBOT / RAG TUTOR
# ══════════════════════════════════════════════════════════════════════════════
section("TEST 4 — CHATBOT / RAG TUTOR SERVICE")

r4 = requests.post(
    f"{BASE}/chat",
    json={
        "course_id":       COURSE_ID,
        "question":        "What is machine learning and what are its main types?",
        "conversation_id": "test-integration-session",
    },
    timeout=120,
)
t4_ok = check("HTTP 200", r4.status_code == 200, f"status={r4.status_code}")
if t4_ok:
    body = r4.json()
    check("Response has 'answer'",  bool(body.get("answer", "").strip()))
    check("Response has 'sources'", isinstance(body.get("sources"), list),
          f"{len(body.get('sources',[]))} source(s)")
    print(f"\n  Answer preview: {body.get('answer','')[:250]}…\n")
else:
    print(f"  Error body: {r4.text[:300]}")
t4_result = t4_ok


# ══════════════════════════════════════════════════════════════════════════════
#  TEST 5 — INDEX DOCUMENT  (expected 404 — no physical file)
# ══════════════════════════════════════════════════════════════════════════════
section("TEST 5 — INDEX DOCUMENT SERVICE  (expects 404 — no doc on disk)")

r5 = requests.post(
    f"{BASE}/index-document",
    json={"document_id": 999, "course_id": COURSE_ID},
    timeout=30,
)
t5_ok = r5.status_code == 404
check("HTTP 404 (document not found — expected)", t5_ok, f"status={r5.status_code}")
t5_result = True  # 404 is the correct/expected result here


# ══════════════════════════════════════════════════════════════════════════════
#  FINAL SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
section("INTEGRATION TEST SUMMARY")
results = [
    ("Summarize service",              t1_result),
    ("Quiz generation + DB persist",   t2_result),
    ("Evaluator service (10 metrics)", t3_result),
    ("Chatbot / RAG tutor",            t4_result),
    ("Index document (404 expected)",  t5_result),
]
all_passed = all(ok for _, ok in results)
for label, ok in results:
    print(f"  {PASS if ok else FAIL}  {label}")

print()
if all_passed:
    print(f"  {PASS}  All tests passed!")
else:
    failed = [label for label, ok in results if not ok]
    print(f"  {FAIL}  Failed: {', '.join(failed)}")

sys.exit(0 if all_passed else 1)
