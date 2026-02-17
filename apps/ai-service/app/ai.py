"""Core AI generation logic using OpenAI."""

import json
from typing import Optional
from openai import AsyncOpenAI
from app.config import get_settings
from app.models import (
    PLATFORM_CHAR_LIMITS,
    GenerateCaptionRequest, GeneratedCaption,
    GenerateHashtagsRequest, GeneratedHashtags,
    GenerateImagePromptRequest, GeneratedImagePrompt,
    RewriteRequest, RewriteResult,
    TranslateRequest, TranslateResult,
    ComplianceCheckRequest, ComplianceResult,
    BestTimesRequest, BestTimesResult,
    TrendingTopicsRequest, TrendingTopicsResult,
)

_client: Optional[AsyncOpenAI] = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        settings = get_settings()
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def _chat(system: str, user: str, json_mode: bool = True) -> str:
    settings = get_settings()
    client = _get_client()
    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"} if json_mode else None,
        temperature=0.7,
        max_tokens=1500,
    )
    return response.choices[0].message.content or ""


async def generate_caption(req: GenerateCaptionRequest) -> GeneratedCaption:
    limit = req.max_length or PLATFORM_CHAR_LIMITS.get(req.platform.value, 2200)

    system = f"""You are an expert social media copywriter. Generate a single engaging {req.platform.value} caption.
Rules:
- Tone: {req.tone.value}
- Max {limit} characters (STRICT)
- {"Include relevant emojis" if req.include_emoji else "No emojis"}
- {"End with a clear call-to-action" if req.include_cta else ""}
- {f"Brand voice: {req.brand_voice}" if req.brand_voice else ""}
- {f"Industry: {req.industry}" if req.industry else ""}
- {f"Target audience: {req.audience}" if req.audience else ""}
- Language: {req.language}

Respond in JSON: {{"caption": "...", "hashtags": ["..."], "cta": "..." or null}}"""

    user = f"Write a {req.platform.value} caption about: {req.topic}"
    raw = await _chat(system, user)
    data = json.loads(raw)

    return GeneratedCaption(
        caption=data.get("caption", ""),
        character_count=len(data.get("caption", "")),
        platform_limit=limit,
        hashtags=data.get("hashtags", []),
        cta=data.get("cta"),
    )


async def generate_hashtags(req: GenerateHashtagsRequest) -> GeneratedHashtags:
    system = f"""You are a social media hashtag strategist. Generate {req.count} hashtags for {req.platform.value}.
Rules:
- Mix of high-volume and niche-specific hashtags
- {"Include currently trending hashtags" if req.include_trending else ""}
- {"Focus on niche-specific, less competitive hashtags" if req.niche_specific else ""}
- No # prefix in output

Respond in JSON: {{"hashtags": ["..."], "trending": ["..."], "niche": ["..."]}}"""

    user = f"Generate hashtags for: {req.topic}"
    raw = await _chat(system, user)
    data = json.loads(raw)

    return GeneratedHashtags(
        hashtags=data.get("hashtags", []),
        trending=data.get("trending", []),
        niche=data.get("niche", []),
    )


async def generate_image_prompt(req: GenerateImagePromptRequest) -> GeneratedImagePrompt:
    system = f"""You are an expert AI image prompt engineer. Create a detailed DALL-E prompt for a {req.platform.value} post image.
Rules:
- Style: {req.style}
- {"Aspect ratio: " + req.aspect_ratio if req.aspect_ratio else "Default aspect ratio for platform"}
- Professional, high-quality, suitable for social media
- Be specific about composition, lighting, colors, mood

Respond in JSON: {{"prompt": "...", "negative_prompt": "...", "suggested_style": "..."}}"""

    user = f"Create an image prompt for: {req.topic}"
    raw = await _chat(system, user)
    data = json.loads(raw)

    return GeneratedImagePrompt(
        prompt=data.get("prompt", ""),
        negative_prompt=data.get("negative_prompt", ""),
        suggested_style=data.get("suggested_style", ""),
    )


async def rewrite_content(req: RewriteRequest) -> RewriteResult:
    limit = PLATFORM_CHAR_LIMITS.get(req.platform.value, 2200)

    system = f"""You are a social media copy editor. Rewrite the given content.
Rules:
- Tone: {req.tone.value}
- Platform: {req.platform.value} (max {limit} chars)
- {f"Instruction: {req.instruction}" if req.instruction else "Improve clarity, engagement, and impact"}
- Keep the core message intact

Respond in JSON: {{"rewritten": "...", "changes_summary": "..."}}"""

    user = f"Rewrite this:\n{req.content}"
    raw = await _chat(system, user)
    data = json.loads(raw)

    rewritten = data.get("rewritten", "")
    return RewriteResult(
        original=req.content,
        rewritten=rewritten,
        character_count=len(rewritten),
        changes_summary=data.get("changes_summary", ""),
    )


async def translate_content(req: TranslateRequest) -> TranslateResult:
    system = f"""You are a professional translator specializing in social media content.
Rules:
- Translate to: {req.target_language}
- Platform: {req.platform.value}
- {"Adapt for cultural nuance and local expressions" if req.adapt_culturally else "Direct translation only"}
- Preserve hashtags (translate if applicable)
- Keep emojis and formatting

Respond in JSON: {{"translated": "...", "cultural_notes": "..." or null}}"""

    user = f"Translate this:\n{req.content}"
    raw = await _chat(system, user)
    data = json.loads(raw)

    return TranslateResult(
        original=req.content,
        translated=data.get("translated", ""),
        target_language=req.target_language,
        cultural_notes=data.get("cultural_notes"),
    )


async def check_compliance(req: ComplianceCheckRequest) -> ComplianceResult:
    system = f"""You are a social media compliance checker. Analyze content for potential issues on {req.platform.value}.
Check for:
- Hate speech or discrimination
- Misleading claims
- Platform-specific policy violations
- Copyright concerns
- Inappropriate language for professional context
- Spam indicators

Respond in JSON: {{"is_safe": true/false, "score": 0.0-1.0, "issues": ["..."], "suggestions": ["..."]}}
Score: 0 = perfectly safe, 1 = highly problematic"""

    user = f"Check this content:\n{req.content}"
    raw = await _chat(system, user)
    data = json.loads(raw)

    return ComplianceResult(
        is_safe=data.get("is_safe", True),
        score=data.get("score", 0.0),
        issues=data.get("issues", []),
        suggestions=data.get("suggestions", []),
    )


async def suggest_best_times(req: BestTimesRequest) -> BestTimesResult:
    system = f"""You are a social media analytics expert. Suggest the best posting times for {req.platform.value}.
Rules:
- Timezone: {req.timezone}
- {f"Industry: {req.industry}" if req.industry else "General audience"}
- Provide 7 slots (one per day of the week)
- Base on general engagement data patterns

Respond in JSON: {{"times": [{{"day": "Monday", "time": "09:00", "score": 0.95, "reason": "..."}}, ...]}}"""

    user = f"Best posting times for {req.platform.value}" + (f" in {req.industry}" if req.industry else "")
    raw = await _chat(system, user)
    data = json.loads(raw)

    return BestTimesResult(
        platform=req.platform.value,
        times=data.get("times", []),
        timezone=req.timezone,
    )


async def suggest_trending_topics(req: TrendingTopicsRequest) -> TrendingTopicsResult:
    system = f"""You are a social media trend analyst. Suggest {req.count} trending or high-performing content topics for {req.platform.value}.
Rules:
- {f"Industry focus: {req.industry}" if req.industry else "General trending topics"}
- Include relevance score (0-1)
- Include suggested hashtags per topic
- Mix evergreen + timely topics

Respond in JSON: {{"topics": [{{"topic": "...", "relevance": 0.9, "hashtags": ["..."], "content_idea": "..."}}, ...]}}"""

    user = f"Trending topics for {req.platform.value}" + (f" in {req.industry}" if req.industry else "")
    raw = await _chat(system, user)
    data = json.loads(raw)

    return TrendingTopicsResult(topics=data.get("topics", []))
