from fastapi import APIRouter

from app.api.routes import health, root, storyboards, tts
from app.api.routes import health, root, storyboard_images, storyboards


api_router = APIRouter()
api_router.include_router(root.router)
api_router.include_router(health.router)
api_router.include_router(tts.router)
api_router.include_router(storyboards.router)
api_router.include_router(storyboard_images.router)
