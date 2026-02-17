"""EE PostMind — AI Microservice"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="EE PostMind AI Service",
    version="0.1.0",
    description="AI-powered content generation for EE PostMind",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ai-service", "version": "0.1.0"}


# AI endpoints will be added in Milestone 5
