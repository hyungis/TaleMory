package com.s210.backend.domain.story.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.story.presentation.request.ModifyPhotoRequest
import com.s210.backend.domain.story.presentation.request.PhotoOrderRequest
import com.s210.backend.domain.story.presentation.response.PhotoResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/api/stories/{storyId}/photos")
class PhotoController {

    // 사진 업로드
    @PostMapping
    fun photoAdd(
        @PathVariable storyId: Long,
        @RequestPart("files") files: List<MultipartFile>
    ): ResponseEntity<ApiResponse<List<PhotoResponse>>> {
        // TODO: PhotoService.addPhotos(storyId, files)
        TODO("Not yet implemented")
    }

    // 사진 설명/태그 수정
    @PatchMapping("/{photoId}")
    fun photoModify(
        @PathVariable storyId: Long,
        @PathVariable photoId: Long,
        @RequestBody request: ModifyPhotoRequest
    ): ResponseEntity<ApiResponse<PhotoResponse>> {
        // TODO: PhotoService.modifyPhoto(photoId, command)
        TODO("Not yet implemented")
    }

    // 사진 순서 변경
    @PutMapping("/order")
    fun photoOrderModify(
        @PathVariable storyId: Long,
        @RequestBody request: PhotoOrderRequest
    ): ResponseEntity<ApiResponse<Unit>> {
        // TODO: PhotoService.modifyPhotoOrder(storyId, request.photoIds)
        TODO("Not yet implemented")
    }
}
