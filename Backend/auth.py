from typing import Annotated, Optional
from datetime import datetime, timedelta  
import jwt
from fastapi import APIRouter, Form, Header
from starlette.requests import Request
from starlette.responses import RedirectResponse
from Core.config import settings
from Core.utils import OptStr
from models.auth_token import AuthToken
from models.id_token_claims import IDTokenClaims
from models.common import BearerToken
from security.google_auth_code_handler import GoogleAuthCodeHandler
from security.google_scheme import GoogleScheme
from Core.google_client_config import GoogleClientConfig
from models.id_token_claims import TokenStatus
from DB import crud 




class GoogleAuthorization:
    def __init__(
        self,
        client_config: GoogleClientConfig,
        return_to_path: str = "/",
        tags: Optional[list[str]] = None,  # type: ignore [unused-ignore]
    ):
        self.handler = GoogleAuthCodeHandler(client_config=client_config)
        if not tags:
            tags = ["authentication"]
        self.return_to_path = return_to_path
        self.router = APIRouter(prefix=client_config.path_prefix, tags=tags)  # type: ignore
        self.router.add_api_route(
            name="_login_route",
            path=client_config.login_path,
            endpoint=self._login_route,
            methods=["GET"],
            include_in_schema=client_config.show_in_docs,
        )

        self.router.add_api_route(
            name="_get_token_route",
            path=client_config.token_path,
            endpoint=self._get_token_route,
            methods=["GET"],
            include_in_schema=client_config.show_in_docs,
        )

        self.router.add_api_route(
            name="_post_token_route",
            path=client_config.token_path,
            endpoint=self._post_token_route,
            methods=["POST"],
            response_model=BearerToken,
            include_in_schema=client_config.show_in_docs,
        )
        self.router.add_api_route(
            client_config.logout_path,
            self._logout_route,
            methods=["GET"],
            include_in_schema=client_config.show_in_docs,
        )

    async def _login_route(
        self,
        request: Request,
        redirect_uri: OptStr = None,
        state: OptStr = None,
        client_id: OptStr = None,
    ) -> RedirectResponse:
        if client_id:
            print(client_id)
        if not redirect_uri:
            if self.handler.client_config.redirect_uri:
                redirect_uri = self.handler.client_config.redirect_uri
            else:
                redirect_uri = str(request.url_for("_get_token_route"))
        return await self.handler.authorize_redirect(request=request, redirec_uri=redirect_uri, state=state)

    async def _get_token_route(self, request: Request, code: str, state: OptStr) -> RedirectResponse:
        # 1. Exchange Code for Token
        token: AuthToken = await self.handler.authorize_access_token(request=request, code=code, state=state)
        
        # 2. Extract Data from Token
        claims = token.id_token_claims.__dict__
        google_id = claims.get("subject") or claims.get("sub")
        email = claims.get("preferred_username") or claims.get("email")
        name = claims.get("display_name") or claims.get("name") or (email.split("@")[0] if email else "Unknown")

        # 3. DATABASE SYNC (The New Clean Way)
        from DB.session import get_db
        
        async for db in get_db():
            # Check if user exists using CRUD
            user = await crud.get_user_by_google_id(db, google_id)
            
            if not user:
                # Create new user if they don't exist
                user = await crud.create_new_user(db, google_id, email, name)
            user.google_access_token = token.access_token
            user.google_refresh_token = token.refresh_token
            if isinstance(token.expires_in, int):
                user.google_token_expires_at = datetime.utcnow() + timedelta(seconds=token.expires_in)
            else:
                user.google_token_expires_at = datetime.utcnow() + token.expires_in  
        
            await db.commit()
            # We break because we only need to do this once
            break

        # 4. Issue Session Cookie
        
        
        
        jwt_token = jwt.encode(
            {"sub": google_id, "email": email, "name": name, "exp": datetime.utcnow() + timedelta(days=30)},
            settings.SECRET_KEY,
            algorithm="HS256"
        )

        response = RedirectResponse(url=self.return_to_path)
        response.set_cookie("jwt_token", jwt_token, httponly=True, samesite="lax", max_age=2592000)
        return response

    async def _post_token_route(
        self, request: Request, code: Annotated[str, Form()], state: Annotated[OptStr, Form()] = None
    ) -> BearerToken:
        token: AuthToken = await self.handler.authorize_access_token(request=request, code=code, state=state)
        return BearerToken(access_token=token.id_token)

    async def _logout_route(
        self, request: Request, referer: Annotated[OptStr, Header()] = None, callback_url: OptStr = None
    ) -> RedirectResponse:
        # check if callback_url is set, if not try to get it from referer header
        callback_url = callback_url or referer or str(self.return_to_path)
        return self.handler.logout(request=request, callback_url=callback_url)

    async def get_session_token(self, request: Request) -> Optional[AuthToken]:
        return await self.handler.get_token_from_session(request=request)

    async def check_authenticated_session(self, request: Request) -> bool:
        auth_token: Optional[AuthToken] = await self.get_session_token(request)
        if auth_token:
            token_claims: Optional[IDTokenClaims] = await self.handler.parse_id_token(token=auth_token)
            if token_claims and token_claims.validate_token() == TokenStatus.VALID:
                return True
        return False

    @property
    def scheme(self) -> GoogleScheme:
        return GoogleScheme(
            authorization_url=self.router.url_path_for("_login_route"),
            token_url=self.router.url_path_for("_post_token_route"),
            handler=self.handler,
        )