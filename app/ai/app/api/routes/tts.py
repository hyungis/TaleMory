from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.schemas.tts import ApiSuccessResponse, PreviewRequest, StoryTtsRequest
from app.services.cosyvoice_client import CosyVoiceInvocationError, CosyVoiceNotConfiguredError
from app.services.dev_tts_service import (
    create_story_tts_job,
    generate_preview,
    process_story_tts_job,
    read_manifest,
)
from app.services.qwen_server_client import QwenTtsInvocationError, QwenTtsNotConfiguredError
from app.services.storage_service import StorageConfigurationError, StorageDownloadError, StorageUploadError


router = APIRouter(prefix="/api", tags=["tts"])


@router.post("/voices/{voiceId}/preview", response_model=ApiSuccessResponse)
def preview_voice(voiceId: str, request: PreviewRequest) -> ApiSuccessResponse:
    try:
        data = generate_preview(
            voiceId,
            request.text,
            request.language,
            request.format,
            request.options,
            request.referenceAudioUrl,
            request.referenceAudioS3Key,
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=f"Voice not found: {voiceId}") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except (CosyVoiceNotConfiguredError, QwenTtsNotConfiguredError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except (CosyVoiceInvocationError, QwenTtsInvocationError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except (StorageConfigurationError, StorageDownloadError, StorageUploadError) as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    return ApiSuccessResponse(data=data)


@router.post("/tts/story", response_model=ApiSuccessResponse)
def create_story_tts(request: StoryTtsRequest, background_tasks: BackgroundTasks) -> ApiSuccessResponse:
    if not request.sentences:
        raise HTTPException(status_code=400, detail="sentences must not be empty")

    job = create_story_tts_job(request.model_dump())
    background_tasks.add_task(process_story_tts_job, job["jobId"], request.model_dump())
    return ApiSuccessResponse(
        data={
            "jobId": job["jobId"],
            "jobType": job["jobType"],
            "status": job["status"],
            "storyId": job["storyId"],
        }
    )


@router.get("/jobs/{jobId}", response_model=ApiSuccessResponse)
def read_job(jobId: str) -> ApiSuccessResponse:
    try:
        payload = read_manifest(jobId)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=f"Job not found: {jobId}") from error
    return ApiSuccessResponse(data=payload["data"], message=payload.get("message"))
