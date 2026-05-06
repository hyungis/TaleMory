package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.SceneSentence
import org.springframework.data.jpa.repository.JpaRepository

interface SceneSentenceRepository : JpaRepository<SceneSentence, Long> {
    fun findBySceneIdInOrderBySceneIdAscSentenceOrderAsc(sceneIds: List<Long>): List<SceneSentence>
    fun findAllBySceneIdIn(sceneIds: Collection<Long>): List<SceneSentence>
    fun findAllBySceneId(sceneId: Long): List<SceneSentence>
}
