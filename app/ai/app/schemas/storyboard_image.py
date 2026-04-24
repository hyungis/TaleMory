from pydantic import BaseModel, Field

from app.schemas.storyboard import ChildInfo


class StoryboardImageContext(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    synopsis: str = Field(..., min_length=1, max_length=2000)
    moralTheme: str = Field(..., min_length=1, max_length=500)
    recurringMotif: str = Field(..., min_length=1, max_length=500)


class StoryboardImagePageInput(BaseModel):
    pageNumber: int = Field(..., ge=1)
    sceneSummary: str = Field(..., min_length=1, max_length=1000)
    englishText: str = Field(..., min_length=1, max_length=4000)
    koreanText: str = Field(..., min_length=1, max_length=4000)
    imagePrompt: str = Field(..., min_length=1, max_length=2000)


class StoryboardImageGenerateItemRequest(BaseModel):
    pageNumber: int = Field(..., ge=1)
    storyboard: StoryboardImageContext
    page: StoryboardImagePageInput
    children: list[ChildInfo] = Field(..., min_length=1)
    companions: list[str] = Field(default_factory=list)
    referenceImageUrls: list[str] = Field(default_factory=list, max_length=3)
    additionalInstruction: str | None = Field(default=None, max_length=2000)


class StoryboardImageGenerateRequest(BaseModel):
    storyId: int = Field(..., ge=1)
    items: list[StoryboardImageGenerateItemRequest] = Field(..., min_length=1, max_length=20)


class StoryboardImageUsage(BaseModel):
    provider: str
    model: str
    promptTokens: int | None = None
    candidateTokens: int | None = None
    totalTokens: int | None = None
    imageCount: int = 1
    costUsd: float | None = None


class StoryboardImageGenerateResult(BaseModel):
    pageNumber: int
    imageUrl: str
    finalPrompt: str
    usage: StoryboardImageUsage


class StoryboardImageBatchUsage(BaseModel):
    provider: str
    model: str
    totalPromptTokens: int | None = None
    totalCandidateTokens: int | None = None
    totalTokens: int | None = None
    totalImages: int
    totalCostUsd: float | None = None


class StoryboardImageGenerateResponse(BaseModel):
    storyId: int
    results: list[StoryboardImageGenerateResult]
    usage: StoryboardImageBatchUsage
