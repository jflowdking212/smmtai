"""Redis caching layer for AI responses."""

import json
import hashlib
from typing import Optional, Any
import redis.asyncio as redis
from app.config import get_settings


_redis_client: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


def _cache_key(prefix: str, data: dict) -> str:
    """Generate deterministic cache key from request data."""
    raw = json.dumps(data, sort_keys=True)
    h = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"ai:{prefix}:{h}"


async def get_cached(prefix: str, data: dict) -> Optional[Any]:
    try:
        r = await get_redis()
        key = _cache_key(prefix, data)
        val = await r.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


async def set_cached(prefix: str, data: dict, result: Any, ttl: Optional[int] = None):
    try:
        settings = get_settings()
        r = await get_redis()
        key = _cache_key(prefix, data)
        await r.set(key, json.dumps(result), ex=ttl or settings.cache_ttl)
    except Exception:
        pass  # Cache failures should not break requests
