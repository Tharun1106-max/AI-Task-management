"""Security, Cryptography, and JWT Authentication Utilities.

Provides bcrypt password hashing, JWT token creation/decoding,
and reusable FastAPI authentication and role-based access control dependencies.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional
from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings
from app.database.mongodb import get_collection
from app.models.user import UserInDB, UserRole
from app.schemas.user import TokenData

settings = get_settings()

import bcrypt

# Cryptographic password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme for Swagger UI & bearer token extraction
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login",
    auto_error=True,
)


# ==============================================================================
# Password Hashing Functions
# ==============================================================================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            hashed_password.encode("utf-8"),
        )
    except Exception:
        # Fallback to pwd_context for legacy hashes
        try:
            return pwd_context.verify(plain_password[:72], hashed_password)
        except Exception:
            return False


def hash_password(password: str) -> str:
    """Generate a secure bcrypt hash for a plaintext password."""
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")



# ==============================================================================
# JWT Token Generation & Verification
# ==============================================================================

def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Encode a cryptographically signed JWT access token.

    Args:
        data (dict): Payload claims to encode.
        expires_delta (timedelta, optional): Custom expiration duration.

    Returns:
        str: Encoded JWT string.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": now,
        "token_type": "access",
    })
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)


def create_refresh_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Encode a long-lived JWT refresh token (default 7 days)."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=7)

    to_encode.update({
        "exp": expire,
        "iat": now,
        "token_type": "refresh",
    })
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT token's signature and expiration."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.ALGORITHM],
        )
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


# ==============================================================================
# FastAPI Authentication & RBAC Dependencies
# ==============================================================================

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserInDB:
    """FastAPI dependency to extract and authenticate the current user from Bearer token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    user_id: Optional[str] = payload.get("sub")
    email: Optional[str] = payload.get("email")
    role: Optional[str] = payload.get("role")
    token_type: Optional[str] = payload.get("token_type")

    if not user_id or not email or token_type != "access":
        raise credentials_exception

    # Query user from MongoDB
    users_col = get_collection("users")
    user_doc = None

    if ObjectId.is_valid(user_id):
        user_doc = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user_doc:
        user_doc = await users_col.find_one({"email": email})

    if not user_doc:
        raise credentials_exception

    return UserInDB.from_mongo(user_doc)


def require_role(allowed_roles: List[UserRole]) -> Callable:
    """Role-based access control dependency factory.

    Args:
        allowed_roles (List[UserRole]): Allowed roles permitted to access endpoint.

    Returns:
        Callable: FastAPI dependency ensuring user has permission.
    """
    async def role_checker(current_user: UserInDB = Depends(get_current_user)) -> UserInDB:
        # OWNER has universal authorization
        if current_user.role == UserRole.OWNER or current_user.role in allowed_roles:
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Requires one of {[r.value for r in allowed_roles]} roles.",
        )

    return role_checker
