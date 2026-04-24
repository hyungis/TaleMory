from fastapi import APIRouter

from app.api.routes import health, root, storyboards


api_router = APIRouter()
api_router.include_router(root.router)
api_router.include_router(health.router)
api_router.include_router(storyboards.router)
