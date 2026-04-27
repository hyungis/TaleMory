package com.s210.backend.domain.voice.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.s3.S3Service
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.storyboard.application.StoryParticipantParser
import com.s210.backend.domain.voice.application.dto.VoiceProfileResult
import com.s210.backend.domain.voice.entity.VoiceProfile
import com.s210.backend.domain.voice.exception.VoiceErrorCode
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
@Transactional(readOnly = true)
class VoiceService(
    private val voiceProfileRepository: VoiceProfileRepository,
    private val storyRepository: StoryRepository,
    private val storyParticipantParser: StoryParticipantParser,
    private val s3Service: S3Service,
) {
    companion object {
        private val ALLOWED_AUDIO_TYPES = setOf(
            "audio/webm", "audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg",
        )

        private const val SCRIPT_TEMPLATE =
            "Hello, %s! This story is for you. " +
            "That quick beige fox jumped over each lazy dog, shouting through the thin valley. " +
            "She whispered soft thoughts about azure skies and emerald trees. " +
            "Zealous children gathered near ancient temples, listening to strange stories about hidden treasures."

        private const val DEFAULT_CHILD_NAME = "my dear"
    }

    fun findRecordingScript(storyId: Long?): String {
        if (storyId == null) return SCRIPT_TEMPLATE.format(DEFAULT_CHILD_NAME)

        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        val children = storyParticipantParser.parseChildren(story.mainCharacterJson)
        val firstName = children.firstOrNull()?.name ?: DEFAULT_CHILD_NAME
        return SCRIPT_TEMPLATE.format(firstName)
    }

    fun findVoiceProfiles(userId: Long): List<VoiceProfileResult> =
        voiceProfileRepository.findAllByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
            .map { it.toResult() }

    data class VoiceProfileCreateResult(
        val profile: VoiceProfileResult,
        val uploadUrl: String,
    )

    /**
     * 보이스 프로필을 DB에 저장하고, 프론트가 직접 S3에 PUT할 presigned URL을 발급한다.
     */
    @Transactional
    fun addVoiceProfile(userId: Long, title: String, contentType: String): VoiceProfileCreateResult {
        val trimmedTitle = title.trim()
        if (trimmedTitle.isBlank()) throw BusinessException(CommonErrorCode.INVALID_INPUT)

        if (contentType !in ALLOWED_AUDIO_TYPES) {
            throw BusinessException(VoiceErrorCode.INVALID_AUDIO_FORMAT)
        }

        val presigned = s3Service.presignVoicePutUrl(userId, contentType)
        val audioUrl = s3Service.buildPublicImageUrl(presigned.s3Key)

        val profile = voiceProfileRepository.save(
            VoiceProfile(
                userId = userId,
                title = trimmedTitle,
                audioUrl = audioUrl,
            )
        )
        return VoiceProfileCreateResult(
            profile = profile.toResult(),
            uploadUrl = presigned.uploadUrl,
        )
    }

    @Transactional
    fun removeVoiceProfile(userId: Long, voiceProfileId: Long) {
        val profile = voiceProfileRepository.findById(voiceProfileId).orElseThrow {
            BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        }
        if (profile.userId != userId) throw BusinessException(CommonErrorCode.FORBIDDEN)
        if (profile.deletedAt != null) throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        profile.deletedAt = LocalDateTime.now()
    }

    private fun extensionOf(contentType: String): String = when (contentType.lowercase()) {
        "audio/webm" -> "webm"
        "audio/wav" -> "wav"
        "audio/mpeg" -> "mp3"
        "audio/mp4" -> "m4a"
        "audio/ogg" -> "ogg"
        else -> "bin"
    }

    private fun VoiceProfile.toResult() = VoiceProfileResult(
        id = id,
        title = title,
        audioUrl = audioUrl,
        ttsVoiceUrl = ttsVoiceUrl,
        createdAt = createdAt,
    )
}
