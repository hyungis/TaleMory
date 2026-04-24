from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.storyboard import (
    StoryboardGenerateRequest,
    StoryboardGenerateResponse,
    StoryboardRegenerateRequest,
)


StoryJobType = Literal["STORY"]
StoryEventStatus = Literal["COMPLETED", "FAILED"]
StorySuccessType = Literal["GENERATE_STORY_COMPLETED", "REGENERATE_STORY_COMPLETED"]
StoryFailureType = Literal["GENERATE_STORY_FAILED", "REGENERATE_STORY_FAILED"]


class StoryGenerateJobMessage(BaseModel):
    jobId: str = Field(..., min_length=1)
    jobType: StoryJobType = "STORY"
    storyId: int | None = Field(default=None, ge=1)
    payload: StoryboardGenerateRequest


class StoryRegenerateJobMessage(BaseModel):
    jobId: str = Field(..., min_length=1)
    jobType: StoryJobType = "STORY"
    storyId: int | None = Field(default=None, ge=1)
    payload: StoryboardRegenerateRequest


class StoryError(BaseModel):
    code: str
    message: str


class StorySuccessEnvelope(BaseModel):
    jobId: str
    type: StorySuccessType
    storyId: int | None = None
    status: Literal["COMPLETED"] = "COMPLETED"
    payload: StoryboardGenerateResponse


class StoryFailureEnvelope(BaseModel):
    jobId: str
    type: StoryFailureType
    storyId: int | None = None
    status: Literal["FAILED"] = "FAILED"
    error: StoryError
