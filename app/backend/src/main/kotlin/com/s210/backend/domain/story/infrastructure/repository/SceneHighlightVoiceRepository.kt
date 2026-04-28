package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.SceneHighlightVoice
import org.springframework.data.jpa.repository.JpaRepository

interface SceneHighlightVoiceRepository : JpaRepository<SceneHighlightVoice, Long> {
    fun findBySentenceIdAndDeletedAtIsNull(sentenceId: Long): SceneHighlightVoice?
}
