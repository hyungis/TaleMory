from typing import Literal

from pydantic import BaseModel, Field


Difficulty = Literal["BEGINNER", "INTERMEDIATE", "ADVANCED"]
Gender = Literal["MALE", "FEMALE"]
SentenceEmotion = Literal[
    "NEUTRAL",
    "HAPPY",
    "SAD",
    "EXCITED",
    "CALM",
    "CURIOUS",
    "SURPRISED",
    "WARM",
    "TENDER",
    "BRAVE",
]


class ChildInfo(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    age: int = Field(..., ge=1, le=18)
    gender: Gender


class TravelInfo(BaseModel):
    place: str = Field(..., min_length=1, max_length=255)
    startDate: str | None = None
    endDate: str | None = None


class PhotoInput(BaseModel):
    photoId: int = Field(..., ge=1)
    imageUrl: str | None = Field(default=None, max_length=500)
    description: str = Field(..., min_length=1, max_length=1000)
    hashtags: list[str] = Field(default_factory=list)
    displayOrder: int = Field(..., ge=1)


class StoryboardGenerateRequest(BaseModel):
    storyId: int | None = Field(default=None, ge=1)
    children: list[ChildInfo] = Field(..., min_length=1)
    companions: list[str] = Field(default_factory=list)
    travel: TravelInfo
    photos: list[PhotoInput] = Field(..., min_length=1)
    difficulty: Difficulty = "BEGINNER"
    additionalInstruction: str | None = Field(default=None, max_length=1000)


class ReadingLevel(BaseModel):
    basedOnAge: int
    sentencesPerPage: str
    wordsPerSentence: str
    reason: str


class StorySentence(BaseModel):
    sentenceOrder: int
    englishText: str
    koreanText: str
    emotion: SentenceEmotion


class StoryboardPage(BaseModel):
    pageNumber: int
    sourcePhotoIds: list[int]
    sceneSummary: str
    englishText: str
    koreanText: str
    imagePrompt: str
    sentences: list[StorySentence]
    sentenceCount: int
    wordCount: int


class UsageInfo(BaseModel):
    model: str
    inputTokens: int | None = None
    outputTokens: int | None = None
    totalTokens: int | None = None
    costUsd: float | None = None
    promptTemplateVersion: str


class StoryboardGenerateResponse(BaseModel):
    title: str
    synopsis: str
    moralTheme: str
    storyQuest: str
    recurringMotif: str
    pageCount: int
    pageCountReason: str
    readingLevel: ReadingLevel
    totalWordCount: int
    pages: list[StoryboardPage]
    usage: UsageInfo


class StoryboardRegenerateRequest(BaseModel):
    storyId: int | None = Field(default=None, ge=1)
    originalRequest: StoryboardGenerateRequest
    currentStoryboard: StoryboardGenerateResponse
    feedbackInstruction: str = Field(..., min_length=1, max_length=2000)
