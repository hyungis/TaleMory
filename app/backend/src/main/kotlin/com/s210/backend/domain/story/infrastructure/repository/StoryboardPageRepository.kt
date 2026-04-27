package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.StoryboardPage
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface StoryboardPageRepository : JpaRepository<StoryboardPage, Long> {

    /**
     * 한 storyBoard 의 페이지들을 page_number 오름차순으로 조회.
     * GET /storyboard/pages 응답, 이미지 페이로드 조립 등 다수 유스케이스에서 공유.
     */
    fun findAllByStoryBoardIdOrderByPageNumberAsc(storyBoardId: Long): List<StoryboardPage>

    /**
     * storyBoardId + pageNumber 로 단건 조회 — PATCH /storyboard/pages/{n} 등에서 사용.
     */
    fun findByStoryBoardIdAndPageNumber(storyBoardId: Long, pageNumber: Int): StoryboardPage?

    /**
     * 줄거리 재생성 시 같은 storyBoard 의 모든 페이지를 비우기 위한 bulk DELETE.
     *
     * - 페이지 수가 바뀔 수 있어 delete-then-insert 패턴 사용.
     * - clearAutomatically + flushAutomatically: 영속성 컨텍스트를 비우고 즉시 flush 해서,
     *   같은 트랜잭션 내 후속 saveAll INSERT 가 UNIQUE KEY (storyBoardId, pageNumber) 와
     *   충돌하지 않도록 한다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM StoryboardPage p WHERE p.storyBoardId = :storyBoardId")
    fun deleteAllByStoryBoardId(@Param("storyBoardId") storyBoardId: Long): Int
}
