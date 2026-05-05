from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.final_illustration import (
    FinalIllustrationGenerateItemRequest,
    FinalIllustrationGenerateRequest,
    FinalIllustrationGenerateResult,
    FinalIllustrationRenderOptions,
    FinalIllustrationReviseRequest,
)


FinalIllustrationJobType = Literal["FINAL_ILLUSTRATION"]
FinalIllustrationSuccessType = Literal[
    "GENERATE_FINAL_ILLUSTRATION_COMPLETED",
    "REVISE_FINAL_ILLUSTRATION_COMPLETED",
]
FinalIllustrationFailureType = Literal[
    "GENERATE_FINAL_ILLUSTRATION_FAILED",
    "REVISE_FINAL_ILLUSTRATION_FAILED",
]


class FinalIllustrationGenerateJobMessage(BaseModel):
    jobId: str = Field(..., min_length=1)
    jobType: FinalIllustrationJobType = "FINAL_ILLUSTRATION"
    storyId: int = Field(..., ge=1)
    payload: FinalIllustrationGenerateRequest


class FinalIllustrationGenerateItemJobPayload(BaseModel):
    seed: int = Field(..., ge=0)
    renderOptions: FinalIllustrationRenderOptions
    item: FinalIllustrationGenerateItemRequest


class FinalIllustrationGenerateItemJobMessage(BaseModel):
    jobId: str = Field(..., min_length=1)
    jobType: FinalIllustrationJobType = "FINAL_ILLUSTRATION"
    storyId: int = Field(..., ge=1)
    payload: FinalIllustrationGenerateItemJobPayload


class FinalIllustrationReviseJobMessage(BaseModel):
    jobId: str = Field(..., min_length=1)
    jobType: FinalIllustrationJobType = "FINAL_ILLUSTRATION"
    storyId: int = Field(..., ge=1)
    payload: FinalIllustrationReviseRequest


class FinalIllustrationError(BaseModel):
    code: str
    message: str


class FinalIllustrationSuccessPayload(BaseModel):
    seed: int = Field(..., ge=0)
    result: FinalIllustrationGenerateResult


class FinalIllustrationSuccessEnvelope(BaseModel):
    jobId: str
    type: FinalIllustrationSuccessType
    storyId: int
    pageNumber: int = Field(..., ge=0)
    status: Literal["COMPLETED"] = "COMPLETED"
    payload: FinalIllustrationSuccessPayload


class FinalIllustrationFailureEnvelope(BaseModel):
    jobId: str
    type: FinalIllustrationFailureType
    storyId: int
    pageNumber: int | None = Field(default=None, ge=0)
    status: Literal["FAILED"] = "FAILED"
    error: FinalIllustrationError
