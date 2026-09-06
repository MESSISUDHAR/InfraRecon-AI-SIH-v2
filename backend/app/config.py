import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "InfraRecon AI"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Database
    DATABASE_URL: str = "sqlite:///./infra_recon.db"

    # LLM Settings (Server-Side Only)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Embeddings
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"

    # Reconciliation Engine Default Weights
    WEIGHT_SEMANTIC: float = 0.40
    WEIGHT_IDENTIFIER: float = 0.20
    WEIGHT_DISCIPLINE: float = 0.15
    WEIGHT_LOCATION: float = 0.10
    WEIGHT_WBS: float = 0.10
    WEIGHT_TEMPORAL: float = 0.05

    # Confidence Thresholds
    THRESHOLD_HIGH_CONFIDENCE: float = 0.85
    THRESHOLD_MEDIUM_CONFIDENCE: float = 0.60

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(env_file=".env", extra="allow")

settings = Settings()
