package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.common.mq.RoutingKeys
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.PhotoAlbumItemRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.storyboard.application.dto.ChildInfo
import com.s210.backend.domain.storyboard.application.dto.PhotoInput
import com.s210.backend.domain.storyboard.application.dto.StartGenerationResult
import com.s210.backend.domain.storyboard.application.dto.StoryGenerateJobMessage
import com.s210.backend.domain.storyboard.application.dto.StoryGeneratePayload
import com.s210.backend.domain.storyboard.application.dto.TravelInfo
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
/**
 * 동화 본문(텍스트) 생성 요청을 MQ 로 비동기 발송하는 유스케이스.
 * API 명세 #28 `POST /api/stories/{storyId}/storyboard/story` 의 서비스 레이어.
 *
 * 실행 흐름:
 *  1. 소유권 검증
 *  2. Story 기본 필드(여행지 등) + 사진 개수(10~30) 검증
 *  3. 사진 목록 로드
 *  4. Story 의 JSON 문자열 필드(mainCharacterJson / companionsJson)를 AI 스키마로 파싱
 *  5. `story_generation_jobs` INSERT (status=PENDING, jobType=STORYBOARD_STORY) → DB PK = jobId
 *  6. envelope 를 ai.request exchange 로 publish (routing key = ai.cpu.story.generate)
 *     - AI 스펙상 envelope.jobId 는 string — DB PK 를 `.toString()` 으로 변환
 *     - AI 내부 jobType 는 "STORY" (AI 팀 스펙 고정값)
 *  7. `{ jobId, jobType, status }` 즉시 응답
 */
@Service
@Transactional
class StoryboardGenerationService(
    private val storyRepository: StoryRepository,
    private val photoRepository: PhotoAlbumItemRepository,
    private val jobRepository: StoryGenerationJobRepository,
    private val rabbitTemplate: RabbitTemplate,
    private val objectMapper: ObjectMapper,
) {

    fun generate(userId: Long, storyId: Long, prompt: String?): StartGenerationResult {
        val story = ownedStory(userId, storyId)

        // Step 1 이 완료되지 않은 스토리는 AI 에 유의미한 payload 를 만들 수 없음.
        val travelPlace = story.travelPlace?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(CommonErrorCode.INVALID_INPUT)

        val photos = photoRepository
            .findAllByStoryIdAndDeletedAtIsNullOrderByDisplayOrderAsc(storyId)
        if (photos.size !in PHOTO_COUNT_MIN..PHOTO_COUNT_MAX) {
            // API 명세: 사진은 10~30장 업로드해야 함. PHOTO_COUNT_OUT_OF_RANGE 에러.
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }

        val children = parseChildren(story.mainCharacterJson)
        if (children.isEmpty()) {
            // 주인공 아이 정보 없이는 AI 가 이야기를 만들 수 없음.
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }
        val companions = parseCompanions(story.companionsJson)

        val payload = StoryGeneratePayload(
            children = children,
            companions = companions,
            travel = TravelInfo(
                place = travelPlace,
                startDate = story.travelStartDate?.toString(),
                endDate = story.travelEndDate?.toString(),
            ),
            photos = photos.map { photo ->
                PhotoInput(
                    photoId = photo.id,
                    // Photo 테이블의 imageUrl 컬럼은 실제로는 S3 key 를 저장한다
                    // (addPhoto 시 s3Key 가 그대로 저장됨 — PhotoService 참고).
                    s3Key = photo.imageUrl,
                    description = photo.description?.takeIf { it.isNotBlank() }
                        ?: DEFAULT_PHOTO_DESCRIPTION,
                    hashtags = parseHashtags(photo.tagsJson),
                    // AI 스키마는 1-indexed (ge=1). DB 는 0-indexed 이므로 +1.
                    displayOrder = (photo.displayOrder + 1).toInt(),
                )
            },
            difficulty = story.difficulty.name,
            additionalInstruction = prompt?.trim()?.takeIf { it.isNotEmpty() },
        )

        // request_payload 컬럼에는 AI 에 보낸 페이로드를 그대로 저장 — 재생성/디버깅/재현성 확보.
        val requestPayloadJson = objectMapper.writeValueAsString(payload)

        val job = jobRepository.save(
            StoryGenerationJob(
                storyId = storyId,
                jobType = JobType.STORYBOARD_STORY,
                status = JobStatus.PENDING,
                requestPayload = requestPayloadJson,
            ),
        )

        // AI 스펙: envelope.jobId 는 string. DB PK 를 문자열화해서 전달.
        val envelope = StoryGenerateJobMessage(
            jobId = job.id.toString(),
            storyId = storyId,
            payload = payload,
        )
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.STORY_GENERATE,
            envelope,
        )

        return StartGenerationResult(
            jobId = job.id,
            jobType = JobType.STORYBOARD_STORY.name,
            status = JobStatus.PENDING.name,
        )
    }

    /**
     * mainCharacterJson 예시:
     *   [ { "personId": 5, "name": "지민", "age": 7, "gender": "MALE" }, ... ]
     * personId 는 AI 에 필요 없으므로 제외하고 name/age/gender 만 추출.
     */
    private fun parseChildren(json: String): List<ChildInfo> {
        val root = parseTreeOrNull(json) ?: return emptyList()
        if (!root.isArray) return emptyList()

        val list = mutableListOf<ChildInfo>()
        for (node in root) {
            val name = node.get("name")?.asString()?.trim()?.takeIf { it.isNotEmpty() } ?: continue
            val age = extractInt(node.get("age")) ?: continue
            val gender = node.get("gender")?.asString()?.uppercase()?.takeIf { it.isNotEmpty() } ?: continue
            list.add(ChildInfo(name, age, gender))
        }
        return list
    }

    /**
     * companionsJson 은 FE 가 `JSON.stringify(data.companions ?? '')` 로 만든 문자열.
     * 실제 케이스:
     *  - 사용자가 자유 입력한 하나의 문자열 ("엄마, 아빠")
     *  - 배열 ["엄마", "아빠"]
     *  - 빈 문자열
     * 세 경우를 모두 List<String> 로 정규화.
     */
    private fun parseCompanions(json: String): List<String> {
        val root = parseTreeOrNull(json) ?: return emptyList()
        return when {
            root.isString -> splitFreeText(root.asString())
            root.isArray -> root.mapNotNull { it.takeIf(JsonNode::isString)?.asString()?.trim()?.takeIf { s -> s.isNotEmpty() } }
            else -> emptyList()
        }
    }

    /**
     * tagsJson 예시:
     *  - `["한라산","등산"]`  — FE 의 태그 편집 UI 최신 포맷
     *  - `"#한라산 #등산"`     — 과거 자유텍스트 입력 호환
     */
    private fun parseHashtags(tagsJson: String?): List<String> {
        if (tagsJson.isNullOrBlank()) return emptyList()
        val root = parseTreeOrNull(tagsJson) ?: return emptyList()
        return when {
            root.isString -> splitFreeText(root.asString()).map { it.removePrefix("#") }
            root.isArray -> root.mapNotNull {
                it.takeIf(JsonNode::isString)?.asString()?.trim()?.takeIf { s -> s.isNotEmpty() }
            }
            else -> emptyList()
        }
    }

    private fun parseTreeOrNull(json: String): JsonNode? =
        if (json.isBlank()) null
        else try { objectMapper.readTree(json) } catch (_: Exception) { null }

    private fun extractInt(node: JsonNode?): Int? = when {
        node == null || node.isNull -> null
        node.isNumber -> node.asInt()
        node.isString -> node.asString().toIntOrNull()
        else -> null
    }

    private fun splitFreeText(raw: String): List<String> =
        raw.split(",", ";", " ")
            .mapNotNull { it.trim().takeIf { t -> t.isNotEmpty() } }

    private fun ownedStory(userId: Long, storyId: Long): Story {
        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.deletedAt != null) throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        if (story.userId != userId) throw BusinessException(CommonErrorCode.FORBIDDEN)
        return story
    }

    companion object {
        /** 사진 설명이 비어있을 때 AI 의 min_length=1 제약을 위한 fallback. */
        private const val DEFAULT_PHOTO_DESCRIPTION = "사진"
        /** API 명세: 사진은 10~30장 업로드해야 함. */
        private const val PHOTO_COUNT_MIN = 10
        private const val PHOTO_COUNT_MAX = 30
    }
}
