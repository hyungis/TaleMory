from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.schemas.tts import ApiSuccessResponse, PreviewRequest, StoryTtsRequest, VoiceRegisterRequest
from app.services.dev_tts_service import (
    create_story_tts_job,
    create_voice_clone_job,
    generate_preview,
    get_voice_info,
    process_story_tts_job,
    process_voice_clone_job,
    read_manifest,
)


router = APIRouter(prefix="/api/v1", tags=["tts"])


@router.post("/voices", response_model=ApiSuccessResponse)
def register_voice(
    request: VoiceRegisterRequest,
    background_tasks: BackgroundTasks,
) -> ApiSuccessResponse:
    job = create_voice_clone_job(request)
    background_tasks.add_task(process_voice_clone_job, job["jobId"], job["voiceId"], request)
    return ApiSuccessResponse(
        data={
            "jobId": job["jobId"],
            "jobType": job["jobType"],
            "status": job["status"],
            "voiceId": job["voiceId"],
        }
    )


@router.get("/voices/{voice_id}", response_model=ApiSuccessResponse)
def read_voice(voice_id: str) -> ApiSuccessResponse:
    try:
        data = get_voice_info(voice_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=f"Voice not found: {voice_id}") from error
    return ApiSuccessResponse(data=data)


@router.post("/voices/{voice_id}/preview", response_model=ApiSuccessResponse)
def preview_voice(voice_id: str, request: PreviewRequest) -> ApiSuccessResponse:
    try:
        data = generate_preview(voice_id, request.text, request.format, request.options)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=f"Voice not found: {voice_id}") from error
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


@router.get("/jobs/{job_id}", response_model=ApiSuccessResponse)
def read_job(job_id: str) -> ApiSuccessResponse:
    try:
        payload = read_manifest(job_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}") from error
    return ApiSuccessResponse(data=payload["data"], message=payload.get("message"))

