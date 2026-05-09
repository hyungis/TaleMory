from fastapi import APIRouter, HTTPException

from app.schemas.storyboard_image import (
    StoryboardCharacterReferenceGenerateRequest,
    StoryboardCharacterReferenceGenerateResponse,
    StoryboardImageGenerateRequest,
    StoryboardImageGenerateResponse,
    StoryboardImageRegenerateRequest,
    StoryboardImageRegenerateResponse,
)
from app.services.storyboard_image_service import (
    generate_storyboard_character_reference,
    generate_storyboard_images,
    generate_webtoon_storyboard_images,
    regenerate_storyboard_image,
    regenerate_webtoon_storyboard_image,
)


router = APIRouter(prefix="/internal/storyboard-images", tags=["storyboard-images"])


@router.post("/character-reference", response_model=StoryboardCharacterReferenceGenerateResponse)
def generate_storyboard_character_reference_endpoint(
    request: StoryboardCharacterReferenceGenerateRequest,
) -> StoryboardCharacterReferenceGenerateResponse:
    try:
        return generate_storyboard_character_reference(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/generate", response_model=StoryboardImageGenerateResponse)
def generate_storyboard_images_endpoint(
    request: StoryboardImageGenerateRequest,
) -> StoryboardImageGenerateResponse:
    try:
        return generate_storyboard_images(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/generate-webtoon", response_model=StoryboardImageGenerateResponse)
def generate_webtoon_storyboard_images_endpoint(
    request: StoryboardImageGenerateRequest,
) -> StoryboardImageGenerateResponse:
    try:
        return generate_webtoon_storyboard_images(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/regenerate", response_model=StoryboardImageRegenerateResponse)
def regenerate_storyboard_image_endpoint(
    request: StoryboardImageRegenerateRequest,
) -> StoryboardImageRegenerateResponse:
    try:
        return regenerate_storyboard_image(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/regenerate-webtoon", response_model=StoryboardImageRegenerateResponse)
def regenerate_webtoon_storyboard_image_endpoint(
    request: StoryboardImageRegenerateRequest,
) -> StoryboardImageRegenerateResponse:
    try:
        return regenerate_webtoon_storyboard_image(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
