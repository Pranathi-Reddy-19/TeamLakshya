# backend/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from ..core.models import Token, User, UserCreate
from ..core.auth_service import AuthService, get_auth_service, get_current_active_user
from ..core.audit_service import log_action, AuditCategory, AuditLevel

router = APIRouter(tags=["Authentication"])


@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    auth_service: AuthService = Depends(get_auth_service),
):
    """
    OAuth2 password flow login endpoint.
    Returns a JWT access token on successful authentication.
    """
    user = await auth_service.authenticate_user(form_data.username, form_data.password)
    if not user:
        # --- FIX: Remove await from log_action ---
        log_action(
            user_id=form_data.username,
            action="LOGIN_FAILURE",
            category=AuditCategory.AUTHENTICATION,
            level=AuditLevel.WARNING,
            details={"reason": "Invalid username or password"},
        )
        # --- End of fix ---
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = auth_service.create_access_token(
        data={"sub": user.username, "role": user.role}
    )

    # --- FIX: Remove await from log_action ---
    log_action(
        user_id=user.username,
        action="LOGIN_SUCCESS",
        category=AuditCategory.AUTHENTICATION,
        level=AuditLevel.INFO,
        details={},
    )
    # --- End of fix ---

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_in: UserCreate,
    auth_service: AuthService = Depends(get_auth_service),
):
    """
    Register a new user.
    Returns the created user object (without password).
    """
    db_user = await auth_service.get_user(user_in.username)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    new_user = await auth_service.create_user(user_in)

    # --- FIX: Remove await from log_action ---
    log_action(
        user_id=new_user.username,
        action="USER_REGISTRATION",
        category=AuditCategory.USER_MANAGEMENT,
        level=AuditLevel.INFO,
        details={},
    )
    # --- End of fix ---

    return new_user


@router.get("/users/me", response_model=User)
async def read_users_me(
    current_user: User = Depends(get_current_active_user),
):
    """
    Test endpoint to retrieve current authenticated user's profile.
    """
    return current_user