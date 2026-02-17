"""EE PostMind — AI Microservice"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routes import router as ai_router

settings = get_settings()

app = FastAPI(
    title="EE PostMind AI Service",
    version="0.1.0",
    description="AI-powered content generation for EE PostMind",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_router)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ai-service", "version": "0.1.0"}
