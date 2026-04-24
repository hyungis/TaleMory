from fastapi import APIRouter, HTTPException

from app.schemas.storyboard_image import StoryboardImageGenerateRequest, StoryboardImageGenerateResponse
from app.services.storyboard_image_service import generate_storyboard_images


router = APIRouter(prefix="/internal/storyboard-images", tags=["storyboard-images"])


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
