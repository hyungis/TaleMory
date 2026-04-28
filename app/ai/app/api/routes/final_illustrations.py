from fastapi import APIRouter, HTTPException

from app.schemas.final_illustration import (
    FinalIllustrationGenerateRequest,
    FinalIllustrationGenerateResponse,
    FinalIllustrationRegenerateRequest,
    FinalIllustrationRegenerateResponse,
    FinalIllustrationReviseRequest,
    FinalIllustrationReviseResponse,
)
from app.services.final_illustration_service import (
    generate_final_illustrations,
    regenerate_final_illustration,
    revise_final_illustration,
)


router = APIRouter(prefix="/internal/final-illustrations", tags=["final-illustrations"])


@router.post("/generate", response_model=FinalIllustrationGenerateResponse)
def generate_final_illustrations_endpoint(
    request: FinalIllustrationGenerateRequest,
) -> FinalIllustrationGenerateResponse:
    try:
        return generate_final_illustrations(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/regenerate", response_model=FinalIllustrationRegenerateResponse)
def regenerate_final_illustration_endpoint(
    request: FinalIllustrationRegenerateRequest,
) -> FinalIllustrationRegenerateResponse:
    try:
        return regenerate_final_illustration(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/revise", response_model=FinalIllustrationReviseResponse)
def revise_final_illustration_endpoint(
    request: FinalIllustrationReviseRequest,
) -> FinalIllustrationReviseResponse:
    try:
        return revise_final_illustration(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
