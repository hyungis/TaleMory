package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.storyboard.application.dto.StoryboardPageResult
import com.s210.backend.domain.storyboard.application.dto.StoryboardPagesResult
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 스토리보드 페이지 단위 조회 / 편집 유스케이스.
 *
 * - 페이지는 `storyboard_pages` 테이블이 단일 진실 원본.
 *   listener 가 STORY 결과 받을 때 채우고, 유저가 PATCH 로 한글 본문만 갱신할 수 있다.
 * - Step 3 (PromptStep) 은 응답을 join 해 통합 본문을 read-only 로 보여주고,
 *   Step 4 (StoryboardStep) 는 페이지별 카드로 렌더 + 페이지별 PATCH 호출.
 */
@Service
@Transactional
class StoryboardPageService(
    private val storyRepository: StoryRepository,
    private val storyBoardRepository: StoryBoardRepository,
    private val storyboardPageRepository: StoryboardPageRepository,
) {

    /**
     * `GET /api/stories/{storyId}/storyboard/pages`
     *
     * 가장 최근 storyBoard 의 페이지들을 page_number 오름차순으로 반환.
     * 줄거리가 아직 생성되지 않은 상태(storyBoard null)에선 `pages = []` 로 200 OK 응답한다.
     * (FE 가 placeholder 또는 안내 문구를 띄울 수 있도록)
     */
    @Transactional(readOnly = true)
    fun listPages(userId: Long, storyId: Long): StoryboardPagesResult {
        ownedStory(userId, storyId)

        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: return StoryboardPagesResult(storyId = storyId, pages = emptyList())

        val pages = storyboardPageRepository
            .findAllByStoryBoardIdOrderByPageNumberAsc(storyBoard.id)
            .map(StoryboardPageResult::from)

        return StoryboardPagesResult(storyId = storyId, pages = pages)
    }

    /**
     * `PATCH /api/stories/{storyId}/storyboard/pages/{pageNumber}`
     *
     * 한 페이지의 한글 본문만 update. 다른 필드(english_text/scene_summary/image_prompt/image_url)는
     * AI 원본을 그대로 보존한다 — 이미지 생성 시 prompt 일관성 유지를 위해.
     *
     * - 줄거리 미생성 / 페이지 미존재 → RESOURCE_NOT_FOUND
     * - 빈 입력 (validation 으로 1차 차단되지만 trim 후 재확인) → INVALID_INPUT
     */
    fun updatePageKoreanText(
        userId: Long,
        storyId: Long,
        pageNumber: Int,
        koreanText: String,
    ): StoryboardPageResult {
        ownedStory(userId, storyId)

        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        val page = storyboardPageRepository.findByStoryBoardIdAndPageNumber(storyBoard.id, pageNumber)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        val trimmed = koreanText.trim()
        if (trimmed.isEmpty()) throw BusinessException(CommonErrorCode.INVALID_INPUT)

        page.koreanText = trimmed
        // dirty checking 으로 트랜잭션 종료 시 자동 UPDATE.

        return StoryboardPageResult.from(page)
    }

    /**
     * 소유권 + 삭제 여부 검증.
     * StoryboardGenerationService 의 동명 메서드와 동일 패턴 — 향후 공통 helper 로 추출 검토.
     */
    private fun ownedStory(userId: Long, storyId: Long): Story {
        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.deletedAt != null) throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        if (story.userId != userId) throw BusinessException(CommonErrorCode.FORBIDDEN)
        return story
    }
}
