package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.story.entity.StoryVoiceAssignment
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryVoiceAssignmentRepository
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class StoryVoiceAssignmentService(
    private val storyRepository: StoryRepository,
    private val storyVoiceAssignmentRepository: StoryVoiceAssignmentRepository,
    private val voiceProfileRepository: VoiceProfileRepository,
) {
    @Transactional(readOnly = true)
    fun findAssignments(userId: Long, storyId: Long): List<StoryVoiceAssignment> {
        validateOwnedStory(userId, storyId)
        return storyVoiceAssignmentRepository.findAllByStoryIdOrderBySpeakerKeyAsc(storyId)
    }

    @Transactional
    fun replaceAssignments(
        userId: Long,
        storyId: Long,
        assignments: List<StoryVoiceAssignmentInput>,
    ): List<StoryVoiceAssignment> {
        validateOwnedStory(userId, storyId)
        assignments.forEach { validateOwnedVoice(userId, it.voiceProfileId) }

        // FE 가 동일 speakerKey 를 중복 전송할 경우 saveAll 자체가 unique 제약을 깨뜨리므로
        // 마지막 항목이 살아남도록 디듀프(associateBy 는 충돌 시 last-wins).
        val deduped = assignments.associateBy { it.speakerKey }.values.toList()

        storyVoiceAssignmentRepository.deleteAllByStoryId(storyId)
        val saved = storyVoiceAssignmentRepository.saveAll(
            deduped.map {
                StoryVoiceAssignment(
                    storyId = storyId,
                    speakerKey = it.speakerKey,
                    speakerName = it.speakerName,
                    voiceProfileId = it.voiceProfileId,
                )
            },
        )
        return saved.sortedBy { it.speakerKey }
    }

    @Transactional
    fun removeAssignments(userId: Long, storyId: Long) {
        validateOwnedStory(userId, storyId)
        storyVoiceAssignmentRepository.deleteAllByStoryId(storyId)
    }

    private fun validateOwnedStory(userId: Long, storyId: Long) {
        storyRepository.findByIdAndUserId(storyId, userId)
            ?: throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
    }

    private fun validateOwnedVoice(userId: Long, voiceProfileId: Long) {
        val voice = voiceProfileRepository.findByIdAndDeletedAtIsNull(voiceProfileId)
            ?: throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        if (voice.userId != userId) {
            throw BusinessException(StoryErrorCode.STORY_ACCESS_FORBIDDEN)
        }
    }
}

data class StoryVoiceAssignmentInput(
    val speakerKey: String,
    val speakerName: String?,
    val voiceProfileId: Long,
)
