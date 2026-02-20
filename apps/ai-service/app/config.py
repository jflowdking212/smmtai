"""Application configuration from environment variables."""

from functools import lru_cache
import os
from pathlib import Path
from dotenv import dotenv_values
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
ENV_FILE_CANDIDATES = [
    ENV_FILE,
    Path(__file__).resolve().parents[2] / ".env",
    Path(__file__).resolve().parents[3] / ".env",
]


def _load_env_fallbacks() -> None:
    for env_file in ENV_FILE_CANDIDATES:
        if not env_file.exists():
            continue

        parsed = dotenv_values(env_file)
        for key, value in parsed.items():
            if value is None:
                continue
            if os.getenv(key) in (None, ""):
                os.environ[key] = value


_load_env_fallbacks()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Internal API auth
    ai_service_key: str = "dev-key"

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_image_model: str = "dall-e-3"

    # Redis
    redis_url: str = "redis://localhost:6379/1"

    # Rate limits (per-tier max AI generations/month)
    tier_limits: dict[str, int] = {
        "free": 10,
        "pro": 100,
        "business": 500,
        "enterprise": 999999,
    }

    # Cache TTL in seconds (1 hour)
    cache_ttl: int = 3600

    # CORS
    allowed_origins: list[str] = [
        "http://localhost:3016",
        "http://localhost:5173",
        "http://localhost:4016",
        "https://smmt.entreprenreducation.com",
    ]

@lru_cache
def get_settings() -> Settings:
    return Settings()
