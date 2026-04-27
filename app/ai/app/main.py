from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings


def create_app() -> FastAPI:
    settings.TTS_STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    settings.TTS_MANIFEST_ROOT.mkdir(parents=True, exist_ok=True)

    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.mount(settings.TTS_PUBLIC_BASE_URL, StaticFiles(directory=settings.TTS_STORAGE_ROOT), name="static")
    application.include_router(api_router)
    return application


app = create_app()
