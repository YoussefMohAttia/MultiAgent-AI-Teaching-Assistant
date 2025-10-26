from __future__ import annotations

from enum import Enum
from typing import ClassVar

from pydantic_settings import BaseSettings

from .utils import OptStr


class MSALPolicies(str, Enum):
    AAD_SINGLE = "AAD_SINGLE"


class MSALClientConfig(BaseSettings):
    
    
    client_id: OptStr = None
    client_credential: OptStr = None
    tenant: OptStr = None

    
    policy: MSALPolicies = MSALPolicies.AAD_SINGLE
    
    b2c_policy: OptStr = None

    
    scopes: ClassVar[list[str]] = []
    
    session_type: str = "filesystem"

    
    path_prefix: str = ""
    login_path: str = "/_login_route"
    token_path: str = "/token" 
    logout_path: str = "/_logout_route"
    show_in_docs: bool = False

    
    redirect_uri: OptStr = None

    
    app_name: OptStr = None
    app_version: OptStr = None

    @property
    def authority(self) -> str:
        if not self.policy:
            msg = "Policy must be specificly set before use"
            raise ValueError(msg)

        
        if MSALPolicies.AAD_SINGLE == self.policy:
            authority_url = f"https://login.microsoftonline.com/{self.tenant}"
            return authority_url

        if MSALPolicies.AAD_MULTI == self.policy:
            authority_url = "https://login.microsoftonline.com/common/"
            return authority_url

        
        policy = self.b2c_policy or self.policy.value
        authority_url = f"https://{self.tenant}.b2clogin.com/{self.tenant}.onmicrosoft.com/{policy}"

        return authority_url

    @property
    def login_full_path(self) -> str:
        return f"{self.path_prefix}{self.login_path}"