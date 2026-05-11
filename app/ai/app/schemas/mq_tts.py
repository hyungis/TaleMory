from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.tts import StoryTtsRequest


TtsJobType = Literal["TTS"]
TtsStoryMode = Literal["VIEWER", "WEBTOON"]
TtsEventStatus = Literal["COMPLETED", "FAILED"]
TtsSuccessType = Literal["GENERATE_TTS_COMPLETED"]
TtsFailureType = Literal["GENERATE_TTS_FAILED"]


class StoryTtsGenerateJobMessage(BaseModel):
    jobId: str = Field(..., min_length=1)
    jobType: TtsJobType = "TTS"
    action: str | None = None  # Optional — BE may include GENERATE/REGENERATE
    storyMode: TtsStoryMode = "VIEWER"
    storyId: int | None = Field(default=None, ge=1)
    payload: StoryTtsRequest


class TtsError(BaseModel):
    code: str
    message: str


class TtsAppliedStyle(BaseModel):
    emotion: str
    stylePrompt: str | None = None


class TtsAudioAsset(BaseModel):
    audioUrl: str
    s3Key: str | None = None
    durationMs: int | None = None
    format: str


class TtsSentenceItem(BaseModel):
    sentenceId: int
    speakerKey: str | None = None
    voiceId: str | None = None
    appliedStyle: TtsAppliedStyle
    audio: TtsAudioAsset


class TtsSentenceUpdate(BaseModel):
    sentenceId: int
    ttsAudioUrl: str
    ttsAudioS3Key: str | None = None


class TtsSummary(BaseModel):
    sentenceCount: int


class TtsUsage(BaseModel):
    model: str
    inputTokens: int | None = None
    outputTokens: int | None = None
    totalTokens: int | None = None
    costUsd: float | None = None
    promptTemplateVersion: str


class StoryTtsResultPayload(BaseModel):
    storyId: int
    storyMode: TtsStoryMode = "VIEWER"
    voiceId: str
    items: list[TtsSentenceItem]
    sceneSentenceUpdates: list[TtsSentenceUpdate]
    summary: TtsSummary
    usage: TtsUsage


class TtsSuccessEnvelope(BaseModel):
    jobId: str
    type: TtsSuccessType
    storyId: int | None = None
    status: Literal["COMPLETED"] = "COMPLETED"
    payload: StoryTtsResultPayload


class TtsFailureEnvelope(BaseModel):
    jobId: str
    type: TtsFailureType
    storyId: int | None = None
    status: Literal["FAILED"] = "FAILED"
    error: TtsError
