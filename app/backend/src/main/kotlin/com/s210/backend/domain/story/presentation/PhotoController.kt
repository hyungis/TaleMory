package com.s210.backend.domain.story.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.story.application.PhotoService
import com.s210.backend.domain.story.presentation.request.CreatePhotoRequest
import com.s210.backend.domain.story.presentation.request.ModifyPhotoRequest
import com.s210.backend.domain.story.presentation.request.PhotoOrderRequest
import com.s210.backend.domain.story.presentation.request.PresignPhotoRequest
import com.s210.backend.domain.story.presentation.response.PhotoItemResponse
import com.s210.backend.domain.story.presentation.response.PresignPhotoResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Step 2 (사진 업로드) 전용 컨트롤러.
 *
 * 흐름:
 *  1. `POST /presigned-url` — FE 에 S3 PUT URL 발급 (5분 유효)
 *  2. (브라우저 → S3 직접 PUT — BE 통과 없음)
 *  3. `POST `         — S3 업로드 완료된 s3Key 를 DB 에 commit
 *  4. `GET `          — 사진 목록 (presigned GET URL 포함)
 *  5. `DELETE /{id}`  — soft delete
 *
 * NOTE: PATCH /{photoId} (description/tags 수정), PUT /order (순서 변경) 는 이번 MR
 * 범위 밖. 필요 시 후속 MR 에서 추가.
 */
@RestController
@RequestMapping("/api/stories/{storyId}/photos")
class PhotoController(
    private val photoService: PhotoService,
) {

    /**
     * presigned PUT URL 발급. 유효 5분.
     * 반환 `s3Key` 는 commit 단계(`POST /photos`)에서 그대로 다시 보내야 함.
     */
    @PostMapping("/presigned-url")
    fun photoPresignAdd(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
        @RequestBody @Valid request: PresignPhotoRequest,
    ): ResponseEntity<ApiResponse<PresignPhotoResponse>> {
        val result = photoService.presignUpload(user.userId, storyId, request.contentType)
        return ResponseEntity.ok(
            ApiResponse(
                data = PresignPhotoResponse(
                    uploadUrl = result.uploadUrl,
                    s3Key = result.s3Key,
                    expiresAt = result.expiresAt,
                )
            )
        )
    }

    /**
     * S3 업로드 완료 후 commit — DB 에 row INSERT.
     * 201 CREATED + 신규 사진 1건 반환 (presigned GET URL 포함).
     */
    @PostMapping
    fun photoAdd(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
        @RequestBody @Valid request: CreatePhotoRequest,
    ): ResponseEntity<ApiResponse<PhotoItemResponse>> {
        val saved = photoService.addPhoto(request.toCommand(user.userId, storyId))
        val presigned = photoService.presignGetUrl(saved.s3Key)
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(ApiResponse(data = PhotoItemResponse.from(saved, presigned)))
    }

    /**
     * Story 의 사진 목록 — display_order 오름차순.
     * 각 사진의 `imageUrl` 은 5분 유효 presigned GET URL.
     */
    @GetMapping
    fun photoList(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
    ): ResponseEntity<ApiResponse<List<PhotoItemResponse>>> {
        val photos = photoService.findPhotos(user.userId, storyId)
        val body = photos.map { PhotoItemResponse.from(it, photoService.presignGetUrl(it.s3Key)) }
        return ResponseEntity.ok(ApiResponse(data = body))
    }

    /**
     * 사진 순서 일괄 변경.
     * body 의 `photoIds` 는 현재 story 의 활성 사진 전체를 새 순서대로.
     * 응답은 재정렬된 목록 (각 imageUrl = 새 presigned GET URL).
     */
    @PutMapping("/order")
    fun photoOrderModify(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
        @RequestBody @Valid request: PhotoOrderRequest,
    ): ResponseEntity<ApiResponse<List<PhotoItemResponse>>> {
        val reordered = photoService.reorderPhotos(user.userId, storyId, request.photoIds)
        val body = reordered.map { PhotoItemResponse.from(it, photoService.presignGetUrl(it.s3Key)) }
        return ResponseEntity.ok(ApiResponse(data = body))
    }

    /**
     * 사진 설명/태그 수정. null 필드 = 미변경, 빈 문자열 = 값 비우기.
     */
    @PatchMapping("/{photoId}")
    fun photoModify(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
        @PathVariable photoId: Long,
        @RequestBody request: ModifyPhotoRequest,
    ): ResponseEntity<ApiResponse<PhotoItemResponse>> {
        val updated = photoService.modifyPhoto(request.toCommand(user.userId, storyId, photoId))
        val presigned = photoService.presignGetUrl(updated.s3Key)
        return ResponseEntity.ok(ApiResponse(data = PhotoItemResponse.from(updated, presigned)))
    }

    /**
     * 사진 삭제 — DB soft delete + S3 객체 hard delete.
     */
    @DeleteMapping("/{photoId}")
    fun photoRemove(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
        @PathVariable photoId: Long,
    ): ResponseEntity<ApiResponse<Unit>> {
        photoService.removePhoto(user.userId, storyId, photoId)
        return ResponseEntity.ok(ApiResponse(data = Unit))
    }
}
