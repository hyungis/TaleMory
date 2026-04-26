from fastapi import APIRouter

from app.api.routes import final_illustrations, health, root, storyboard_images, storyboards


api_router = APIRouter()
api_router.include_router(root.router)
api_router.include_router(health.router)
api_router.include_router(storyboards.router)
api_router.include_router(storyboard_images.router)
api_router.include_router(final_illustrations.router)
