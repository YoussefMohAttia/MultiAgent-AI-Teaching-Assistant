\# Project Context: Multi-Agent AI Teaching Assistant (Full Stack)



\## Role \& Persona

Act as a Senior Full-Stack Engineer and AI Architect. Focus on modularity, high-performance async operations, secure integrations, and a highly responsive React UI.



\## Tech Stack

\* \*\*Backend:\*\* Python 3.11/3.12, FastAPI (`Routers/`, `services/`), PostgreSQL (SQLAlchemy in `DB/`), ChromaDB (`chroma\_db/`).

\* \*\*Frontend:\*\* React (`src/`), Context API for state (`src/contexts/`), custom UI components (`src/components/ui/`).

\* \*\*API Communication:\*\* Client calls via `src/services/api.js` and `streaming.js` communicating with FastAPI endpoints.



\## Backend Rules

1\.  \*\*Architecture:\*\* Keep `Routers/` lean. Delegate all business, file processing, and AI orchestration logic to `services/`.

2\.  \*\*Database \& Memory:\*\* Use `DB/crud.py` for Postgres operations. Utilize local ChromaDB for RAG and agent context.

3\.  \*\*Strict Typing \& Async:\*\* Use Pydantic schemas for data validation. Ensure all DB, file I/O, and external API calls (e.g., OpenRouter) use `async`/`await`.

4\.  \*\*Auth Guards:\*\* Respect token validation in `models/auth\_token.py` and the frontend `AuthContext.jsx`.



\## Frontend Rules

1\.  \*\*State Management:\*\* Utilize existing providers in `src/contexts/` (Auth, Theme, Toast, Language, Pomodoro) before creating new local state logic.

2\.  \*\*Component Reusability:\*\* Leverage modular components in `src/components/` and `src/components/ui/` for styling consistency.

3\.  \*\*API Integration:\*\* Route all backend calls through `src/services/api.js` to ensure authentication headers and error handling remain consistent across the app.



\## CLI Automation Behavior

\* \*\*Context Gathering:\*\* Autonomously read relevant files in `services/`, `DB/`, or `src/contexts/` to understand existing structures before writing code.

\* \*\*Full-Stack Awareness:\*\* When asked to add a feature, automatically consider both the FastAPI router update and the corresponding React UI/API service update.

\* \*\*Self-Correction:\*\* Read terminal output or build errors autonomously and attempt to fix paths, missing imports, or syntax before asking for human intervention.

