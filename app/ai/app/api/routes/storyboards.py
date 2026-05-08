from fastapi import APIRouter, HTTPException

from app.schemas.storyboard import (
    StoryboardGenerateRequest,
    StoryboardGenerateResponse,
    StoryboardRegenerateRequest,
    WebtoonStoryboardGenerateResponse,
)
from app.services.storyboard_service import generate_storyboard, generate_webtoon_storyboard, regenerate_storyboard


router = APIRouter(prefix="/internal/storyboards", tags=["storyboards"])


@router.post("/generate", response_model=StoryboardGenerateResponse)
def generate_storyboard_endpoint(
    request: StoryboardGenerateRequest,
) -> StoryboardGenerateResponse:
    try:
        return generate_storyboard(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/generate-webtoon", response_model=WebtoonStoryboardGenerateResponse)
def generate_webtoon_storyboard_endpoint(
    request: StoryboardGenerateRequest,
) -> WebtoonStoryboardGenerateResponse:
    try:
        return generate_webtoon_storyboard(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/regenerate", response_model=StoryboardGenerateResponse)
def regenerate_storyboard_endpoint(
    request: StoryboardRegenerateRequest,
) -> StoryboardGenerateResponse:
    try:
        return regenerate_storyboard(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
