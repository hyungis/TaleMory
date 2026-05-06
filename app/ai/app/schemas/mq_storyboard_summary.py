from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.mq_storyboard import StoryError
from app.schemas.storyboard_summary import (
    StoryboardSummaryGenerateRequest,
    StoryboardSummaryGenerateResponse,
    StoryboardSummaryRegenerateRequest,
)


StorySummaryJobType = Literal["STORY_SUMMARY", "STORY_SUMMARY_REGENERATE"]
StorySummaryEventStatus = Literal["COMPLETED", "FAILED"]
StorySummarySuccessType = Literal[
    "GENERATE_STORY_SUMMARY_COMPLETED",
    "REGENERATE_STORY_SUMMARY_COMPLETED",
]
StorySummaryFailureType = Literal[
    "GENERATE_STORY_SUMMARY_FAILED",
    "REGENERATE_STORY_SUMMARY_FAILED",
]


class StorySummaryGenerateJobMessage(BaseModel):
    jobId: str = Field(..., min_length=1)
    jobType: StorySummaryJobType = "STORY_SUMMARY"
    storyId: int | None = Field(default=None, ge=1)
    payload: StoryboardSummaryGenerateRequest


class StorySummaryRegenerateJobMessage(BaseModel):
    jobId: str = Field(..., min_length=1)
    jobType: StorySummaryJobType = "STORY_SUMMARY_REGENERATE"
    storyId: int | None = Field(default=None, ge=1)
    payload: StoryboardSummaryRegenerateRequest


class StorySummarySuccessEnvelope(BaseModel):
    jobId: str
    type: StorySummarySuccessType = "GENERATE_STORY_SUMMARY_COMPLETED"
    storyId: int | None = None
    status: Literal["COMPLETED"] = "COMPLETED"
    payload: StoryboardSummaryGenerateResponse


class StorySummaryFailureEnvelope(BaseModel):
    jobId: str
    type: StorySummaryFailureType = "GENERATE_STORY_SUMMARY_FAILED"
    storyId: int | None = None
    status: Literal["FAILED"] = "FAILED"
    error: StoryError
