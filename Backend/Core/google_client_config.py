from __future__ import annotations

from typing import ClassVar

from pydantic_settings import BaseSettings
from .utils import OptStr


class GoogleClientConfig(BaseSettings):
    
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str

    
    redirect_uri: OptStr = "http://localhost:8000/api/login/token"
    path_prefix: str = ""
    login_path: str = "/_login_route"
    token_path: str = "/token"
    logout_path: str = "/_logout_route"
    show_in_docs: bool = False

    scopes: ClassVar[list[str]] = ["openid", "email", "profile"]

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
