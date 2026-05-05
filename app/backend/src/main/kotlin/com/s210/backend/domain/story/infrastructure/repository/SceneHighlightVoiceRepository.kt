package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.SceneHighlightVoice
import org.springframework.data.jpa.repository.JpaRepository

interface SceneHighlightVoiceRepository : JpaRepository<SceneHighlightVoice, Long> {
    fun findBySentenceIdAndDeletedAtIsNull(sentenceId: Long): SceneHighlightVoice?

    /**
     * 본문 재생성 cascade 용 배치 조회.
     *
     * `deletedAt IS NULL` 로 살아있는 강조 녹음만 가져온다 — soft-delete 된 row 까지
     * 다시 hard delete 할 필요는 없음(이미 논리 삭제 + 원본 S3 객체는 별도 정리 lane).
     * StoryboardResultListener.cascadeDeleteOldScenes 가 이 결과의 `audioUrl` 로
     * S3DeletionEvent 발행 후 `deleteAll(...)` 로 hard delete 한다.
     */
    fun findAllBySentenceIdInAndDeletedAtIsNull(sentenceIds: Collection<Long>): List<SceneHighlightVoice>

    /**
     * Step 4 본문 재생성 경고 모달용 — 활성 강조 녹음 존재 여부.
     *
     * COUNT > 0 보다 가벼운 EXISTS 쿼리를 발행해, 단순 boolean 체크에 적합.
     */
    fun existsBySentenceIdInAndDeletedAtIsNull(sentenceIds: Collection<Long>): Boolean

    /**
     * 뷰어용 — 활성 강조 녹음 일괄 조회 (StoryViewerService 가 사용).
     *
     * 위 `findAllBySentenceIdInAndDeletedAtIsNull(Collection)` 와 SQL 은 동일하지만
     * 이미 자리잡은 caller signature 호환을 위해 List 입력 메서드도 함께 둠.
     */
    fun findBySentenceIdInAndDeletedAtIsNull(sentenceIds: List<Long>): List<SceneHighlightVoice>
}
