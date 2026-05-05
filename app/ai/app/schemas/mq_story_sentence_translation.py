from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.mq_storyboard import StoryError
from app.schemas.storyboard import (
    StorySentenceTranslationRequest,
    StorySentenceTranslationResponse,
)


StorySentenceTranslationJobType = Literal["STORY_SENTENCE_TRANSLATION"]
StorySentenceTranslationSuccessType = Literal["TRANSLATE_STORY_SENTENCES_COMPLETED"]
StorySentenceTranslationFailureType = Literal["TRANSLATE_STORY_SENTENCES_FAILED"]


class StorySentenceTranslationJobMessage(BaseModel):
    jobId: str = Field(..., min_length=1)
    jobType: StorySentenceTranslationJobType = "STORY_SENTENCE_TRANSLATION"
    storyId: int | None = Field(default=None, ge=1)
    pageNumber: int | None = Field(default=None, ge=1)
    payload: StorySentenceTranslationRequest


class StorySentenceTranslationSuccessEnvelope(BaseModel):
    jobId: str
    type: StorySentenceTranslationSuccessType = "TRANSLATE_STORY_SENTENCES_COMPLETED"
    storyId: int | None = None
    pageNumber: int | None = None
    status: Literal["COMPLETED"] = "COMPLETED"
    payload: StorySentenceTranslationResponse


class StorySentenceTranslationFailureEnvelope(BaseModel):
    jobId: str
    type: StorySentenceTranslationFailureType = "TRANSLATE_STORY_SENTENCES_FAILED"
    storyId: int | None = None
    pageNumber: int | None = None
    status: Literal["FAILED"] = "FAILED"
    error: StoryError
