package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.domain.auth.infrastructure.repository.MemberRepository
import com.s210.backend.domain.story.entity.StoryProgress
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.StoryProgressRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.presentation.response.ProgressResponse
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

/**
 * 동화책 뷰어 책갈피 서비스.
 * 한 유저가 한 동화에 **1개의 책갈피**만 가질 수 있음 — `story_progress.(user_id, story_id)` 유니크 제약.
 *
 * 엔드포인트:
 *  - GET    /api/stories/{storyId}/progress → 저장된 책갈피 반환, 없으면 null
 *  - PUT    /api/stories/{storyId}/progress → upsert
 *  - DELETE /api/stories/{storyId}/progress → 책갈피 해제 (행 삭제)
 */
@Service
@Transactional
class StoryProgressService(
    private val storyProgressRepository: StoryProgressRepository,
    private val storyRepository: StoryRepository,
    private val memberRepository: MemberRepository,
) {
    @Transactional(readOnly = true)
    fun findProgress(loginId: String, storyId: Long): ProgressResponse? {
        val userId = resolveUserId(loginId)
        verifyStoryExists(storyId)
        val progress = storyProgressRepository.findByUserIdAndStoryId(userId, storyId) ?: return null
        return progress.toResponse()
    }

    fun saveProgress(loginId: String, storyId: Long, lastScenePage: Int): ProgressResponse {
        val userId = resolveUserId(loginId)
        verifyStoryExists(storyId)

        val existing = storyProgressRepository.findByUserIdAndStoryId(userId, storyId)
        val saved = if (existing != null) {
            existing.lastScenePage = lastScenePage
            existing.updatedAt = LocalDateTime.now()
            existing
        } else {
            val created = StoryProgress(
                userId = userId,
                storyId = storyId,
                lastScenePage = lastScenePage,
            )
            storyProgressRepository.save(created)
        }
        return saved.toResponse()
    }

    fun removeProgress(loginId: String, storyId: Long) {
        val userId = resolveUserId(loginId)
        verifyStoryExists(storyId)
        storyProgressRepository.deleteByUserAndStory(userId, storyId)
    }

    private fun resolveUserId(loginId: String): Long {
        val user = memberRepository.findByLoginId(loginId)
            ?: throw BusinessException(CommonErrorCode.USER_NOT_FOUND)
        return user.id
    }

    private fun verifyStoryExists(storyId: Long) {
        storyRepository.findById(storyId)
            .orElseThrow { BusinessException(StoryErrorCode.STORY_NOT_FOUND) }
    }

    private fun StoryProgress.toResponse(): ProgressResponse =
        ProgressResponse(storyId = storyId, lastScenePage = lastScenePage)
}
