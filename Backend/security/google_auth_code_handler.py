from typing import Optional, Union
import urllib.parse
import requests
import secrets
from fastapi import HTTPException, Request, status
from starlette.responses import RedirectResponse
from starlette.concurrency import run_in_threadpool

from Core.google_client_config import GoogleClientConfig
from Core.utils import OptStr
from Core.session_manager import SessionManager
from models.auth_code import AuthCode
from models.auth_token import AuthToken
from models.id_token_claims import IDTokenClaims
from models.common import AuthResponse

class GoogleAuthCodeHandler:
    def __init__(self, client_config: GoogleClientConfig):
        self.client_config: GoogleClientConfig = client_config

    async def authorize_redirect(self, request: Request, redirec_uri: str, state: OptStr = None) -> RedirectResponse:
        if not state:
            state = secrets.token_urlsafe(32)
        
        params = {
            "client_id": self.client_config.client_id,
            "response_type": "code",
            "scope": " ".join(self.client_config.scopes),
            "redirect_uri": redirec_uri,
            "state": state,
            "access_type": "offline",
            "prompt": "consent"
        }
        
        auth_uri = f"{self.client_config.authority}?{urllib.parse.urlencode(params)}"
        
        auth_code = AuthCode(
            state=state,
            redirect_uri=redirec_uri,
            auth_uri=auth_uri
        )
        
        session = SessionManager(request=request)
        session.init_session(session_id=auth_code.state)
        await auth_code.save_to_session(session=session)
        
        return RedirectResponse(auth_uri)

    async def authorize_access_token(self, request: Request, code: str, state: OptStr = None) -> AuthToken:
        http_exception = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication Error")
        session = SessionManager(request=request)
        auth_code: Optional[AuthCode] = await AuthCode.load_from_session(session=session)
        
        if (not auth_code) or (not auth_code.state):
            raise http_exception
        if state and (state != auth_code.state):
            raise http_exception

        # Exchange code for token
        token_data = await run_in_threadpool(
            self._exchange_code_for_token,
            code=code,
            redirect_uri=auth_code.redirect_uri
        )
        
        if "error" in token_data:
            http_exception.detail = f"{token_data.get('error')}: {token_data.get('error_description')}"
            raise http_exception

        # Create AuthToken
        auth_token = AuthToken(
            access_token=token_data.get("access_token"),
            id_token=token_data.get("id_token"),
            refresh_token=token_data.get("refresh_token"),
            token_type=token_data.get("token_type"),
            expires_in=token_data.get("expires_in"),
            scope=token_data.get("scope")
        )
        
        # Parse ID Token
        if auth_token.id_token:
             auth_token.id_token_claims = await self.parse_id_token(token=auth_token)

        await auth_token.save_to_session(session=session)
        return auth_token

    def _exchange_code_for_token(self, code: str, redirect_uri: str) -> dict:
        data = {
            "client_id": self.client_config.client_id,
            "client_secret": self.client_config.client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri
        }
        response = requests.post(self.client_config.token_endpoint, data=data)
        return response.json()

    async def parse_id_token(self, *, token: Union[AuthToken, str]) -> Optional[IDTokenClaims]:
        if isinstance(token, AuthToken):
            id_token = token.id_token
        else:
            id_token = token
            
        claims = IDTokenClaims.decode_id_token(id_token=id_token)
        if claims:
            # Map Google claims to what our app expects if needed
            # Google sends 'email', we might want 'preferred_username'
            if not claims.preferred_username and claims.email:
                claims.preferred_username = claims.email
        return claims

    def logout(self, request: Request, callback_url: str) -> RedirectResponse:
        SessionManager(request=request).clear()
        return RedirectResponse(url=callback_url)

    @staticmethod
    async def get_token_from_session(request: Request) -> Optional[AuthToken]:
        return await AuthToken.load_from_session(session=SessionManager(request=request))
