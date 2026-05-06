from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.storyboard import ChildInfo


class StoryboardImageContext(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    synopsis: str = Field(..., min_length=1, max_length=2000)


class StoryboardImagePageInput(BaseModel):
    pageNumber: int = Field(..., ge=0)
    sceneSummary: str | None = Field(default=None, max_length=1000)
    englishText: str | None = Field(default=None, max_length=4000)
    koreanText: str | None = Field(default=None, max_length=4000)
    imagePrompt: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_page_text(self) -> "StoryboardImagePageInput":
        if self.pageNumber == 0:
            return self
        if not self.sceneSummary or not self.sceneSummary.strip():
            raise ValueError("sceneSummary is required for storyboard pages")
        if not self.englishText or not self.englishText.strip():
            raise ValueError("englishText is required for storyboard pages")
        if not self.koreanText or not self.koreanText.strip():
            raise ValueError("koreanText is required for storyboard pages")
        if not self.imagePrompt or not self.imagePrompt.strip():
            raise ValueError("imagePrompt is required for storyboard pages")
        return self


class StoryboardImageGenerateItemRequest(BaseModel):
    pageNumber: int = Field(..., ge=0)
    storyboard: StoryboardImageContext
    page: StoryboardImagePageInput
    children: list[ChildInfo] = Field(..., min_length=1)
    companions: list[str] = Field(default_factory=list)
    characterReferenceImageUrls: list[str] = Field(default_factory=list, max_length=1)
    characterReferenceImageS3Keys: list[str] = Field(default_factory=list, max_length=1)
    referenceImageUrls: list[str] = Field(default_factory=list, max_length=3)
    referenceImageS3Keys: list[str] = Field(default_factory=list, max_length=3)
    additionalInstruction: str | None = Field(default=None, max_length=2000)


class StoryboardImageGenerateRequest(BaseModel):
    storyId: int = Field(..., ge=1)
    seed: int = Field(..., ge=0)
    characterSourceImageUrls: list[str] = Field(default_factory=list, max_length=3)
    characterSourceImageS3Keys: list[str] = Field(default_factory=list, max_length=3)
    items: list[StoryboardImageGenerateItemRequest] = Field(..., min_length=1, max_length=21)


class StoryboardCharacterReferenceGenerateRequest(BaseModel):
    storyId: int = Field(..., ge=1)
    seed: int = Field(..., ge=0)
    storyboard: StoryboardImageContext
    children: list[ChildInfo] = Field(..., min_length=1)
    companions: list[str] = Field(default_factory=list)
    referenceImageUrls: list[str] = Field(default_factory=list, max_length=3)
    referenceImageS3Keys: list[str] = Field(default_factory=list, max_length=3)
    additionalInstruction: str | None = Field(default=None, max_length=2000)


class StoryboardImageRegenerateRequest(BaseModel):
    storyId: int = Field(..., ge=1)
    seed: int = Field(..., ge=0)
    outputVersion: int = Field(..., ge=1)
    userPrompt: str = Field(..., min_length=1, max_length=2000)
    item: StoryboardImageGenerateItemRequest

    @field_validator("userPrompt")
    @classmethod
    def validate_user_prompt(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("userPrompt must not be blank")
        return normalized


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
    seed: int
    results: list[StoryboardImageGenerateResult]
    usage: StoryboardImageBatchUsage


class StoryboardCharacterReferenceGenerateResponse(BaseModel):
    storyId: int
    seed: int
    imageUrl: str
    usage: StoryboardImageUsage


class StoryboardImageRegenerateResponse(BaseModel):
    storyId: int
    seed: int
    outputVersion: int
    result: StoryboardImageGenerateResult
