from typing import Optional

from fastapi import HTTPException, Request, status
from fastapi.openapi.models import OAuth2 as OAuth2Model
from fastapi.openapi.models import OAuthFlowAuthorizationCode, SecuritySchemeType
from fastapi.openapi.models import OAuthFlows as OAuthFlowsModel
from fastapi.security.base import SecurityBase
from fastapi.security.utils import get_authorization_scheme_param

from models.auth_token import AuthToken
from models.id_token_claims import IDTokenClaims , TokenStatus

from .google_auth_code_handler import GoogleAuthCodeHandler


class GoogleScheme(SecurityBase):
    def __init__(
        self,
        authorization_url: str,
        token_url: str,
        handler: GoogleAuthCodeHandler,
        refresh_url: Optional[str] = None,
        scopes: Optional[dict[str, str]] = None,
    ):
        self.handler = handler
        if not scopes:
            scopes = {}
        self.scheme_name = self.__class__.__name__

        flows = OAuthFlowsModel(
            authorizationCode=OAuthFlowAuthorizationCode(
                authorizationUrl=authorization_url,
                tokenUrl=token_url,
                scopes=scopes,
                refreshUrl=refresh_url,
            )
        )
        # needs further investigation (type...)
        self.model = OAuth2Model(flows=flows, type=SecuritySchemeType.oauth2)

    async def __call__(self, request: Request) -> IDTokenClaims:
        http_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

        # 1. retrieve token from header or session
        token_claims: Optional[IDTokenClaims] = None
        # 1.a. retrieve token from header
        authorization: str = request.headers.get("Authorization")
        scheme, param = get_authorization_scheme_param(authorization)
        if scheme.lower() == "bearer":
            # This part might need adjustment if we want to validate bearer tokens from Google
            # For now, let's assume we are using session based auth mostly
            # But if we receive a bearer token, we should validate it.
            # Google ID tokens can be validated.
            # For now, let's skip header validation implementation details or assume parse_id_token handles it
            token_claims = await self.handler.parse_id_token(token=param)
        
        # 1.b. retrieve token from session
        if not token_claims:
            auth_token: Optional[AuthToken] = await self.handler.get_token_from_session(request=request)
            if auth_token:
                token_claims = await self.handler.parse_id_token(token=auth_token)

        if not token_claims:
            raise http_exception

        # 2. validate token
        # We need to check if validate_token works for Google tokens.
        # IDTokenClaims.validate_token checks issuer, audience, exp, etc.
        # We might need to pass expected issuer/audience.
        # For now, let's assume basic validation.
        if token_claims.validate_token() != TokenStatus.VALID:
             raise http_exception

        return token_claims
