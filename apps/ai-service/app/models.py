"""Pydantic models for request/response validation."""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class Tone(str, Enum):
    professional = "professional"
    casual = "casual"
    witty = "witty"
    formal = "formal"
    inspirational = "inspirational"
    educational = "educational"
    persuasive = "persuasive"


class BrandVoiceProfile(str, Enum):
    formal = "formal"
    casual = "casual"
    witty = "witty"
    professional = "professional"


class Platform(str, Enum):
    facebook = "facebook"
    instagram = "instagram"
    tiktok = "tiktok"
    linkedin = "linkedin"
    twitter = "twitter"
    youtube = "youtube"
    pinterest = "pinterest"
    bluesky = "bluesky"
    mastodon = "mastodon"
    telegram = "telegram"
    entreprenrs = "entreprenrs"
    chrxstians = "chrxstians"
    iohah = "iohah"


PLATFORM_CHAR_LIMITS = {
    "twitter": 280,
    "linkedin": 3000,
    "facebook": 63206,
    "instagram": 2200,
    "tiktok": 2200,
    "youtube": 5000,
    "pinterest": 500,
    "bluesky": 300,
    "mastodon": 500,
    "telegram": 4096,
    "entreprenrs": 5000,
    "chrxstians": 5000,
    "iohah": 5000,
}


# --- Requests ---

class GenerateCaptionRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=500, description="Topic or brief for the caption")
    platform: Platform
    tone: Tone = Tone.professional
    language: str = Field(default="en", max_length=10)
    max_length: Optional[int] = Field(default=None, description="Override max character length")
    brand_voice_profile: Optional[BrandVoiceProfile] = Field(default=None, description="Preset brand voice profile")
    brand_voice: Optional[str] = Field(default=None, max_length=500, description="Brand voice description")
    industry: Optional[str] = Field(default=None, max_length=100)
    audience: Optional[str] = Field(default=None, max_length=200)
    audience_persona: Optional[str] = Field(default=None, max_length=200)
    include_cta: bool = Field(default=False, description="Include a call-to-action")
    include_emoji: bool = Field(default=True)


class GenerateHashtagsRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=500)
    platform: Platform
    count: int = Field(default=15, ge=1, le=30)
    industry: Optional[str] = Field(default=None, max_length=100)
    audience_persona: Optional[str] = Field(default=None, max_length=200)
    include_trending: bool = True
    niche_specific: bool = True


class GenerateImagePromptRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=500)
    style: str = Field(default="modern, clean, professional", max_length=200)
    platform: Platform
    aspect_ratio: Optional[str] = Field(default=None, description="e.g. '1:1', '16:9', '9:16'")


class RewriteRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    tone: Tone = Tone.professional
    platform: Platform
    instruction: Optional[str] = Field(default=None, max_length=500, description="Specific rewrite instruction")


class TranslateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    target_language: str = Field(..., min_length=2, max_length=50)
    platform: Platform
    adapt_culturally: bool = Field(default=True, description="Adapt for cultural nuance")


class ComplianceCheckRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    platform: Platform


class BestTimesRequest(BaseModel):
    platform: Platform
    industry: Optional[str] = None
    timezone: str = Field(default="UTC")


class TrendingTopicsRequest(BaseModel):
    industry: Optional[str] = None
    audience_persona: Optional[str] = Field(default=None, max_length=200)
    platform: Platform
    count: int = Field(default=10, ge=1, le=25)


# --- Responses ---

class GeneratedCaption(BaseModel):
    caption: str
    character_count: int
    platform_limit: int
    hashtags: list[str] = []
    cta: Optional[str] = None


class GeneratedHashtags(BaseModel):
    hashtags: list[str]
    trending: list[str] = []
    niche: list[str] = []


class GeneratedImagePrompt(BaseModel):
    prompt: str
    negative_prompt: str = ""
    suggested_style: str = ""


class RewriteResult(BaseModel):
    original: str
    rewritten: str
    character_count: int
    changes_summary: str


class TranslateResult(BaseModel):
    original: str
    translated: str
    target_language: str
    cultural_notes: Optional[str] = None


class ComplianceResult(BaseModel):
    is_safe: bool
    score: float = Field(ge=0, le=1, description="0 = safe, 1 = highly problematic")
    issues: list[str] = []
    suggestions: list[str] = []


class BestTimesResult(BaseModel):
    platform: str
    times: list[dict]  # [{day: "Monday", time: "09:00", score: 0.95}, ...]
    timezone: str


class TrendingTopicsResult(BaseModel):
    topics: list[dict]  # [{topic: "...", relevance: 0.9, hashtags: [...]}, ...]
