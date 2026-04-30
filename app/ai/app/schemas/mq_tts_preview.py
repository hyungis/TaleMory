from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.tts import PreviewRequest


class PreviewTtsJobMessage(BaseModel):
    jobId: str = Field(..., min_length=1)
    jobType: str = "TTS_PREVIEW"
    voiceId: str = Field(..., min_length=1)
    payload: PreviewRequest


class PreviewTtsAppliedStyle(BaseModel):
    emotion: str | None = None
    stylePrompt: str | None = None
    speakingRate: float | None = None
    pitch: float | None = None
    volumeGain: float | None = None


class PreviewTtsResultPayload(BaseModel):
    voiceId: str
    audioUrl: str
    s3Key: str | None = None
    durationMs: int
    format: str
    appliedStyle: PreviewTtsAppliedStyle | None = None


class PreviewTtsError(BaseModel):
    code: str
    message: str


class PreviewTtsSuccessEnvelope(BaseModel):
    jobId: str
    type: Literal["GENERATE_TTS_PREVIEW_COMPLETED"] = "GENERATE_TTS_PREVIEW_COMPLETED"
    status: Literal["COMPLETED"] = "COMPLETED"
    payload: PreviewTtsResultPayload


class PreviewTtsFailureEnvelope(BaseModel):
    jobId: str
    type: Literal["GENERATE_TTS_PREVIEW_FAILED"] = "GENERATE_TTS_PREVIEW_FAILED"
    status: Literal["FAILED"] = "FAILED"
    error: PreviewTtsError
