from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.storyboard import ChildInfo


class FinalIllustrationContext(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    synopsis: str = Field(..., min_length=1, max_length=2000)


class FinalIllustrationPageInput(BaseModel):
    pageNumber: int = Field(..., ge=0)
    sceneSummary: str | None = Field(default=None, max_length=1000)
    englishText: str | None = Field(default=None, max_length=4000)
    koreanText: str | None = Field(default=None, max_length=4000)
    imagePrompt: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_body_page_text_fields(self) -> "FinalIllustrationPageInput":
        if self.pageNumber == 0:
            return self
        required_fields = {
            "sceneSummary": self.sceneSummary,
            "englishText": self.englishText,
            "koreanText": self.koreanText,
            "imagePrompt": self.imagePrompt,
        }
        missing = [name for name, value in required_fields.items() if value is None or not value.strip()]
        if missing:
            raise ValueError(f"{', '.join(missing)} must not be blank for body pages")
        return self


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
    pageNumber: int = Field(..., ge=0)
    storyboard: FinalIllustrationContext
    page: FinalIllustrationPageInput
    children: list[ChildInfo] = Field(..., min_length=1)
    companions: list[str] = Field(default_factory=list)
    roughStoryboardImageUrl: str | None = Field(default=None, max_length=2000)
    roughStoryboardImageS3Key: str | None = Field(default=None, max_length=1000)
    currentIllustrationImageS3Key: str | None = Field(default=None, max_length=1000)
    stylePrompt: str = Field(..., min_length=1, max_length=2000)
    additionalInstruction: str | None = Field(default=None, max_length=2000)
    outputVersion: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_rough_storyboard_reference(self) -> "FinalIllustrationGenerateItemRequest":
        if (
            self.roughStoryboardImageUrl
            or self.roughStoryboardImageS3Key
            or self.currentIllustrationImageS3Key
        ):
            return self
        raise ValueError(
            "roughStoryboardImageUrl, roughStoryboardImageS3Key, "
            "or currentIllustrationImageS3Key is required"
        )


class FinalIllustrationGenerateRequest(BaseModel):
    storyId: int = Field(..., ge=1)
    seed: int = Field(..., ge=0)
    renderOptions: FinalIllustrationRenderOptions = Field(default_factory=FinalIllustrationRenderOptions)
    items: list[FinalIllustrationGenerateItemRequest] = Field(..., min_length=1, max_length=21)


class FinalIllustrationReviseRequest(BaseModel):
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
    pageNumber: int = Field(..., ge=0)
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


class FinalIllustrationReviseResponse(BaseModel):
    storyId: int
    seed: int
    result: FinalIllustrationGenerateResult


class LayoutSentenceInput(BaseModel):
    sentenceOrder: int = Field(..., ge=1)
    englishText: str | None = Field(default=None, max_length=4000)
    koreanText: str | None = Field(default=None, max_length=4000)
    speakerKey: str | None = Field(default=None, max_length=50)


class LayoutBoundingBox(BaseModel):
    x: float = Field(..., ge=0, le=1)
    y: float = Field(..., ge=0, le=1)
    width: float = Field(..., ge=0, le=1)
    height: float = Field(..., ge=0, le=1)


class LayoutAnchor(BaseModel):
    x: float = Field(..., ge=0, le=1)
    y: float = Field(..., ge=0, le=1)


class CharacterAnchorCandidate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    bbox: LayoutBoundingBox
    anchor: LayoutAnchor
    confidence: float = Field(..., ge=0, le=1)


class FinalIllustrationLayoutAnalysisRequest(BaseModel):
    pageNumber: int = Field(..., ge=0)
    imageUrl: str | None = Field(default=None, max_length=2000)
    imageS3Key: str | None = Field(default=None, max_length=1000)
    sceneSummary: str | None = Field(default=None, max_length=1000)
    imagePrompt: str | None = Field(default=None, max_length=2000)
    children: list[ChildInfo] = Field(default_factory=list)
    charactersInScene: list[dict[str, Any]] = Field(default_factory=list)
    companions: list[str] = Field(default_factory=list)
    sentences: list[LayoutSentenceInput] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_image_reference(self) -> "FinalIllustrationLayoutAnalysisRequest":
        if self.imageUrl or self.imageS3Key:
            return self
        raise ValueError("imageUrl or imageS3Key is required")


class FinalIllustrationLayoutAnalysisResponse(BaseModel):
    pageNumber: int = Field(..., ge=0)
    model: str
    characters: list[CharacterAnchorCandidate] = Field(default_factory=list)
