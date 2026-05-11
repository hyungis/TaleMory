from fastapi import APIRouter, HTTPException

from app.schemas.final_illustration import (
    FinalIllustrationLayoutAnalysisRequest,
    FinalIllustrationLayoutAnalysisResponse,
    FinalIllustrationGenerateRequest,
    FinalIllustrationGenerateResponse,
    FinalIllustrationReviseRequest,
    FinalIllustrationReviseResponse,
)
from app.services.final_illustration_layout_service import analyze_final_illustration_layout
from app.services.final_illustration_service import (
    generate_final_illustrations,
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


@router.post("/analyze-layout", response_model=FinalIllustrationLayoutAnalysisResponse)
def analyze_final_illustration_layout_endpoint(
    request: FinalIllustrationLayoutAnalysisRequest,
) -> FinalIllustrationLayoutAnalysisResponse:
    try:
        return analyze_final_illustration_layout(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
