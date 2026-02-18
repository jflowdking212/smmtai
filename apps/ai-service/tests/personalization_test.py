import json
import unittest
from unittest.mock import AsyncMock, patch

from app import ai
from app.models import (
    BrandVoiceProfile,
    GenerateCaptionRequest,
    GenerateHashtagsRequest,
    Platform,
    Tone,
    TrendingTopicsRequest,
)


class AIPersonalizationPromptTests(unittest.IsolatedAsyncioTestCase):
    async def test_generate_caption_includes_brand_voice_profile_industry_and_audience(self):
        req = GenerateCaptionRequest(
            topic="Launching our new analytics suite",
            platform=Platform.linkedin,
            tone=Tone.professional,
            brand_voice_profile=BrandVoiceProfile.witty,
            brand_voice="Confident and practical",
            industry="SaaS",
            audience_persona="Startup founders",
            include_cta=True,
        )

        chat_mock = AsyncMock(
            return_value=json.dumps(
                {
                    "caption": "Launch day update",
                    "hashtags": ["SaaS", "Growth"],
                    "cta": "Book a demo",
                }
            )
        )

        with patch("app.ai._chat", chat_mock):
            result = await ai.generate_caption(req)

        self.assertEqual(result.caption, "Launch day update")
        self.assertEqual(result.cta, "Book a demo")
        system_prompt = chat_mock.await_args.args[0]
        self.assertIn("Brand voice profile: witty", system_prompt)
        self.assertIn("Brand voice details: Confident and practical", system_prompt)
        self.assertIn("Industry context: SaaS", system_prompt)
        self.assertIn("Audience persona: Startup founders", system_prompt)

    async def test_generate_hashtags_includes_industry_and_audience_persona_context(self):
        req = GenerateHashtagsRequest(
            topic="Cloud security updates",
            platform=Platform.twitter,
            count=5,
            industry="Cybersecurity",
            audience_persona="CTOs at mid-market companies",
        )

        chat_mock = AsyncMock(
            return_value=json.dumps(
                {
                    "hashtags": ["CyberSecurity", "CloudSecurity"],
                    "trending": ["ZeroTrust"],
                    "niche": ["SOC2Readiness"],
                }
            )
        )

        with patch("app.ai._chat", chat_mock):
            result = await ai.generate_hashtags(req)

        self.assertIn("CloudSecurity", result.hashtags)
        system_prompt = chat_mock.await_args.args[0]
        self.assertIn("Industry context: Cybersecurity", system_prompt)
        self.assertIn("Audience persona: CTOs at mid-market companies", system_prompt)

    async def test_trending_topics_targets_audience_persona_in_prompt(self):
        req = TrendingTopicsRequest(
            platform=Platform.facebook,
            count=3,
            industry="E-commerce",
            audience_persona="First-time online store owners",
        )

        chat_mock = AsyncMock(
            return_value=json.dumps(
                {
                    "topics": [
                        {"topic": "Shipping transparency", "relevance": 0.92, "hashtags": ["shipping"], "content_idea": "Share fulfillment timeline tips"},
                    ]
                }
            )
        )

        with patch("app.ai._chat", chat_mock):
            result = await ai.suggest_trending_topics(req)

        self.assertEqual(len(result.topics), 1)
        system_prompt = chat_mock.await_args.args[0]
        user_prompt = chat_mock.await_args.args[1]
        self.assertIn("Audience persona: First-time online store owners", system_prompt)
        self.assertIn("targeting First-time online store owners", user_prompt)


if __name__ == "__main__":
    unittest.main()
