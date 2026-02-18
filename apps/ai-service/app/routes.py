"""AI generation API routes."""

import hmac
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from app.models import (
    GenerateCaptionRequest, GeneratedCaption,
    GenerateHashtagsRequest, GeneratedHashtags,
    GenerateImagePromptRequest, GeneratedImagePrompt,
    RewriteRequest, RewriteResult,
    TranslateRequest, TranslateResult,
    ComplianceCheckRequest, ComplianceResult,
    BestTimesRequest, BestTimesResult,
    TrendingTopicsRequest, TrendingTopicsResult,
)
from app import ai
from app.config import get_settings
from app.cache import get_cached, set_cached

router = APIRouter(prefix="/api/v1/ai", tags=["AI"])


async def _verify_api_key(x_api_key: Optional[str] = Header(None)):
    """Simple internal API key check (called from Node.js API)."""
    expected_key = get_settings().ai_service_key
    if not x_api_key or not hmac.compare_digest(x_api_key, expected_key):
        raise HTTPException(status_code=401, detail="Invalid API key")


@router.post("/caption", response_model=GeneratedCaption)
async def generate_caption(req: GenerateCaptionRequest, x_api_key: Optional[str] = Header(None)):
    await _verify_api_key(x_api_key)

    cache_data = req.model_dump()
    cached = await get_cached("caption", cache_data)
    if cached:
        return GeneratedCaption(**cached)

    result = await ai.generate_caption(req)
    await set_cached("caption", cache_data, result.model_dump())
    return result


@router.post("/hashtags", response_model=GeneratedHashtags)
async def generate_hashtags(req: GenerateHashtagsRequest, x_api_key: Optional[str] = Header(None)):
    await _verify_api_key(x_api_key)

    cache_data = req.model_dump()
    cached = await get_cached("hashtags", cache_data)
    if cached:
        return GeneratedHashtags(**cached)

    result = await ai.generate_hashtags(req)
    await set_cached("hashtags", cache_data, result.model_dump())
    return result


@router.post("/image-prompt", response_model=GeneratedImagePrompt)
async def generate_image_prompt(req: GenerateImagePromptRequest, x_api_key: Optional[str] = Header(None)):
    await _verify_api_key(x_api_key)

    result = await ai.generate_image_prompt(req)
    return result


@router.post("/rewrite", response_model=RewriteResult)
async def rewrite_content(req: RewriteRequest, x_api_key: Optional[str] = Header(None)):
    await _verify_api_key(x_api_key)

    result = await ai.rewrite_content(req)
    return result


@router.post("/translate", response_model=TranslateResult)
async def translate_content(req: TranslateRequest, x_api_key: Optional[str] = Header(None)):
    await _verify_api_key(x_api_key)

    result = await ai.translate_content(req)
    return result


@router.post("/compliance", response_model=ComplianceResult)
async def check_compliance(req: ComplianceCheckRequest, x_api_key: Optional[str] = Header(None)):
    await _verify_api_key(x_api_key)

    result = await ai.check_compliance(req)
    return result


@router.post("/best-times", response_model=BestTimesResult)
async def best_times(req: BestTimesRequest, x_api_key: Optional[str] = Header(None)):
    await _verify_api_key(x_api_key)

    cache_data = req.model_dump()
    cached = await get_cached("best-times", cache_data)
    if cached:
        return BestTimesResult(**cached)

    result = await ai.suggest_best_times(req)
    await set_cached("best-times", cache_data, result.model_dump(), ttl=86400)
    return result


@router.post("/trending", response_model=TrendingTopicsResult)
async def trending_topics(req: TrendingTopicsRequest, x_api_key: Optional[str] = Header(None)):
    await _verify_api_key(x_api_key)

    cache_data = req.model_dump()
    cached = await get_cached("trending", cache_data)
    if cached:
        return TrendingTopicsResult(**cached)

    result = await ai.suggest_trending_topics(req)
    await set_cached("trending", cache_data, result.model_dump(), ttl=3600)
    return result
