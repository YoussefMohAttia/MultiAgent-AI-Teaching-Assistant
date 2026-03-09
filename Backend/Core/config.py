# backend/Core/config.py

from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Will be overridden by .env – these are just fallbacks
    DATABASE_URL: str = "sqlite+aiosqlite:///./teaching_assistant.db"

    CLIENT_ID: str
    CLIENT_SECRET: str
    TENANT_ID: str

    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str

    SECRET_KEY: str = "change_this_in_production_please_make_it_long_and_random"
    REDIRECT_URI: str = "http://localhost:8000/login/token"

    # ── AI / Google AI Studio Settings ─────────────────────────────────────
    GOOGLE_AI_API_KEY: str = ""
    GOOGLE_AI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    AI_MODEL_NAME: str = "gemma-3-27b-it"
    EVALUATOR_MODEL_NAME: str = "gemini-2.5-flash"
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    PDF_UPLOAD_DIR: str = "./uploaded_files"

    @property
    def AUTHORITY(self) -> str:
        return f"https://login.microsoftonline.com/{self.TENANT_ID}"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()