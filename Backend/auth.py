from typing import Annotated, Optional

from fastapi import APIRouter, Form, Header
from starlette.requests import Request
from starlette.responses import RedirectResponse

from Core.msal_client_config import MSALClientConfig
from Core.utils import OptStr
from models.auth_token import AuthToken
from models.id_token_claims import IDTokenClaims
from models.common import BearerToken
from security.msal_auth_code_handler import MSALAuthCodeHandler 
from security.msal_scheme import MSALScheme
from models.id_token_claims import TokenStatus


class MSALAuthorization:
    def __init__(
        self,
        client_config: MSALClientConfig,
        return_to_path: str = "/",
        tags: Optional[list[str]] = None,  # type: ignore [unused-ignore]
    ):
        self.handler = MSALAuthCodeHandler(client_config=client_config)
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
        token: AuthToken = await self.handler.authorize_access_token(request=request, code=code, state=state)

        from DB.schemas import User
        from DB.session import get_db
        from sqlalchemy import select
        from datetime import datetime, timedelta
        import jwt
        from Core.config import settings

        claims = token.id_token_claims.__dict__ if token.id_token_claims else {}

        # THIS IS THE CORRECT WAY — WORKS WITH YOUR TOKEN
        azure_id = (
            claims.get("oid") or 
            claims.get("sub") or 
            claims.get("subject") or 
            claims.get("user_id")
        )
        email = claims.get("preferred_username") or claims.get("email", "unknown@alexu.edu.eg")
        name = claims.get("display_name") or claims.get("name") or email.split("@")[0]

        # Save to DB
        async for db in get_db():
            result = await db.execute(select(User).where(User.azure_id == azure_id))
            user = result.scalars().first()
            if not user:
                user = User(
                    azure_id=azure_id,
                    email=email,
                    name=name,
                    created_at=datetime.utcnow()
                )
                db.add(user)
            user.last_login = datetime.utcnow()
            await db.commit()
            break

        # Set JWT cookie
        jwt_token = jwt.encode(
            {"sub": azure_id, "email": email, "name": name, "exp": datetime.utcnow() + timedelta(days=30)},
            settings.SECRET_KEY,
            algorithm="HS256"
        )

        response = RedirectResponse(url="/")
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
    def scheme(self) -> MSALScheme:
        return MSALScheme(
            authorization_url=self.router.url_path_for("_login_route"),
            token_url=self.router.url_path_for("_post_token_route"),
            handler=self.handler,
        )