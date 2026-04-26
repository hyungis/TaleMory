from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.storyboard import ChildInfo


class FinalIllustrationContext(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    synopsis: str = Field(..., min_length=1, max_length=2000)


class FinalIllustrationPageInput(BaseModel):
    pageNumber: int = Field(..., ge=1)
    sceneSummary: str = Field(..., min_length=1, max_length=1000)
    englishText: str = Field(..., min_length=1, max_length=4000)
    koreanText: str = Field(..., min_length=1, max_length=4000)
    imagePrompt: str = Field(..., min_length=1, max_length=2000)


class FinalIllustrationRenderOptions(BaseModel):
    aspectRatio: str = Field(default="match_input_image", min_length=1, max_length=50)
    megapixels: str = Field(default="1", min_length=1, max_length=10)
    outputFormat: str = Field(default="png", min_length=1, max_length=20)
    outputQuality: int = Field(default=95, ge=1, le=100)
    numOutputs: int = Field(default=1, ge=1, le=1)
    goFast: bool = Field(default=False)
    safetyTolerance: int = Field(default=2, ge=0, le=6)
    disableSafetyChecker: bool = Field(default=False)


class FinalIllustrationGenerateItemRequest(BaseModel):
    pageNumber: int = Field(..., ge=1)
    storyboard: FinalIllustrationContext
    page: FinalIllustrationPageInput
    children: list[ChildInfo] = Field(..., min_length=1)
    companions: list[str] = Field(default_factory=list)
    roughStoryboardImageUrl: str | None = Field(default=None, max_length=2000)
    roughStoryboardImageS3Key: str | None = Field(default=None, max_length=1000)
    styleImageUrls: list[str] = Field(default_factory=list, max_length=3)
    styleImageS3Keys: list[str] = Field(default_factory=list, max_length=3)
    stylePrompt: str = Field(..., min_length=1, max_length=2000)
    additionalInstruction: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_rough_storyboard_reference(self) -> "FinalIllustrationGenerateItemRequest":
        if self.roughStoryboardImageUrl or self.roughStoryboardImageS3Key:
            return self
        raise ValueError("roughStoryboardImageUrl or roughStoryboardImageS3Key is required")


class FinalIllustrationGenerateRequest(BaseModel):
    storyId: int = Field(..., ge=1)
    seed: int = Field(..., ge=0)
    renderOptions: FinalIllustrationRenderOptions = Field(default_factory=FinalIllustrationRenderOptions)
    items: list[FinalIllustrationGenerateItemRequest] = Field(..., min_length=1, max_length=20)


class FinalIllustrationRegenerateRequest(BaseModel):
    storyId: int = Field(..., ge=1)
    seed: int = Field(..., ge=0)
    renderOptions: FinalIllustrationRenderOptions = Field(default_factory=FinalIllustrationRenderOptions)
    userPrompt: str = Field(..., min_length=1, max_length=2000)
    item: FinalIllustrationGenerateItemRequest

    @field_validator("userPrompt")
    @classmethod
    def validate_user_prompt(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("userPrompt must not be blank")
        return normalized


class FinalIllustrationUsage(BaseModel):
    provider: str
    model: str
    promptTokens: int | None = None
    candidateTokens: int | None = None
    totalTokens: int | None = None
    imageCount: int = 1
    costUsd: float | None = None


class FinalIllustrationGenerateResult(BaseModel):
    pageNumber: int
    imageUrl: str
    usage: FinalIllustrationUsage


class FinalIllustrationBatchUsage(BaseModel):
    provider: str
    model: str
    totalPromptTokens: int | None = None
    totalCandidateTokens: int | None = None
    totalTokens: int | None = None
    totalImages: int
    totalCostUsd: float | None = None


class FinalIllustrationGenerateResponse(BaseModel):
    storyId: int
    seed: int
    results: list[FinalIllustrationGenerateResult]
    usage: FinalIllustrationBatchUsage


class FinalIllustrationRegenerateResponse(BaseModel):
    storyId: int
    seed: int
    result: FinalIllustrationGenerateResult
