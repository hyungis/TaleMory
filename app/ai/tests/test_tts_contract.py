"""
Contract tests: verify that the AI-side Pydantic schemas can round-trip the
JSON fixtures that match what the BE publishes / consumes.

Fixtures are copied from:
  app/backend/src/test/resources/contracts/tts/
and stored locally under:
  app/ai/tests/fixtures/tts/

Both fixture sets must be kept in sync — any BE schema change that alters the
fixture JSON must also be reflected here.
"""
import json
from pathlib import Path

import pytest

from app.schemas.mq_tts import StoryTtsGenerateJobMessage, TtsSuccessEnvelope, TtsFailureEnvelope

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "tts"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Job message (BE → AI): the envelope that arrives on the TTS generate queue.
# ---------------------------------------------------------------------------

def test_job_message_parse_succeeds() -> None:
    raw = _load("job-message.json")
    msg = StoryTtsGenerateJobMessage.model_validate(raw)

    assert msg.jobId == "12345"
    assert msg.jobType == "TTS"
    assert msg.storyId == 100
    assert msg.payload.voiceId == "42"


def test_job_message_reference_audio_url() -> None:
    """referenceAudioUrl must be parsed from the payload."""
    raw = _load("job-message.json")
    msg = StoryTtsGenerateJobMessage.model_validate(raw)

    assert msg.payload.referenceAudioUrl is not None
    assert msg.payload.referenceAudioUrl.startswith("https://")


def test_job_message_sentences() -> None:
    raw = _load("job-message.json")
    msg = StoryTtsGenerateJobMessage.model_validate(raw)

    assert len(msg.payload.sentences) == 2
    assert msg.payload.sentences[0].sentenceId == 1001
    assert msg.payload.sentences[1].sentenceId == 1002


def test_job_message_emotion_case_insensitive() -> None:
    """BE may send emotion values in lowercase; schema must normalise to uppercase."""
    raw = _load("job-message.json")
    msg = StoryTtsGenerateJobMessage.model_validate(raw)

    # fixture has "neutral" (lowercase) — after normalisation it must be "NEUTRAL"
    assert msg.payload.options.defaultEmotion == "NEUTRAL"


def test_job_message_backward_compat_without_reference_url() -> None:
    """Messages without referenceAudioUrl (old BE) must still parse — field is optional."""
    raw = _load("job-message.json")
    raw["payload"].pop("referenceAudioUrl", None)
    msg = StoryTtsGenerateJobMessage.model_validate(raw)

    assert msg.payload.referenceAudioUrl is None


# ---------------------------------------------------------------------------
# Result envelopes (AI → BE): the envelopes that AI publishes after processing.
# ---------------------------------------------------------------------------

def test_result_completed_parse_succeeds() -> None:
    raw = _load("result-completed.json")
    # TtsSuccessEnvelope only covers the success path
    envelope = TtsSuccessEnvelope.model_validate(raw)

    assert envelope.jobId == "12345"
    assert envelope.status == "COMPLETED"
    assert envelope.storyId == 100
    assert len(envelope.payload.items) == 1
    assert envelope.payload.summary.sentenceCount == 2


def test_result_failed_parse_succeeds() -> None:
    raw = _load("result-failed.json")
    envelope = TtsFailureEnvelope.model_validate(raw)

    assert envelope.jobId == "12345"
    assert envelope.status == "FAILED"
    assert envelope.error.code == "AI_PROVIDER_ERROR"
    assert "CosyVoice" in envelope.error.message
