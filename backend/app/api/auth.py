import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth_schema import (
    SignupRequest,
    LoginRequest,
    UserResponse,
    AuthResponse,
    MessageResponse
)
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post(
    "/signup",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account"
)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    """Create a new user account with hashed password credentials."""
    clean_email = payload.email.strip().lower()

    # Check for duplicate email
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    # Securely hash password
    hashed_pw = hash_password(payload.password)

    # Create new User
    new_user = User(
        id=f"USR-{uuid.uuid4().hex[:8].upper()}",
        full_name=payload.full_name.strip(),
        email=clean_email,
        password_hash=hashed_pw,
        role=payload.role.strip() if payload.role else "Lead Project Engineer",
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to register account. Please try again later."
        )

    return MessageResponse(
        status="success",
        message="Account created successfully! Please proceed to login.",
        user=UserResponse(
            id=new_user.id,
            full_name=new_user.full_name,
            email=new_user.email,
            role=new_user.role,
            created_at=new_user.created_at
        )
    )

@router.post(
    "/login",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user and issue JWT session token"
)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Validate credentials and return signed JWT bearer token."""
    clean_email = payload.email.strip().lower()

    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is currently inactive. Please contact your project administrator."
        )

    # Issue JWT access token
    token_claims = {
        "sub": user.id,
        "email": user.email,
        "name": user.full_name,
        "role": user.role
    }
    access_token = create_access_token(data=token_claims)

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            created_at=user.created_at
        )
    )

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile"
)
def get_me(current_user: User = Depends(get_current_user)):
    """Return profile data of the currently logged-in user."""
    return UserResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        created_at=current_user.created_at
    )
