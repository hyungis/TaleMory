from pydantic import BaseModel, Field

from app.schemas.tts import PreviewRequest


class PreviewTtsJobMessage(BaseModel):
    jobId: str = Field(..., min_length=1)
    jobType: str = "TTS_PREVIEW"
    voiceId: str = Field(..., min_length=1)
    payload: PreviewRequest


class PreviewTtsResultPayload(BaseModel):
    audioUrl: str
    s3Key: str
    durationMs: int


class PreviewTtsError(BaseModel):
    code: str
    message: str


class PreviewTtsRpcResponse(BaseModel):
    success: bool
    data: PreviewTtsResultPayload | None = None
    error: PreviewTtsError | None = None
