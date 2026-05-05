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
@Transactional
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
            "That quick beige fox jumped over each lazy dog, shouting through the thin valley."

        private const val DEFAULT_CHILD_NAME = "my dear"
    }

    @Transactional(readOnly = true)
    fun findRecordingScript(storyId: Long?): String {
        if (storyId == null) return SCRIPT_TEMPLATE.format(DEFAULT_CHILD_NAME)

        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        val children = storyParticipantParser.parseChildren(story.mainCharacterJson)
        val firstName = children.firstOrNull()?.name ?: DEFAULT_CHILD_NAME
        return SCRIPT_TEMPLATE.format(firstName)
    }

    @Transactional(readOnly = true)
    fun findVoiceProfiles(userId: Long): List<VoiceProfileResult> =
        voiceProfileRepository.findAllByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
            .map(::toResult)

    @Transactional(readOnly = true)
    fun findVoiceProfile(userId: Long, voiceProfileId: Long): VoiceProfileResult =
        ownedVoiceProfile(userId, voiceProfileId).let(::toResult)

    /**
     * Phase 1: presigned PUT URL 발급만 수행 (DB 저장 없음).
     * FE 가 이 URL 로 S3 에 직접 PUT 한 뒤, addVoiceProfile 로 commit.
     */
    @Transactional(readOnly = true)
    fun presignVoiceUpload(userId: Long, contentType: String): S3Service.PresignedUpload {
        if (contentType !in ALLOWED_AUDIO_TYPES) {
            throw BusinessException(VoiceErrorCode.INVALID_AUDIO_FORMAT)
        }
        return s3Service.presignVoicePutUrl(userId, contentType)
    }

    /**
     * Phase 3: S3 업로드 완료 후 commit — DB 에 row 생성.
     * s3Key prefix 가 `stories/voice/{userId}/` 인지 검증하여 타 유저 key 오염 방지.
     */
    fun addVoiceProfile(userId: Long, title: String, s3Key: String): VoiceProfileResult {
        val trimmedTitle = title.trim()
        if (trimmedTitle.isBlank()) throw BusinessException(CommonErrorCode.INVALID_INPUT)

        // env-prefix(local/dev/prod) 적용된 풀 prefix 로 검증.
        val expectedPrefix = s3Service.applyEnvPrefix("stories/voice/$userId/")
        if (!s3Key.startsWith(expectedPrefix)) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }

        val profile = voiceProfileRepository.save(
            VoiceProfile(
                userId = userId,
                title = trimmedTitle,
                audioUrl = s3Key,
            )
        )
        return toResult(profile)
    }

    fun removeVoiceProfile(userId: Long, voiceProfileId: Long) {
        val voiceProfile = ownedVoiceProfile(userId, voiceProfileId)
        voiceProfile.deletedAt = LocalDateTime.now()
    }

    private fun ownedVoiceProfile(userId: Long, voiceProfileId: Long): VoiceProfile {
        val voiceProfile = voiceProfileRepository.findByIdAndDeletedAtIsNull(voiceProfileId)
            ?: throw BusinessException(VoiceErrorCode.VOICE_PROFILE_NOT_FOUND)
        if (voiceProfile.userId != userId) {
            throw BusinessException(CommonErrorCode.FORBIDDEN)
        }
        return voiceProfile
    }

    private fun toResult(voiceProfile: VoiceProfile): VoiceProfileResult {
        val result = VoiceProfileResult.from(voiceProfile)
        return result.copy(
            audioUrl = result.audioUrl.toPresignedAudioUrl(),
            ttsVoiceUrl = result.ttsVoiceUrl.toPresignedAudioUrl(),
        )
    }

    private fun String?.toPresignedAudioUrl(): String? {
        if (this.isNullOrBlank()) return null

        val s3Key = extractS3Key(this) ?: return this
        return s3Service.presignGetUrl(s3Key)
    }

    private fun extractS3Key(storedReference: String): String? {
        val withoutQuery = storedReference.substringBefore("?")
        // URL 이 아니면 이미 raw S3 key (env-prefix 가 붙었든 안 붙었든 그대로 통과).
        if (!withoutQuery.startsWith("http://") && !withoutQuery.startsWith("https://")) {
            return withoutQuery
        }
        // URL 에서 path 만 추출 → 그게 곧 env-prefix 포함된 풀 key.
        return runCatching {
            java.net.URI(withoutQuery).path?.removePrefix("/")?.takeIf { it.isNotBlank() }
        }.getOrNull()
    }
}
