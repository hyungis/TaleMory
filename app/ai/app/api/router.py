from fastapi import APIRouter

from app.api.routes import (
    final_illustrations,
    health,
    root,
    story_sentence_translations,
    storyboard_images,
    storyboard_summaries,
    storyboards,
    tts,
)

api_router = APIRouter()
api_router.include_router(root.router)
api_router.include_router(health.router)
api_router.include_router(tts.router)
api_router.include_router(storyboards.router)
api_router.include_router(story_sentence_translations.router)
api_router.include_router(storyboard_summaries.router)
api_router.include_router(storyboard_images.router)
api_router.include_router(final_illustrations.router)
