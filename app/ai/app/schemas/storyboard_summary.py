from pydantic import BaseModel, Field

from app.schemas.storyboard import StoryboardGenerateRequest, UsageInfo


class StoryboardSummaryGenerateRequest(StoryboardGenerateRequest):
    """Same input shape as storyboard generation; output is summary-only."""


class StoryboardSummaryDraft(BaseModel):
    title: str = Field(..., min_length=1)
    summary: str = Field(..., min_length=1)
    summaryKo: str = Field(..., min_length=1)
    moralTheme: str = Field(..., min_length=1)
    storyQuest: str = Field(..., min_length=1)
    recurringMotif: str = Field(..., min_length=1)
    keyEmotionalBeats: list[str] = Field(..., min_length=3)


class StoryboardSummaryRegenerateRequest(StoryboardSummaryGenerateRequest):
    previousSummary: StoryboardSummaryDraft
    userPrompt: str = Field(..., min_length=1, max_length=2000)


class StoryboardSummaryGenerateResponse(StoryboardSummaryDraft):
    usage: UsageInfo
