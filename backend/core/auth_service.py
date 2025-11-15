# backend/core/auth_service.py
import asyncio
from neo4j import AsyncDriver
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt
import logging
import os

# --- FastAPI Imports ---
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

# --- Relative Imports ---
from .models import User, UserInDB, TokenData, UserCreate
from .db_connect import db_manager
from .audit_service import log_action, AuditCategory, AuditLevel

# --- Configuration ---
SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "your-fallback-secret-key-for-local-dev")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# --- Setup ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
log = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


class AuthService:
    """
    Handles user authentication, password management, and JWT creation.
    """
    oauth2_scheme = oauth2_scheme

    def __init__(self, driver: AsyncDriver):
        self.driver = driver
        if not self.driver:
            log.error("AuthService initialized without a valid Neo4j driver.")
            raise ValueError("Neo4j driver is not initialized")
        log.info("AuthService initialized with Neo4j driver.")

    def _truncate_password(self, password: str) -> str:
        """Truncate password to 72 bytes (bcrypt limit)"""
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            log.warning("Password exceeded 72 bytes and was truncated for bcrypt compatibility.")
            return password_bytes[:72].decode('utf-8', 'ignore')
        return password

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verifies a plain password against a hashed one (synchronous, CPU-bound)."""
        plain_password = self._truncate_password(plain_password)
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        """Hashes a plain password (synchronous, CPU-bound)."""
        password = self._truncate_password(password)
        return pwd_context.hash(password)

    async def get_user(self, username: str) -> Optional[UserInDB]:
        """Retrieves a user from Neo4j by username."""
        query = "MATCH (u:User {username: $username}) RETURN u"
        try:
            driver = await db_manager.get_neo4j_driver()
            async with driver.session() as session:
                result = await session.run(query, username=username)
                record = await result.single()
                if record:
                    return UserInDB(**dict(record["u"]))
        except Exception as e:
            log.error(f"Error getting user {username}: {e}")
        return None

    async def authenticate_user(self, username: str, password: str) -> Optional[UserInDB]:
        """Authenticates a user. Returns the user object if successful, else None."""
        user = await self.get_user(username)
        if not user:
            return None

        # --- CRITICAL FIX: Run blocking bcrypt verify in thread pool ---
        try:
            is_valid = await asyncio.to_thread(self.verify_password, password, user.hashed_password)
        except Exception as e:
            log.error(f"Password verification failed for {username}: {e}")
            is_valid = False
        # --- End of fix ---

        if not is_valid:
            log_action(
                user_id=username,
                action="LOGIN_FAILED",
                category=AuditCategory.AUTHENTICATION,
                level=AuditLevel.WARNING,
                details={"reason": "invalid_password"}
            )
            return None

        log_action(
            user_id=username,
            action="LOGIN_SUCCESS",
            category=AuditCategory.AUTHENTICATION,
            level=AuditLevel.INFO,
            details={}
        )
        return user

    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Creates a JWT access token."""
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + (
            expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    async def create_user(self, user_in: UserCreate) -> User:
        """
        Creates a new user in the Neo4j database.
        """
        # --- CRITICAL FIX: Run blocking bcrypt hash in thread pool ---
        hashed_password = await asyncio.to_thread(self.get_password_hash, user_in.password)
        # --- End of fix ---

        user_data = user_in.model_dump(exclude={"password"})
        user_data_db = user_data.copy()
        user_data_db["hashed_password"] = hashed_password

        query = """
        CREATE (u:User {
            username: $username,
            email: $email,
            full_name: $full_name,
            role: $role,
            hashed_password: $hashed_password,
            created_at: timestamp()
        })
        RETURN u
        """

        try:
            driver = await db_manager.get_neo4j_driver()
            async with driver.session() as session:
                result = await session.run(query, **user_data_db)
                record = await result.single()
                if record:
                    created_user = dict(record["u"])
                    log_action(
                        user_id=created_user["username"],
                        action="USER_CREATED",
                        category=AuditCategory.AUTHENTICATION,
                        level=AuditLevel.INFO,
                        details={"created_by": "system"}
                    )
                    return User(**user_data)

        except Exception as e:
            log.error(f"Error creating user {user_in.username}: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not create user"
            )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )


# --- Dependency Injection ---
_auth_service_instance: Optional[AuthService] = None


async def get_auth_service() -> AuthService:
    """Async dependency to get singleton AuthService instance."""
    global _auth_service_instance
    if _auth_service_instance is None:
        try:
            driver = await db_manager.get_neo4j_driver()
            if not driver:
                raise RuntimeError("Neo4j driver not available")
            _auth_service_instance = AuthService(driver)
        except Exception as e:
            log.error(f"Failed to initialize AuthService: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service unavailable"
            )
    return _auth_service_instance


async def get_current_active_user(
    token: str = Depends(oauth2_scheme),
    auth_service: AuthService = Depends(get_auth_service)
) -> User:
    """
    Dependency to get the current authenticated user from JWT token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if auth_service is None:
        log.error("AuthService dependency is None")
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise credentials_exception
        token_data = TokenData(username=username)
    except jwt.PyJWTError as e:
        log_action(
            user_id="unknown",
            action="TOKEN_VALIDATION_FAILURE",
            category=AuditCategory.AUTHENTICATION,
            level=AuditLevel.WARNING,
            details={"error": str(e)}
        )
        raise credentials_exception

    user = await auth_service.get_user(username=token_data.username)
    if not user:
        log_action(
            user_id=token_data.username,
            action="TOKEN_VALIDATION_FAILURE",
            category=AuditCategory.AUTHENTICATION,
            level=AuditLevel.WARNING,
            details={"reason": "user_not_found"}
        )
        raise credentials_exception

    return User(
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role
    )