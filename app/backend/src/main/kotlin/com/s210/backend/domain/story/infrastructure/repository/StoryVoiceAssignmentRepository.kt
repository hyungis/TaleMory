package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.StoryVoiceAssignment
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface StoryVoiceAssignmentRepository : JpaRepository<StoryVoiceAssignment, Long> {
    fun findAllByStoryIdOrderBySpeakerKeyAsc(storyId: Long): List<StoryVoiceAssignment>

    /**
     * Step 6 [저장] 시 replaceAssignments 흐름에서 같은 트랜잭션 안에 DELETE → INSERT 가 연속 발생.
     * derived `deleteAllBy*` 는 SELECT 후 EntityManager.remove() 만 큐잉하기 때문에,
     * Hibernate ActionQueue 의 기본 순서(INSERT → DELETE)에 의해 saveAll 의 INSERT 가 먼저 flush 되어
     * `uk_story_voice_assignments_story_speaker(story_id, speaker_key)` 가 깨졌다.
     *
     * @Modifying + bulk DELETE @Query + flushAutomatically=true 로 DELETE 가 즉시 DB 에 반영되도록 강제하고,
     * clearAutomatically=true 로 영속성 컨텍스트도 비워 saveAll 이 stale 상태를 보지 않게 한다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from StoryVoiceAssignment s where s.storyId = :storyId")
    fun deleteAllByStoryId(@Param("storyId") storyId: Long)
}
