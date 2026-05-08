package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.codec.JobId
import com.s210.backend.common.codec.StoryId
import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.redis.StoryboardPageImageVersionRedisRepository
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageVersionEntry
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageVersionsResult
import com.s210.backend.domain.storyboard.application.dto.StoryboardRegenStatusResult
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper

/**
 * 스토리보드 페이지 이미지 버전 picker / 재생성 카운터 read-mostly 유스케이스.
 *
 * 책임 분리:
 *  - 생성/재생성 큐 publish 는 `StoryboardImageGenerationService` (write-heavy + MQ).
 *  - 이 서비스는 Redis 조회 + DB current 갱신 + 카운터 응답 (write 는 select 한 곳뿐).
 *
 * Redis 키 트리오는 `StoryboardPageImageVersionRedisRepository` 가 관리:
 *  - `storybook:storyboard-image:versions:{pageId}`
 *  - `storybook:storyboard-image:current:{pageId}`
 *  - `storybook:storyboard-image:max-version:{pageId}`
 *
 * 권한 검증: 모든 메서드가 `ownedStory(userId, storyId)` 로 1차 확인 후 진행.
 */
@Service
class StoryboardImageVersionService(
    private val storyRepository: StoryRepository,
    private val storyBoardRepository: StoryBoardRepository,
    private val storyboardPageRepository: StoryboardPageRepository,
    private val jobRepository: StoryGenerationJobRepository,
    private val pageVersionRepository: StoryboardPageImageVersionRedisRepository,
    private val objectMapper: ObjectMapper,
    private val storyboardEditGuard: StoryboardEditGuard,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * 한 페이지의 모든 버전 + 현재 선택된 버전 조회.
     *
     * 재생성 이력이 없는 페이지면 `current = null, versions = []` 로 200 OK 응답.
     * → FE 는 picker 자체를 숨김.
     */
    @Transactional(readOnly = true)
    fun listVersions(
        userId: Long,
        storyId: Long,
        pageNumber: Int,
    ): StoryboardImageVersionsResult {
        ownedStory(userId, storyId)
        val page = resolvePage(storyId, pageNumber)

        val rawList = pageVersionRepository.listVersions(page.id)
        val current = pageVersionRepository.getCurrent(page.id)

        val entries = rawList
            .mapNotNull { json -> parseVersionEntry(json) }
            .sortedByDescending { it.version }

        return StoryboardImageVersionsResult(
            storyId = StoryId(storyId),
            pageNumber = pageNumber,
            current = current,
            versions = entries,
        )
    }

    /**
     * 유저가 드롭다운에서 특정 버전을 선택했을 때.
     *
     * 동작:
     *  1) Redis 의 versions 리스트에서 해당 version 찾아 url 추출 (없으면 404).
     *  2) `storyboard_pages.image_url` 갱신 (DB 가 SOT — PUBLISHED 후에도 영구 보존되는 URL 은 이것).
     *  3) Redis `current` 를 새 version 으로 갱신.
     *  4) 갱신된 imageUrl 반환.
     */
    @Transactional
    fun selectVersion(
        userId: Long,
        storyId: Long,
        pageNumber: Int,
        version: Int,
    ): String {
        val story = ownedStory(userId, storyId)
        storyboardEditGuard.assertEditable(story)
        val page = resolvePage(storyId, pageNumber)

        // Redis 에서 해당 버전 url 찾기.
        val target = pageVersionRepository.listVersions(page.id)
            .mapNotNull { parseVersionEntry(it) }
            .firstOrNull { it.version == version }
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        // DB 갱신 (dirty checking).
        page.imageUrl = target.url

        // Redis current 갱신 — best-effort. DB 가 이미 갱신되어 SOT 는 일치하므로
        // Redis 실패해도 응답은 정상으로 내려보낸다.
        runCatching {
            pageVersionRepository.setCurrent(page.id, version)
        }.onFailure { e ->
            log.warn("Redis setCurrent failed for page {}: {}", page.id, e.message)
        }

        return target.url
    }

    /**
     * 헤더 카운터용 — 동화 단위 재생성 사용량 / 한도 / 남은 횟수 조회.
     *
     * - `regenerateOne` 한도 검사와 동일한 카운트 (PENDING + RUNNING + SUCCESS + FAILED).
     * - PENDING/RUNNING 도 used 에 포함 → 사용자가 재생성 버튼을 누른 즉시 카운터가 깎여서
     *   "결과를 받아야 비로소 차감되는" 헷갈림을 방지. AI 잡이 FAILED 로 끝나도 이미 차감된
     *   카운트가 그대로 유지되며 한도 정책상 일관됨.
     * - 카운트는 `JobType.STORYBOARD_IMAGE_REGENERATE` 만 — 배치 첫 생성은 제외.
     */
    @Transactional(readOnly = true)
    fun getRegenStatus(userId: Long, storyId: Long): StoryboardRegenStatusResult {
        ownedStory(userId, storyId)

        val used = jobRepository.countByStoryIdAndJobTypeAndStatusIn(
            storyId,
            JobType.STORYBOARD_IMAGE_REGENERATE,
            listOf(JobStatus.PENDING, JobStatus.RUNNING, JobStatus.SUCCESS, JobStatus.FAILED),
        ).toInt()

        val limit = StoryboardImageRegenPolicy.LIMIT_PER_STORY
        val remaining = (limit - used).coerceAtLeast(0)

        return StoryboardRegenStatusResult(
            storyId = StoryId(storyId),
            used = used,
            limit = limit,
            remaining = remaining,
        )
    }

    // ---------------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------------

    /**
     * Redis JSON 1건을 `StoryboardImageVersionEntry` 로 디코딩.
     * 손상된 엔트리는 null 반환 (전체 응답을 깨뜨리지 않도록 skip).
     */
    private fun parseVersionEntry(json: String): StoryboardImageVersionEntry? {
        return try {
            val node = objectMapper.readTree(json)
            val version = node.get("version")?.asInt() ?: return null
            val url = node.get("url")?.asText() ?: return null
            val prompt = node.get("prompt")?.takeUnless { it.isNull }?.asText()
            val createdAt = node.get("createdAt")?.takeUnless { it.isNull }?.asText()
            val jobId = node.get("jobId")?.takeUnless { it.isNull }?.asLong()
            StoryboardImageVersionEntry(
                version = version,
                url = url,
                prompt = prompt,
                createdAt = createdAt,
                jobId = jobId?.let { JobId(it) },
            )
        } catch (e: Exception) {
            log.warn("Failed to parse version entry: {}", e.message)
            null
        }
    }

    private fun resolvePage(storyId: Long, pageNumber: Int) =
        storyBoardRepository
            .findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?.let { sb ->
                storyboardPageRepository.findByStoryBoardIdAndPageNumber(sb.id, pageNumber)
            }
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

    private fun ownedStory(userId: Long, storyId: Long): Story {
        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.deletedAt != null) throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        if (story.userId != userId) throw BusinessException(CommonErrorCode.FORBIDDEN)
        return story
    }

}
