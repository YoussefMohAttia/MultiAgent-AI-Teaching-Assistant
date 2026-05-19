from typing import Annotated, Optional
from datetime import datetime, timedelta  
import jwt
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Form, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
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
from DB.session import get_db


class LocalAccountPayload(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    otp_code: Optional[str] = None  # Optional for backwards compatibility


class SendOTPPayload(BaseModel):
    email: str


class VerifyOTPPayload(BaseModel):
    email: str
    otp_code: str


class RegisterWithOTPPayload(BaseModel):
    email: str
    otp_code: str
    password: str
    name: Optional[str] = None




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
        self.router.add_api_route(
            path="/register",
            endpoint=self._register_local_account,
            methods=["POST"],
            response_model=BearerToken,
            include_in_schema=True,
        )
        self.router.add_api_route(
            path="/password",
            endpoint=self._login_local_account,
            methods=["POST"],
            response_model=BearerToken,
            include_in_schema=True,
        )
        self.router.add_api_route(
            path="/send-otp",
            endpoint=self._send_otp,
            methods=["POST"],
            include_in_schema=True,
        )
        self.router.add_api_route(
            path="/verify-otp",
            endpoint=self._verify_otp_endpoint,
            methods=["POST"],
            include_in_schema=True,
        )

    def _build_jwt(self, *, user_id: str, email: str, name: str, auth_provider: str) -> str:
        return jwt.encode(
            {
                "sub": user_id,
                "email": email,
                "name": name,
                "auth_provider": auth_provider,
                "exp": datetime.utcnow() + timedelta(days=30),
            },
            settings.SECRET_KEY,
            algorithm="HS256",
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
            user.google_access_token = encrypt_token(token.access_token)
            user.google_refresh_token = encrypt_token(token.refresh_token)
            user.auto_jobs_enabled = True
            if token.expires_in is not None:
                if isinstance(token.expires_in, timedelta):
                    user.google_token_expires_at = datetime.utcnow() + token.expires_in
                else:
                    user.google_token_expires_at = datetime.utcnow() + timedelta(seconds=int(token.expires_in))
        
            await db.commit()
            # We break because we only need to do this once
            break

        # 4. Issue Session Cookie
        
        
        
        jwt_token = jwt.encode(
            {
                "sub": google_id,
                "email": email,
                "name": name,
                "auth_provider": user.auth_provider,
                "exp": datetime.utcnow() + timedelta(days=30),
            },
            settings.SECRET_KEY,
            algorithm="HS256",
        )

        redirect_url = f"{self.return_to_path}?token={jwt_token}"
        response = RedirectResponse(url=redirect_url)
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
        try:
            auth_token = await self.handler.get_token_from_session(request=request)
            claims = None
            if auth_token and auth_token.id_token_claims:
                claims = auth_token.id_token_claims.__dict__
            elif auth_token and auth_token.id_token:
                parsed = await self.handler.parse_id_token(token=auth_token)
                if parsed:
                    claims = parsed.__dict__
            google_id = claims.get("subject") or claims.get("sub") if claims else None
            if google_id:
                from DB.session import get_db
                async for db in get_db():
                    user = await crud.get_user_by_google_id(db, google_id)
                    if user:
                        user.auto_jobs_enabled = False
                        await db.commit()
                    break
        except Exception:
            pass
        return self.handler.logout(request=request, callback_url=callback_url)

    async def _register_local_account(
        self,
        payload: LocalAccountPayload,
        db: AsyncSession = Depends(get_db),
    ) -> BearerToken:
        existing_user = await crud.get_user_by_email(db, payload.email.lower())
        if existing_user:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")

        if not payload.otp_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP code is required. Verify your email before creating the account.",
            )

        otp_record = await crud.get_verified_otp(db, payload.email)
        if not otp_record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email not verified. Please verify your email with OTP first.",
            )

        try:
            user = await crud.create_local_user(db, payload.email, payload.password, payload.name)
            await crud.delete_otp(db, payload.email)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

        return BearerToken(
            access_token=self._build_jwt(
                user_id=user.google_id,
                email=user.email,
                name=user.name,
                auth_provider=user.auth_provider,
            )
        )

    async def _login_local_account(
        self,
        payload: LocalAccountPayload,
        db: AsyncSession = Depends(get_db),
    ) -> BearerToken:
        user = await crud.authenticate_local_user(db, payload.email, payload.password)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

        return BearerToken(
            access_token=self._build_jwt(
                user_id=user.google_id,
                email=user.email,
                name=user.name,
                auth_provider=user.auth_provider,
            )
        )

    async def _send_otp(
        self,
        payload: SendOTPPayload,
        db: AsyncSession = Depends(get_db),
    ) -> dict:
        """Send OTP code to email for verification."""
        import secrets
        from services.email_service import send_otp_email

        if not settings.SMTP_USER or not settings.SMTP_PASSWORD or not settings.SENDER_EMAIL:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Email service is not configured. Set SMTP_USER, SMTP_PASSWORD, and SENDER_EMAIL in Backend/.env.",
            )
        
        # Check if email already registered
        existing_user = await crud.get_user_by_email(db, payload.email.lower())
        if existing_user:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        
        # Generate 6-digit OTP
        otp_code = str(secrets.randbelow(1000000)).zfill(6)
        
        # Store in database
        await crud.create_otp(db, payload.email, otp_code, expiration_minutes=settings.OTP_EXPIRATION_MINUTES)
        
        # Send email
        email_sent = await send_otp_email(payload.email, otp_code)
        if not email_sent:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OTP could not be sent. Check SMTP credentials and server access.",
            )
        
        return {
            "success": True,
            "message": "OTP sent to email",
            "email": payload.email
        }

    async def _verify_otp_endpoint(
        self,
        payload: VerifyOTPPayload,
        db: AsyncSession = Depends(get_db),
    ) -> dict:
        """Verify OTP code."""
        is_valid = await crud.verify_otp(db, payload.email, payload.otp_code)
        if not is_valid:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired OTP code")
        
        return {"success": True, "message": "OTP verified successfully"}

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