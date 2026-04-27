from typing import Literal

from pydantic import BaseModel, Field


AudioFormat = Literal["wav", "mp3"]
EmotionType = Literal[
    "NEUTRAL",
    "WARM",
    "HAPPY",
    "EXCITED",
    "CALM",
    "SAD",
    "SOFT",
    "SERIOUS",
    "ANGRY",
    "NARRATION",
]
JobType = Literal["VOICE_CLONE", "TTS"]
JobStatus = Literal["PENDING", "RUNNING", "SUCCESS", "FAILED"]


class ApiSuccessResponse(BaseModel):
    success: bool = True
    data: dict
    message: str | None = None


class SourceAudioRequest(BaseModel):
    path: str


class VoiceRegisterOptions(BaseModel):
    runNoiseCheck: bool = True
    trimSilence: bool = True
    normalizeVolume: bool = True
    generatePromptCache: bool = False


class VoiceRegisterRequest(BaseModel):
    label: str
    sourceAudio: SourceAudioRequest
    scriptText: str | None = None
    language: str
    options: VoiceRegisterOptions = Field(default_factory=VoiceRegisterOptions)


class PreviewOptions(BaseModel):
    emotion: EmotionType
    stylePrompt: str | None = None
    speakingRate: float | None = None
    pitch: float | None = None
    volumeGain: float | None = None
    useSsml: bool = False


class PreviewRequest(BaseModel):
    text: str
    language: str
    format: AudioFormat = "wav"
    options: PreviewOptions


class StorySentenceRequest(BaseModel):
    sentenceId: int
    pageNumber: int | None = None
    sentenceOrder: int | None = None
    text: str
    speakerKey: str | None = None
    emotion: EmotionType | None = None
    stylePrompt: str | None = None
    ssml: str | None = None


class StoryTtsOptions(BaseModel):
    defaultEmotion: EmotionType
    defaultStylePrompt: str | None = None
    generateFullBookAudio: bool = True
    speakingRate: float | None = None
    pitch: float | None = None
    volumeGain: float | None = None
    useSsml: bool = False


class StoryTtsRequest(BaseModel):
    storyId: int
    voiceId: str
    language: str
    format: AudioFormat = "wav"
    options: StoryTtsOptions
    sentences: list[StorySentenceRequest]
