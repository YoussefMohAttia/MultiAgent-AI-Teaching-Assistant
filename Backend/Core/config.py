# backend/Core/config.py

from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Will be overridden by .env – these are just fallbacks
    DATABASE_URL: str = "postgresql+asyncpg://postgres:123456@localhost:5432/teaching_assistant_db"

    CLIENT_ID: str
    CLIENT_SECRET: str
    TENANT_ID: str

    SECRET_KEY: str = "change_this_in_production_please_make_it_long_and_random"
    REDIRECT_URI: str = "http://localhost:8000/auth/callback"

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