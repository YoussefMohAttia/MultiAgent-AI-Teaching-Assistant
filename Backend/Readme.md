# Multi-Agent AI Teaching Assistant

A full-stack AI learning platform that syncs course content from Google Classroom and turns it into personalized study workflows.
It combines RAG tutoring, automated summarization, quiz generation, summary evaluation, and essay grading in one system designed for practical student self-study.

## At a Glance

- Problem: students juggle fragmented course materials and spend too much time creating study resources manually.
- Solution: a multi-agent AI platform that ingests course content and produces tutor chat, summaries, quizzes, evaluations, and essay grading.
- Users: students in self-study or revision workflows.
- Architecture: React frontend + FastAPI backend + PostgreSQL + ChromaDB + LLM services.
- Deployment: Docker Compose for full local stack; also supports local dev mode.

## Engineering Highlights

- End-to-end full-stack implementation with production-style API boundaries.
- Asynchronous content ingestion with background automation (indexing, auto-summary, auto-quiz generation).
- Retrieval-Augmented Generation (RAG) tutor with course/document scoping and SSE streaming responses.
- Hybrid evaluation pipeline (embeddings + ROUGE + LLM judging) across 6 summary-quality metrics.
- Local fine-tuned Transformer inference for essay grading (separate from hosted LLM calls).
- Authentication support for both Google OAuth and local OTP-backed accounts.
- Gamified progress engine (XP, levels, streaks, leaderboard) integrated with AI feature events.

## Key Features

- Google OAuth and local email/password authentication (with OTP verification)
- Google Classroom sync pipeline for courses, materials, announcements, and coursework
- Automatic background indexing of course content into per-course Chroma vector stores
- AI Tutor with dual modes:
	- RAG mode scoped to a selected course/document
	- General chat mode without course context
- Streaming chat responses (SSE), voice input (STT), and text-to-speech output (TTS)
- AI Summarizer with two modes:
	- Persisted summaries from synced course documents
	- Ephemeral one-time PDF uploads
- AI Quiz Generator with saved quizzes by course or ephemeral generation from uploaded PDFs/text
- AI Evaluator for student summaries using a 6-metric hybrid rubric:
	- correctness, relevance, coherence, completeness, conciseness, terminology
- Essay Grader powered by a fine-tuned local Transformer model (IELTS-style band prediction)
- Gamification service with XP, levels, streaks, achievements, tasks, and leaderboard
- Modern React dashboard with course library, AI agents workspace, and study utilities

## Tech Stack

- Frontend:
	- React 19, Vite 7, React Router 7
	- Tailwind CSS, Framer Motion, Lucide Icons
	- Axios, React Markdown
- Backend:
	- FastAPI, Uvicorn, Pydantic v2
	- SQLAlchemy Async + asyncpg
	- JWT auth, Google OAuth flow integration
- AI / ML:
	- Google AI Studio OpenAI-compatible API (Gemma models)
	- LangChain text splitters
	- ChromaDB (course-scoped vector retrieval)
	- sentence-transformers, ROUGE, NLTK (evaluation pipeline)
	- Hugging Face Transformers + PyTorch (essay grader)
- Database & Storage:
	- PostgreSQL (primary application DB)
	- Chroma persisted directories per course
	- Local uploaded file storage
- DevOps / Tooling:
	- Docker + Docker Compose
	- Nginx (frontend runtime image)
	- pgAdmin (optional local DB inspection)

## Repository Structure

```text
Backend/      FastAPI app, routers, services, data models, tests
Frontend/     React + Vite client application
Ai Team/      Research notebooks and model experimentation assets
docker-compose.yml  Local multi-service orchestration
README.md     Project documentation
```

## Architecture Overview

The system follows a decoupled frontend/backend architecture with a service-oriented backend.

```mermaid
flowchart LR
		U[Student] --> FE[React Frontend]
		FE -->|REST / SSE| BE[FastAPI Backend]
		BE --> DB[(PostgreSQL)]
		BE --> VS[(Chroma Vector Stores\ncourse_1, course_2, ...)]
		BE --> GC[Google Classroom API]
		BE --> GD[Google Drive Content Access]
		BE --> LLM[Google AI Studio LLMs]
		BE --> EG[Local Fine-Tuned Essay Model]
```

### System Design Notes

- Frontend/Backend separation:
	- Frontend runs on Vite (dev) or Nginx (prod container)
	- Backend exposes REST APIs under `/api/*`
	- Frontend talks to backend through `/api` proxying
- API communication:
	- Standard JSON REST for most operations
	- SSE endpoint for streaming tutor responses (`/api/ai/chat/stream`)
	- Multipart upload endpoints for PDF/audio workflows
- Data model strategy:
	- PostgreSQL stores users, courses, documents, summaries, quizzes, evaluations, chat history, and progress stats
	- Chroma stores dense text chunks per course for retrieval-augmented chat
- Authentication flow:
	- Google OAuth login redirects back to frontend with a JWT
	- Frontend persists token and attaches `Authorization: Bearer <token>`
	- Local account auth supports OTP email verification and password login
- Content ingestion pipeline:
	- Google sync pulls classroom objects and performs delta sync
	- Background jobs optionally auto-index documents, auto-summarize materials, and auto-generate quizzes

## Recruiter-Focused Impact

- Demonstrates system design decisions across web, data, and ML layers.
- Shows practical AI engineering beyond prompt calls: retrieval, persistence, caching, and async workflows.
- Includes real authentication, stateful conversations, and multi-modal features (STT/TTS).
- Structured as a runnable product, not a notebook-only demo.

## Installation & Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- npm 10+
- PostgreSQL 16+ (if running without Docker)
- Docker + Docker Compose (recommended)

### 1) Clone the Repository

```bash
git clone https://github.com/YoussefMohAttia/MultiAgent-AI-Teaching-Assistant.git
cd MultiAgent-AI-Teaching-Assistant
```

### 2) Configure Environment Variables (Backend)

Create `Backend/.env`:

Important: do not commit this file. Use placeholder values only in documentation.

```env
# Core
DATABASE_URL=postgresql+asyncpg://postgres:12345@localhost:5433/teaching_assistant_db
SECRET_KEY=replace_with_a_long_random_secret
FRONTEND_URL=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Required settings from config
CLIENT_ID=placeholder
CLIENT_SECRET=placeholder
TENANT_ID=placeholder

# Google OAuth (Classroom sync/auth)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/api/login/token

# AI provider
GOOGLE_AI_API_KEY=your_google_ai_studio_api_key
GOOGLE_AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
AI_MODEL_NAME=gemma-3-27b-it
EVALUATOR_MODEL_NAME=gemma-4-31b-it

# Email / OTP (for local account registration)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASSWORD=your_smtp_password
SENDER_EMAIL=your_sender_email

# Optional: explicit essay model location
ESSAY_GRADER_MODEL_PATH=

# Optional: storage directories
CHROMA_PERSIST_DIR=./chroma_db
PDF_UPLOAD_DIR=./uploaded_files
```

### 3) Run with Docker Compose (Recommended)

```bash
docker compose up --build
```

Services:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- PostgreSQL: `localhost:5433`
- pgAdmin: `http://localhost:5050`

## Quick Start (60 Seconds)

```bash
git clone https://github.com/YoussefMohAttia/MultiAgent-AI-Teaching-Assistant.git
cd MultiAgent-AI-Teaching-Assistant
# create Backend/.env with your credentials
docker compose up --build
```

Then open `http://localhost:5173`, sign in, sync courses, and start using the AI agents.

### 4) Run Locally Without Docker (Alternative)

Backend:

```bash
cd Backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
# source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Frontend (new terminal):

```bash
cd Frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` to `http://localhost:8000` by default.

## Usage

### Core User Flow

1. Sign in (Google OAuth or local account).
2. Open Dashboard and run course sync (or rely on auto-sync).
3. Browse synced materials in Courses.
4. Use AI Agents:
	 - Chat Tutor for Q&A on course content (or general chat)
	 - Summarizer for lecture/doc summaries
	 - Quiz Generator to create/take quizzes
	 - Evaluator to grade student summaries
	 - Essay Grader for IELTS-style band prediction
5. Track learning progress through XP, streaks, and leaderboard.

### Example Workflows

- Course-grounded tutoring:
	- Select course/document in Chat
	- Ask a concept question
	- Receive source-aware answer with streaming + optional TTS
- Quick one-off study:
	- Upload a PDF directly in Summarizer/Quiz/Evaluator
	- Get output without persisting to course data
- Continuous revision:
	- Sync classroom updates
	- Let background jobs auto-generate summaries/quizzes for new materials

## Demo Checklist (for Reviewers)

1. Sign in and access Dashboard.
2. Trigger full sync for at least one course.
3. Open Chat and ask a course-grounded question.
4. Generate a summary from a synced document.
5. Generate and take a quiz.
6. Evaluate a student summary.
7. Grade an essay and inspect predicted band output.

## API Documentation

Base URL: `http://localhost:8000`

### High-Value Endpoints (Most Used)

- `POST /api/sync/full-sync?user_id={id}` - ingest and process classroom content
- `POST /api/ai/chat` - tutor response with optional course/document scope
- `POST /api/ai/chat/stream` - streaming tutor response (SSE)
- `POST /api/ai/summarize` - summarize source material
- `POST /api/ai/generate-quiz` - generate quiz items
- `POST /api/ai/evaluate` - evaluate student summary
- `POST /api/ai/grade-essay` - grade essay text
- `GET /api/progress/me` - progress and gamification snapshot

### Full Endpoint Reference

### Authentication

- `GET /api/login/_login_route` - Start Google OAuth
- `GET /api/login/token` - OAuth callback/token handling
- `POST /api/login/register` - Register local account with OTP
- `POST /api/login/password` - Local email/password login
- `POST /api/login/send-otp` - Send verification OTP
- `POST /api/login/verify-otp` - Verify OTP
- `GET /api/me` - Get authenticated user profile

### Courses & Documents

- `GET /api/courses/` - List user courses
- `GET /api/documents/{course_id}` - List course documents
- `GET /api/documents/download/{doc_id}` - Download stored document

### Google Classroom Sync

- `POST /api/sync/sync-courses?user_id={id}` - Sync courses only
- `POST /api/sync/full-sync?user_id={id}` - Full sync with background processing
- `GET /api/sync/courses/{user_id}` - List synced courses
- `GET /api/sync/documents/{course_id}` - List synced documents

### AI Endpoints

- `POST /api/ai/chat` - Tutor response (non-streaming)
- `POST /api/ai/chat/stream` - Tutor response streaming (SSE)
- `GET /api/ai/chat/conversations` - List chat conversations
- `GET /api/ai/chat/conversations/{conversation_id}` - Conversation messages
- `POST /api/ai/chat/tts` - Text-to-speech
- `POST /api/ai/chat/stt` - Speech-to-text
- `POST /api/ai/chat-upload` - Ephemeral PDF + chat
- `POST /api/ai/summarize` - Summarize text/document
- `POST /api/ai/summarize-upload` - Summarize uploaded PDF
- `GET /api/ai/summaries` - List saved summaries
- `GET /api/ai/summary-status` - Summary readiness by document IDs
- `POST /api/ai/generate-quiz` - Generate quiz from text/document
- `POST /api/ai/generate-quiz-upload` - Generate quiz from uploaded PDF
- `GET /api/ai/quiz-status` - Quiz readiness by document IDs
- `POST /api/ai/evaluate` - Evaluate student summary
- `POST /api/ai/evaluate-upload` - Evaluate uploaded summary PDF
- `POST /api/ai/grade-essay` - Grade essay text
- `POST /api/ai/grade-essay-upload` - Grade uploaded essay PDF
- `POST /api/ai/index-document` - Index document into vector store

### Quizzes, Comments, and Progress

- `GET /api/quizzes/course/{course_id}` - Quizzes for a course
- `GET /api/comments/post/{doc_id}` - Comments for a document
- `GET /api/progress/me` - User progress summary
- `POST /api/progress/event` - Log progress event
- `GET /api/progress/leaderboard` - Leaderboard

## Screenshots

Add actual product screenshots for strongest recruiter impact.

### Sign In
Add screenshot here

### Dashboard
Add screenshot here

### AI Agents Hub
Add screenshot here

### Chat Tutor (RAG + Streaming)
Add screenshot here

### Summarizer / Quiz / Evaluator / Essay Grader
Add screenshot here

## Testing

From the backend directory:

```bash
cd Backend
python -m unittest discover -s tests
```

You can also run additional project scripts (if configured in your environment):

```bash
python test_all_services.py
```

## Security Notes

- Keep secrets in `Backend/.env` only; never commit real keys/passwords.
- Rotate API keys and SMTP credentials if they were ever exposed.
- Use a strong random `SECRET_KEY` in non-local environments.

## Future Improvements

- Add role-based access control (student/instructor/admin)
- Introduce async task queue (Celery/RQ) for heavy AI jobs and retries
- Add observability stack (structured logs, tracing, service metrics)
- Add migration tooling (Alembic) and stronger schema versioning
- Expand automated test coverage (API contracts, e2e frontend tests)
- Add model routing, cost controls, and per-feature usage quotas
- Add secure secret management and production deployment templates

## Why This Project Matters

This project demonstrates end-to-end engineering across full-stack development, AI integration, asynchronous backend workflows, retrieval pipelines, and practical product design for education. It is structured as a deployable system rather than a notebook-only prototype, making it suitable for portfolio, internship, and early production contexts.
