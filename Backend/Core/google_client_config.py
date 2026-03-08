from __future__ import annotations

from typing import ClassVar

from pydantic_settings import BaseSettings
from .utils import OptStr


class GoogleClientConfig(BaseSettings):
    
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str

    redirect_uri: OptStr = "http://127.0.0.1:8000/api/login/token"
    path_prefix: str = ""
    login_path: str = "/_login_route"
    token_path: str = "/token"
    logout_path: str = "/_logout_route"
    show_in_docs: bool = False

    scopes: ClassVar[list[str]] = [
        "openid",
        "email",
        "profile",
        # Read list of courses the user is enrolled in / teaching
        "https://www.googleapis.com/auth/classroom.courses.readonly",
        # Read coursework (assignments) created in courses
        "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
        # Read pure study materials posted in courses
        "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
        # Read announcements posted in courses
        "https://www.googleapis.com/auth/classroom.announcements.readonly",
    ]

    @property
    def authority(self) -> str:
        return "https://accounts.google.com/o/oauth2/v2/auth"

    @property
    def token_endpoint(self) -> str:
        return "https://oauth2.googleapis.com/token"

    @property
    def client_id(self) -> str:
        return self.GOOGLE_CLIENT_ID

    @property
    def client_secret(self) -> str:
        return self.GOOGLE_CLIENT_SECRET

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"