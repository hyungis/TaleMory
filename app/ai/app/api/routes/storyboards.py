from fastapi import APIRouter, HTTPException

from app.schemas.storyboard import StoryboardGenerateRequest, StoryboardGenerateResponse
from app.services.storyboard_service import generate_storyboard


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
