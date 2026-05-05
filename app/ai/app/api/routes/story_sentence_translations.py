from fastapi import APIRouter, HTTPException

from app.schemas.storyboard import (
    StorySentenceTranslationRequest,
    StorySentenceTranslationResponse,
)
from app.services.story_sentence_translation_service import translate_story_sentences


router = APIRouter(prefix="/internal/storyboards", tags=["storyboards"])


@router.post("/sentences/translate", response_model=StorySentenceTranslationResponse)
def translate_story_sentences_endpoint(
    request: StorySentenceTranslationRequest,
) -> StorySentenceTranslationResponse:
    try:
        return translate_story_sentences(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
