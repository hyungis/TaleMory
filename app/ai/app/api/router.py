from fastapi import APIRouter

from app.api.routes import health, root, storyboard_images, storyboard_summaries, storyboards, tts, final_illustrations

api_router = APIRouter()
api_router.include_router(root.router)
api_router.include_router(health.router)
api_router.include_router(tts.router)
api_router.include_router(storyboards.router)
api_router.include_router(storyboard_summaries.router)
api_router.include_router(storyboard_images.router)
api_router.include_router(final_illustrations.router)
