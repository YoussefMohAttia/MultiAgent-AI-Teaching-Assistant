# backend/Core/msal_client_config.py
from __future__ import annotations

from enum import Enum
from typing import ClassVar

from pydantic_settings import BaseSettings
from .utils import OptStr


class MSALPolicies(str, Enum):
    AAD_SINGLE = "AAD_SINGLE"


class MSALClientConfig(BaseSettings):
    # Real env vars (what you have in .env)
    CLIENT_ID: str
    CLIENT_SECRET: str
    TENANT_ID: str

    # Optional overrides
    redirect_uri: OptStr = "http://localhost:8000/login/callback"
    path_prefix: str = ""
    login_path: str = "/_login_route"
    token_path: str = "/callback"     # ← NEW — THIS IS THE MISSING PIECE
    logout_path: str = "/_logout_route"
    show_in_docs: bool = False

    policy: MSALPolicies = MSALPolicies.AAD_SINGLE
    scopes: ClassVar[list[str]] = ["User.Read"]

    @property
    def authority(self) -> str:
        return f"https://login.microsoftonline.com/{self.TENANT_ID}"

    # BACKWARD COMPATIBILITY — old code expects these snake_case names
    @property
    def client_id(self) -> str:
        return self.CLIENT_ID

    @property
    def client_credential(self) -> str:
        return self.CLIENT_SECRET

    @property
    def tenant(self) -> str:
        return self.TENANT_ID

    @property
    def app_name(self) -> str | None:
        return None

    @property
    def app_version(self) -> str | None:
        return None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"