"""Application configuration from environment variables."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
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
        "http://localhost:5173",
        "http://localhost:4000",
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
