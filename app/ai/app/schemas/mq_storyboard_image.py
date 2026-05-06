from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.storyboard_image import (
    StoryboardImageGenerateItemRequest,
    StoryboardImageGenerateResult,
    StoryboardImageGenerateRequest,
    StoryboardImageRegenerateRequest,
)


StoryboardImageJobType = Literal["STORYBOARD_IMAGE"]
StoryboardImageEventStatus = Literal["COMPLETED", "FAILED"]
StoryboardImageSuccessType = Literal[
    "GENERATE_STORYBOARD_IMAGE_COMPLETED",
    "REGENERATE_STORYBOARD_IMAGE_COMPLETED",
]
StoryboardImageFailureType = Literal[
    "GENERATE_STORYBOARD_IMAGE_FAILED",
    "REGENERATE_STORYBOARD_IMAGE_FAILED",
]


class StoryboardImageGenerateJobMessage(BaseModel):
    jobId: str = Field(..., min_length=1)
    jobType: StoryboardImageJobType = "STORYBOARD_IMAGE"
    storyId: int = Field(..., ge=1)
    payload: StoryboardImageGenerateRequest


class StoryboardImageGenerateItemJobPayload(BaseModel):
    seed: int = Field(..., ge=0)
    item: StoryboardImageGenerateItemRequest


class StoryboardImageGenerateItemJobMessage(BaseModel):
    jobId: str = Field(..., min_length=1)
    jobType: StoryboardImageJobType = "STORYBOARD_IMAGE"
    storyId: int = Field(..., ge=1)
    payload: StoryboardImageGenerateItemJobPayload


class StoryboardImageRegenerateJobMessage(BaseModel):
    jobId: str = Field(..., min_length=1)
    jobType: StoryboardImageJobType = "STORYBOARD_IMAGE"
    storyId: int = Field(..., ge=1)
    payload: StoryboardImageRegenerateRequest


class StoryboardImageError(BaseModel):
    code: str
    message: str


class StoryboardImageSuccessPayload(BaseModel):
    seed: int = Field(..., ge=0)
    result: StoryboardImageGenerateResult


class StoryboardImageSuccessEnvelope(BaseModel):
    jobId: str
    type: StoryboardImageSuccessType
    storyId: int
    pageNumber: int = Field(..., ge=0)
    status: Literal["COMPLETED"] = "COMPLETED"
    payload: StoryboardImageSuccessPayload


class StoryboardImageFailureEnvelope(BaseModel):
    jobId: str
    type: StoryboardImageFailureType
    storyId: int
    pageNumber: int | None = Field(default=None, ge=0)
    status: Literal["FAILED"] = "FAILED"
    error: StoryboardImageError
