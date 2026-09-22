"""Application Configuration Module.

Leverages Pydantic v2 and pydantic-settings to validate, type-check, and load
environment variables from .env or the host environment.
"""

from functools import lru_cache
import json
from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application settings and environment variable schema."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # ==============================================================================
    # App & Network Configuration
    # ==============================================================================
    APP_NAME: str = Field(default="TaskPilot", description="Name of the application")
    APP_VERSION: str = Field(default="1.0.0", description="API version")
    HOST: str = Field(default="0.0.0.0", description="Host address to bind the server to")
    PORT: int = Field(default=8000, description="Port number to run the backend service on")
    ENVIRONMENT: str = Field(
        default="development",
        description="Runtime environment: 'development', 'staging', or 'production'",
    )
    DEBUG: bool = Field(default=True, description="Debug mode flag (enables verbose stack traces)")

    # Frontend Integration & CORS
    FRONTEND_URL: str = Field(
        default="http://localhost:3000",
        description="Primary URL for the web frontend client",
    )
    CORS_ORIGINS: Union[str, List[str]] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        description="Allowed CORS origin domains (JSON array or comma-separated string)",
    )

    # ==============================================================================
    # Database Configuration (MongoDB)
    # ==============================================================================
    MONGO_URI: str = Field(
        default="mongodb://localhost:27017",
        description="MongoDB connection string (local URI or Atlas mongodb+srv://)",
    )
    MONGO_DB_NAME: str = Field(
        default="taskpilot_db",
        description="Target MongoDB database name",
    )
    MONGO_MIN_POOL_SIZE: int = Field(default=10, description="Minimum connection pool size")
    MONGO_MAX_POOL_SIZE: int = Field(default=50, description="Maximum connection pool size")

    # ==============================================================================
    # Security & Authentication (JWT)
    # ==============================================================================
    JWT_SECRET: str = Field(
        default="dev_insecure_jwt_secret_change_me_in_production_key_32chars",
        description="Cryptographically secure 256-bit secret key for signing JWT tokens",
    )
    ALGORITHM: str = Field(default="HS256", description="JWT cryptographic signing algorithm")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=1440,
        description="Access token expiration window in minutes (1440 = 24 hours)",
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=7,
        description="Refresh token expiration window in days (7 days)",
    )

    # ==============================================================================
    # AI Acceleration & Guardrails (Google Gemini)
    # ==============================================================================
    GEMINI_API_KEY: str = Field(
        default="",
        description="API key for Google Gemini Generative AI services",
    )
    GEMINI_MODEL: str = Field(
        default="gemini-3-flash-preview",
        description="Primary Google Gemini model identifier for AI synthesis",
    )
    GEMINI_FALLBACK_MODELS: Union[str, List[str]] = Field(
        default=[
            "gemini-3.5-flash",
            "gemini-3.6-flash",
            "gemini-3.7-flash",
            "gemini-3.1-flash-lite",
            "gemini-3.5-flash-lite",
            "gemini-3.8-flash",
            "gemini-flash-latest",
        ],
        description="All fallback Gemini models to automatically switch to if primary model token limit, quota, or rate limit is exhausted",
    )
    GEMINI_EMBEDDING_MODEL: str = Field(
        default="text-embedding-004",
        description="Google Gemini model identifier for vector embeddings",
    )
    GEMINI_TEMPERATURE: float = Field(
        default=0.2,
        description="Default sampling temperature for structured synthesis",
    )
    GROQ_API_KEY: str = Field(
        default="",
        description="Legacy API key for Groq Cloud LLM acceleration services (optional)",
    )
    GROQ_MODEL: str = Field(
        default="llama-3.3-70b-versatile",
        description="Legacy Groq model identifier",
    )
    GROQ_FALLBACK_MODEL: str = Field(
        default="llama-3.1-8b-instant",
        description="Legacy Groq fallback model identifier",
    )
    GROQ_TEMPERATURE: float = Field(
        default=0.2,
        description="Default sampling temperature for JSON extraction",
    )
    AI_RATE_LIMIT_PER_MINUTE: int = Field(
        default=30,
        description="Maximum AI inference requests permitted per minute per IP/user",
    )
    AI_DAILY_TOKEN_QUOTA: int = Field(
        default=50000,
        description="Maximum cumulative AI tokens permitted per user per UTC day",
    )

    # ==============================================================================
    # File Ingestion & Storage Limits
    # ==============================================================================
    MAX_FILE_SIZE_MB: int = Field(
        default=10,
        description="Maximum allowed file size for document uploads in megabytes",
    )
    ALLOWED_EXTENSIONS: Union[str, List[str]] = Field(
        default=[".pdf", ".txt", ".md"],
        description="Permitted file extensions for document ingestion (JSON array or comma-separated)",
    )

    # ==============================================================================
    # Field Validators
    # ==============================================================================
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        """Normalize comma-delimited strings or JSON lists into a cleaned list of origin URLs."""
        if isinstance(v, str):
            v_trimmed = v.strip()
            if v_trimmed.startswith("[") and v_trimmed.endswith("]"):
                try:
                    parsed = json.loads(v_trimmed)
                    if isinstance(parsed, list):
                        return [str(origin).strip() for origin in parsed if str(origin).strip()]
                except Exception:
                    pass
            # Comma-delimited
            return [origin.strip() for origin in v_trimmed.split(",") if origin.strip()]
        elif isinstance(v, list):
            return [str(origin).strip() for origin in v if str(origin).strip()]
        return []

    @field_validator("GEMINI_FALLBACK_MODELS", mode="before")
    @classmethod
    def assemble_gemini_fallback_models(cls, v: Union[str, List[str]]) -> List[str]:
        """Normalize comma-delimited strings or JSON lists into a list of Gemini models."""
        if isinstance(v, str):
            v_trimmed = v.strip()
            if v_trimmed.startswith("[") and v_trimmed.endswith("]"):
                try:
                    parsed = json.loads(v_trimmed)
                    if isinstance(parsed, list):
                        return [str(m).strip() for m in parsed if str(m).strip()]
                except Exception:
                    pass
            return [m.strip() for m in v_trimmed.split(",") if m.strip()]
        elif isinstance(v, list):
            return [str(m).strip() for m in v if str(m).strip()]
        return [
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-3.8-flash",
            "gemini-3.7-flash",
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            "gemini-3.5-flash-lite",
            "gemini-3.1-flash-lite",
            "gemini-flash-latest",
            "gemini-flash-lite-latest",
            "gemini-2.5-pro",
            "gemini-3.1-pro-preview",
            "gemini-pro-latest",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-1.5-flash-8b",
            "gemini-1.5-pro",
        ]

    @field_validator("ALLOWED_EXTENSIONS", mode="before")
    @classmethod
    def assemble_allowed_extensions(cls, v: Union[str, List[str]]) -> List[str]:
        """Normalize comma-delimited strings or JSON lists into a cleaned list of extensions."""
        if isinstance(v, str):
            v_trimmed = v.strip()
            if v_trimmed.startswith("[") and v_trimmed.endswith("]"):
                try:
                    parsed = json.loads(v_trimmed)
                    if isinstance(parsed, list):
                        return [str(ext).strip().lower() for ext in parsed if str(ext).strip()]
                except Exception:
                    pass
            return [ext.strip().lower() for ext in v_trimmed.split(",") if ext.strip()]
        elif isinstance(v, list):
            return [str(ext).strip().lower() for ext in v if str(ext).strip()]
        return [".pdf", ".txt", ".md"]

    @property
    def is_production(self) -> bool:
        """Helper to determine if the service is running in production."""
        return self.ENVIRONMENT.lower() == "production"


@lru_cache()
def get_settings() -> Settings:
    """Dependency provider for cached application settings.

    Returns:
        Settings: Singleton instance of validated application settings.
    """
    return Settings()
