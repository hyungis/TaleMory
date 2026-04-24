package com.s210.backend.domain.story.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.common.response.PageResponse
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.story.application.StoryService
import com.s210.backend.domain.story.presentation.request.CreateStoryRequest
import com.s210.backend.domain.story.presentation.request.ModifyStoryRequest
import com.s210.backend.domain.story.presentation.response.ShareLinkResponse
import com.s210.backend.domain.story.presentation.response.StoryCreateResponse
import com.s210.backend.domain.story.presentation.response.StoryDetailResponse
import com.s210.backend.domain.story.presentation.response.StoryDraftResponse
import com.s210.backend.domain.story.presentation.response.StoryResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/stories")
class StoryController(
    private val storyService: StoryService,
) {

    // 동화 목록 조회
    @GetMapping
    fun storyList(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "10") size: Int
    ): ResponseEntity<ApiResponse<PageResponse<StoryResponse>>> {
        // TODO: StoryService.findStories(userId, page, size)
        TODO("Not yet implemented")
    }

    /**
     * 로그인 유저의 "진행 중인 동화" 1건(최신 DRAFT) 을 반환한다.
     * BookstoreScene 에서 "새 동화책 만들기" 클릭 시 이어서 작성 여부를 판단하기 위해 호출.
     * 없으면 `data = null` 로 내려준다 (HTTP 200 유지 — null 자체가 의미 있는 응답).
     *
     * NOTE: `/draft` literal 은 `/{storyId}` GET 매핑보다 위에 선언돼야 path-var 충돌이 없지만,
     * Spring 이 정적 경로를 우선 매칭하므로 문제는 없다. 가독성을 위해 이 위치 유지.
     */
    @GetMapping("/draft")
    fun storyDraftDetails(
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<StoryDraftResponse?>> {
        val draft = storyService.findLatestDraft(user.userId)
        val body = draft?.let {
            StoryDraftResponse(
                storyId = it.id,
                title = it.title,
                difficulty = it.difficulty.name,
                companionsJson = it.companionsJson,
                mainCharacterJson = it.mainCharacterJson,
                travelPlace = it.travelPlace,
                travelStartDate = it.travelStartDate,
                travelEndDate = it.travelEndDate,
                createdAt = it.createdAt,
            )
        }
        return ResponseEntity.ok(ApiResponse(data = body))
    }

    /**
     * 동화 기본 정보 생성 — Step 1 (BasicInfoStep) 종료 시 1회 호출.
     * 성공 시 201 CREATED + `{ storyId }` 만 응답. FE 는 이 id 로 step 2~8 리소스를 참조.
     */
    @PostMapping
    fun storyAdd(
        @AuthenticationPrincipal user: CustomUser,
        @RequestBody @Valid request: CreateStoryRequest,
    ): ResponseEntity<ApiResponse<StoryCreateResponse>> {
        val result = storyService.addStory(request.toCommand(user.userId))
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(ApiResponse(data = StoryCreateResponse(storyId = result.id)))
    }

    /**
     * 동화 기본 정보 수정 — BasicInfoStep 에서 뒤로가기 후 값 변경 & "사진 선택하러 가기" 재클릭 시 호출.
     * null 필드는 "미변경" 으로 취급 (PATCH semantics).
     * 성공 시 200 OK + `{ storyId }` 반환 — POST 와 동일한 응답 형태 유지 (FE 핸들러 재사용).
     */
    @PatchMapping("/{storyId}")
    fun storyModify(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
        @RequestBody request: ModifyStoryRequest,
    ): ResponseEntity<ApiResponse<StoryCreateResponse>> {
        val result = storyService.modifyStory(user.userId, storyId, request.toCommand())
        return ResponseEntity.ok(ApiResponse(data = StoryCreateResponse(storyId = result.id)))
    }

    // 동화 상세 조회
    @GetMapping("/{storyId}")
    fun storyDetails(@PathVariable storyId: Long): ResponseEntity<ApiResponse<StoryDetailResponse>> {
        // TODO: StoryService.findStory(storyId)
        TODO("Not yet implemented")
    }

    /**
     * 동화 소프트 삭제 — `deleted_at` 을 찍어 목록/조회에서 제외한다.
     * BasicInfoStep "새로 시작하기" 플로우에서 기존 DRAFT 를 정리할 때 호출된다.
     */
    @DeleteMapping("/{storyId}")
    fun storyRemove(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
    ): ResponseEntity<ApiResponse<Unit>> {
        storyService.removeStory(user.userId, storyId)
        return ResponseEntity.ok(ApiResponse(data = Unit))
    }

    // 즐겨찾기 토글
    @PatchMapping("/{storyId}/bookmark")
    fun storyBookmarkModify(@PathVariable storyId: Long): ResponseEntity<ApiResponse<Unit>> {
        // TODO: StoryService.toggleBookmark(storyId)
        TODO("Not yet implemented")
    }

    // 최종본 공개
    @PostMapping("/{storyId}/publish")
    fun storyPublish(@PathVariable storyId: Long): ResponseEntity<ApiResponse<Unit>> {
        // TODO: StoryService.publishStory(storyId)
        TODO("Not yet implemented")
    }

    // 공유 링크 조회
    @GetMapping("/{storyId}/share-link")
    fun storyShareLinkDetails(@PathVariable storyId: Long): ResponseEntity<ApiResponse<ShareLinkResponse>> {
        // TODO: StoryService.findShareLink(storyId)
        TODO("Not yet implemented")
    }

    // 공개 동화 조회 (비로그인 접근 가능)
    @GetMapping("/public/{shareToken}")
    fun storyPublicDetails(@PathVariable shareToken: String): ResponseEntity<ApiResponse<StoryDetailResponse>> {
        // TODO: StoryService.findPublicStory(shareToken)
        TODO("Not yet implemented")
    }
}
