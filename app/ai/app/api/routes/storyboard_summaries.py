from fastapi import APIRouter, HTTPException

from app.schemas.storyboard_summary import (
    StoryboardSummaryGenerateRequest,
    StoryboardSummaryGenerateResponse,
    StoryboardSummaryRegenerateRequest,
)
from app.services.storyboard_summary_service import (
    generate_storyboard_summary,
    regenerate_storyboard_summary,
)


router = APIRouter(prefix="/internal/storyboard-summaries", tags=["storyboard-summaries"])


@router.post("/generate", response_model=StoryboardSummaryGenerateResponse)
def generate_storyboard_summary_endpoint(
    request: StoryboardSummaryGenerateRequest,
) -> StoryboardSummaryGenerateResponse:
    try:
        return generate_storyboard_summary(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/regenerate", response_model=StoryboardSummaryGenerateResponse)
def regenerate_storyboard_summary_endpoint(
    request: StoryboardSummaryRegenerateRequest,
) -> StoryboardSummaryGenerateResponse:
    try:
        return regenerate_storyboard_summary(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
