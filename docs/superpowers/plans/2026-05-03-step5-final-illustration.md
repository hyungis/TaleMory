# Step 5 Final Illustration Auto-Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Step 5 에서 사용자가 삽화 스타일을 선택하는 즉시 BE 가 `FINAL_ILLUSTRATION` 잡을 백그라운드 enqueue 해서, Step 6/7(보이스 클론·강조 녹음) 진행 동안 AI 서버가 컬러 최종 일러스트를 미리 생성해두고, Step 8 FinalPreviewStep 에서 TTS 와 FINAL 두 잡 모두 SUCCESS 인 시점에 표시되도록 한다.

**Architecture:**
- BE: `JobType.FINAL_ILLUSTRATION` enum 추가 → `FinalIllustrationGenerationService` 신규(기존 `StoryboardImageGenerationService` 패턴 미러링) → `PATCH /stories/{id}/style` 핸들러에서 enqueue → MQ publish (라우팅 키 `ai.image.final-illustration.generate`) → AI 콜백 받는 `FinalIllustrationResultListener` 신규 → `Job.resultPayload` 에 페이지별 URL 저장 + 이미 존재하면 `Scene.illustration_url` UPDATE → `StoryConfirmService` 가 confirm 시 FINAL 잡 결과 우선 사용해 Scene 생성.
- AI: 이미 `final_illustration_consumer.py` + 스키마 + env 다 준비되어 있어 신규 작업 없음. BE publish payload 가 AI 스키마(`FinalIllustrationGenerateRequest`) 와 일치하기만 하면 됨.
- FE: `patchStoryStyle` 응답 타입을 `void` → `{ jobId: number }` 로 변경 → `useStoryCreationFlow` 에 `finalIllustrationJobId` state 추가 → Step 5 에서 setter 호출 → Step 8 가 두 jobId 모두 폴링.
- 의미 분리 보존: `storyboard_pages.image_url` = 스토리보드 rough(불변), `scenes.illustration_url` = 최종 컬러 일러스트.

**Tech Stack:** Kotlin Spring Boot 3, Spring AMQP(RabbitMQ), JPA, Jackson, React + TypeScript + React Query, Python FastAPI(AI 워커, 변경 없음).

---

## File Structure

### Backend (신규/수정)

**신규 파일:**
- `app/backend/src/main/kotlin/com/s210/backend/domain/storyboard/application/FinalIllustrationGenerationService.kt` — Step 5 PATCH /style 시 호출되는 enqueue 서비스 (멱등 가드 포함)
- `app/backend/src/main/kotlin/com/s210/backend/domain/storyboard/application/FinalIllustrationResultListener.kt` — AI → BE 콜백 처리 (`ai.result.final-illustration.*`)
- `app/backend/src/main/kotlin/com/s210/backend/domain/storyboard/application/dto/FinalIllustrationGenerateMessage.kt` — MQ envelope + payload + item DTO
- `app/backend/src/main/kotlin/com/s210/backend/domain/storyboard/application/dto/FinalIllustrationResultEnvelope.kt` — AI 가 보내는 결과 envelope 역직렬화 DTO
- `app/backend/src/main/kotlin/com/s210/backend/domain/story/presentation/response/StyleModifyResponse.kt` — PATCH /style 응답 DTO (`{ jobId: Long }`)
- `app/backend/src/test/kotlin/com/s210/backend/domain/storyboard/application/FinalIllustrationGenerationServiceTest.kt`
- `app/backend/src/test/kotlin/com/s210/backend/domain/storyboard/application/FinalIllustrationResultListenerTest.kt`

**수정 파일:**
- `app/backend/src/main/kotlin/com/s210/backend/domain/job/model/JobType.kt` — `FINAL_ILLUSTRATION` enum 추가
- `app/backend/src/main/kotlin/com/s210/backend/common/mq/RoutingKeys.kt` — `FINAL_ILLUSTRATION_GENERATE` 추가
- `app/backend/src/main/kotlin/com/s210/backend/domain/story/application/StoryService.kt:351-357` — `modifyStyle` 의 반환 타입을 `Unit` → `Long(jobId)` 로 바꾸고 enqueue 호출
- `app/backend/src/main/kotlin/com/s210/backend/domain/story/presentation/SceneController.kt:138-146` — 응답을 `StyleModifyResponse` 로 변경
- `app/backend/src/main/kotlin/com/s210/backend/domain/story/application/StoryConfirmService.kt:130-157` — Scene INSERT 시 최신 SUCCESS FINAL 잡 결과 우선 사용
- `app/backend/src/main/kotlin/com/s210/backend/domain/story/application/dto/ConfirmStoryboardResponse.kt` (또는 inline 정의 파일) — `finalIllustrationJobId: Long?` 추가

### Frontend (수정)

- `app/frontend/src/features/story-creation/style-selector/api/patchStoryStyle.ts` — 응답 타입 `void` → `StylePatchResponse`
- `app/frontend/src/features/story-creation/style-selector/model/useStoryStylePatch.ts` — 반환 타입 반영
- `app/frontend/src/features/story-creation/style-selector/ui/StyleSelectorStep.tsx:25-33` — `onSuccess` 에서 `setFinalIllustrationJobId(response.jobId)`
- `app/frontend/src/features/story-creation/model/useStoryCreationFlow.ts:111` — `finalIllustrationJobId: number | null` state + setter 추가
- `app/frontend/src/pages/creation/CreationPage.tsx` — props drilling: StyleSelectorStep 에 setter, FinalPreviewStep 에 값
- `app/frontend/src/features/story-creation/highlight-outro/api/postStoryboardConfirm.ts` — 응답 타입에 `finalIllustrationJobId?: number` 추가
- `app/frontend/src/features/story-creation/highlight-outro/ui/HighlightOutroStep.tsx:308-321` — confirm 응답이 finalIllustrationJobId 가지면 추가 setter 호출(스타일 보정 상황 대비)
- `app/frontend/src/features/story-creation/final-preview/ui/FinalPreviewStep.tsx:42-87` — `useGenerationJobQuery` 를 두 번 호출, 둘 다 SUCCESS 일 때만 `getScenes/getOutro` 실행

---

## Phase 1 — Backend: Enum, Routing, DTO 기초

### Task 1: JobType enum 에 FINAL_ILLUSTRATION 추가

**Files:**
- Modify: `app/backend/src/main/kotlin/com/s210/backend/domain/job/model/JobType.kt`

- [ ] **Step 1: 변경 전 파일 읽고 현재 enum 값 확인**

```bash
# 현재 enum 항목 (참고용 — 실제 파일을 직접 읽어 확인할 것)
# STORYBOARD, ILLUSTRATION, TTS, BGM, VOICE_CLONE, STORY,
# STORYBOARD_STORY, STORYBOARD_IMAGE, STORYBOARD_STORY_SUMMARY, STORYBOARD_IMAGE_REGENERATE
```

- [ ] **Step 2: enum 마지막에 항목 추가**

기존 `STORYBOARD_IMAGE_REGENERATE,` 뒤에 다음 항목 추가:

```kotlin
    /** Step 5 스타일 선택 직후 백그라운드로 시작되는 최종(컬러) 일러스트 잡. */
    FINAL_ILLUSTRATION,
```

- [ ] **Step 3: 컴파일 확인**

```bash
cd app/backend && ./gradlew compileKotlin
```
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: 커밋**

```bash
git add app/backend/src/main/kotlin/com/s210/backend/domain/job/model/JobType.kt
git commit -m "[BE] feat: JobType.FINAL_ILLUSTRATION 추가 (Step 5 자동 트리거 잡)"
```

---

### Task 2: RoutingKeys 에 FINAL_ILLUSTRATION_GENERATE 추가

**Files:**
- Modify: `app/backend/src/main/kotlin/com/s210/backend/common/mq/RoutingKeys.kt`

- [ ] **Step 1: 파일 읽기**

확인할 것: `IMAGE_GENERATE = "ai.image.generate"` 가 있는 부분.

- [ ] **Step 2: 새 라우팅 키 추가**

`IMAGE_REGENERATE` 라인 다음에 다음 블록 추가:

```kotlin
    // ---------- 최종(컬러) 일러스트 생성 ----------
    // AI 팀 큐 prefix 와 일치 (RABBITMQ_FINAL_ILLUSTRATION_GENERATE_ROUTING_KEY).
    // 워커가 자체적으로 큐(`ai.final-illustration.generate.request.queue`)를 declare/bind.
    const val FINAL_ILLUSTRATION_GENERATE = "ai.image.final-illustration.generate"
```

- [ ] **Step 3: 컴파일 확인**

```bash
cd app/backend && ./gradlew compileKotlin
```
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: 커밋**

```bash
git add app/backend/src/main/kotlin/com/s210/backend/common/mq/RoutingKeys.kt
git commit -m "[BE] feat: FINAL_ILLUSTRATION_GENERATE 라우팅 키 추가"
```

---

### Task 3: BE → AI Publish 메시지 DTO 작성

**Files:**
- Create: `app/backend/src/main/kotlin/com/s210/backend/domain/storyboard/application/dto/FinalIllustrationGenerateMessage.kt`

AI 스키마 (`app/ai/app/schemas/final_illustration.py`, `mq_final_illustration.py`) 와 필드명/타입이 일치해야 함.

- [ ] **Step 1: DTO 파일 생성**

```kotlin
package com.s210.backend.domain.storyboard.application.dto

/**
 * Step 5 PATCH /style 직후 BE 가 AI 로 publish 하는 최종 일러스트 배치 생성 메시지.
 * AI 스키마: FinalIllustrationGenerateJobMessage / FinalIllustrationGenerateRequest.
 *
 * jobId 는 String — AI 측 min_length=1 검증 통과를 위해 Long.toString() 으로 직렬화.
 */
data class FinalIllustrationGenerateMessage(
    val jobId: String,
    val jobType: String = "FINAL_ILLUSTRATION",
    val storyId: Long,
    val payload: FinalIllustrationGeneratePayload,
)

data class FinalIllustrationGeneratePayload(
    val storyId: Long,
    val seed: Int,
    val renderOptions: FinalIllustrationRenderOptions = FinalIllustrationRenderOptions(),
    val items: List<FinalIllustrationItem>,
)

/** AI 측 기본값과 동일 — BE 는 모두 default 를 그대로 보낸다. */
data class FinalIllustrationRenderOptions(
    val aspectRatio: String = "match_input_image",
    val megapixels: String = "1",
    val outputFormat: String = "png",
    val outputQuality: Int = 95,
    val numOutputs: Int = 1,
    val goFast: Boolean = false,
    val safetyTolerance: Int = 2,
    val disableSafetyChecker: Boolean = false,
)

data class FinalIllustrationItem(
    val pageNumber: Int,
    val storyboard: FinalIllustrationContext,
    val page: FinalIllustrationPagePayload,
    val children: List<ChildInfo>,
    val companions: List<String>,
    /**
     * Step 4 에서 생성된 storyboard rough 의 URL.
     * AI 측 model_validator 가 (url|s3Key|currentIllustrationS3Key) 중 하나는 필수.
     */
    val roughStoryboardImageUrl: String?,
    val stylePrompt: String,
    val additionalInstruction: String? = null,
)

data class FinalIllustrationContext(
    val title: String,
    val synopsis: String,
)

data class FinalIllustrationPagePayload(
    val pageNumber: Int,
    val sceneSummary: String,
    val englishText: String,
    val koreanText: String,
    val imagePrompt: String,
)
```

> ChildInfo 는 storyboard 패키지 내 기존 DTO 재사용: `com.s210.backend.domain.storyboard.application.dto.ChildInfo`

- [ ] **Step 2: 컴파일 확인**

```bash
cd app/backend && ./gradlew compileKotlin
```
Expected: BUILD SUCCESSFUL (ChildInfo import 누락 시 실패하면 import 추가)

- [ ] **Step 3: 커밋**

```bash
git add app/backend/src/main/kotlin/com/s210/backend/domain/storyboard/application/dto/FinalIllustrationGenerateMessage.kt
git commit -m "[BE] feat: FINAL_ILLUSTRATION publish DTO 추가 (AI 스키마와 1:1 매칭)"
```

---

### Task 4: AI → BE 결과 envelope 역직렬화 DTO

**Files:**
- Create: `app/backend/src/main/kotlin/com/s210/backend/domain/storyboard/application/dto/FinalIllustrationResultEnvelope.kt`

AI 측 `FinalIllustrationSuccessEnvelope` / `FinalIllustrationFailureEnvelope` 와 1:1 매칭.

- [ ] **Step 1: 파일 생성**

```kotlin
package com.s210.backend.domain.storyboard.application.dto

import tools.jackson.annotation.JsonIgnoreProperties

/**
 * AI 가 publish 하는 최종 일러스트 결과 envelope.
 * AI 는 페이지별로 1개씩 publish 한다 (배치 분할 후).
 * BE 는 routing key `ai.result.final-illustration.generate.completed/failed` 로 받는다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class FinalIllustrationResultEnvelope(
    val jobId: String,
    val type: String,            // GENERATE_FINAL_ILLUSTRATION_COMPLETED / FAILED
    val storyId: Long,
    val pageNumber: Int? = null, // FAILED 일 땐 null 가능
    val status: String,          // COMPLETED / FAILED
    val payload: FinalIllustrationResultPayload? = null,
    val error: FinalIllustrationResultError? = null,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class FinalIllustrationResultPayload(
    val seed: Int,
    val result: FinalIllustrationResultData,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class FinalIllustrationResultData(
    val pageNumber: Int,
    val imageUrl: String,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class FinalIllustrationResultError(
    val code: String,
    val message: String,
)
```

- [ ] **Step 2: 컴파일 확인**

```bash
cd app/backend && ./gradlew compileKotlin
```
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: 커밋**

```bash
git add app/backend/src/main/kotlin/com/s210/backend/domain/storyboard/application/dto/FinalIllustrationResultEnvelope.kt
git commit -m "[BE] feat: FINAL_ILLUSTRATION 결과 envelope DTO 추가"
```

---

## Phase 2 — Backend: Enqueue 서비스

### Task 5: FinalIllustrationGenerationService 작성 (멱등 가드 포함)

**Files:**
- Create: `app/backend/src/main/kotlin/com/s210/backend/domain/storyboard/application/FinalIllustrationGenerationService.kt`

기존 `StoryboardImageGenerationService.generate()` (`StoryboardImageGenerationService.kt:65-159`) 를 미러링하되, **AI 측 max_length=20 items**, **stylePrompt 필수**, **rough URL 필수** 에 주의.

- [ ] **Step 1: 파일 생성**

```kotlin
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
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.preset.infrastructure.repository.StylePresetRepository
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationContext
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationGenerateMessage
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationGeneratePayload
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationItem
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationPagePayload
import com.s210.backend.domain.storyboard.application.dto.StoryboardPayload
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper

/**
 * Step 5 (PATCH /stories/{id}/style) 시점에 호출되는 최종 컬러 일러스트 enqueue.
 * - 사용자가 보이스 클론 / 강조 녹음(Step 6,7) 진행 동안 AI 가 백그라운드로 미리 생성.
 * - Step 8 FinalPreviewStep 에서 TTS 와 함께 두 잡 모두 SUCCESS 시 표시.
 *
 * 입력:
 *   - storyboard_pages 의 각 페이지 텍스트 + image_url(rough URL, AI reference)
 *   - 마지막 SUCCESS STORY 잡의 영문 title/synopsis
 *   - story.stylePresetId → StylePreset.code (stylePrompt)
 *
 * 멱등 가드: 같은 stylePresetId 면서 직전 FINAL 잡이 PENDING/RUNNING/SUCCESS 면 enqueue 스킵하고 기존 jobId 반환.
 */
@Service
@Transactional
class FinalIllustrationGenerationService(
    private val storyRepository: StoryRepository,
    private val stylePresetRepository: StylePresetRepository,
    private val storyBoardRepository: StoryBoardRepository,
    private val storyboardPageRepository: StoryboardPageRepository,
    private val jobRepository: StoryGenerationJobRepository,
    private val rabbitTemplate: RabbitTemplate,
    private val objectMapper: ObjectMapper,
    private val storyParticipantParser: StoryParticipantParser,
) {

    /**
     * @return enqueue 된 (또는 재사용된) 잡 id
     */
    fun enqueue(storyId: Long, stylePresetId: Long): Long {
        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.deletedAt != null) throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)

        // 1) 멱등 가드: 같은 stylePresetId 의 직전 FINAL 잡이 살아있으면 그 jobId 재사용.
        //    requestPayload 안에 stylePresetId 가 들어가므로 그걸로 비교.
        val existing = findReusableJob(storyId, stylePresetId)
        if (existing != null) return existing.id

        val stylePreset = stylePresetRepository.findById(stylePresetId).orElseThrow {
            BusinessException(StoryErrorCode.STYLE_PRESET_NOT_FOUND)
        }

        // 2) storyboard_pages 가 채워져 있어야 한다 (Step 4 STORYBOARD_IMAGE 가 끝났어야 image_url 존재).
        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val pages = storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(storyBoard.id)
        if (pages.isEmpty()) throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        if (pages.any { it.imageUrl.isNullOrBlank() }) {
            // Step 5 진입 시점에 모든 페이지 image_url 이 있어야 함.
            throw BusinessException(StoryErrorCode.STORYBOARD_IMAGES_NOT_READY)
        }

        // 3) STORY 잡에서 영문 title/synopsis 재사용.
        val storyPayload = loadLastSuccessStoryPayload(storyId)

        // 4) 등장인물 / 동행자 파싱.
        val children = storyParticipantParser.parseChildren(story.mainCharacterJson)
        if (children.isEmpty()) throw BusinessException(CommonErrorCode.INVALID_INPUT)
        val companions = storyParticipantParser.parseCompanions(story.companionsJson)

        // 5) 페이지별 item 조립.
        val items = pages.map { page ->
            val sceneSummary = page.sceneSummary?.takeIf { it.isNotBlank() }
                ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
            val englishText = page.englishText?.takeIf { it.isNotBlank() }
                ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
            val koreanText = page.koreanText?.takeIf { it.isNotBlank() }
                ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
            val imagePrompt = page.imagePrompt?.takeIf { it.isNotBlank() }
                ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

            FinalIllustrationItem(
                pageNumber = page.pageNumber,
                storyboard = FinalIllustrationContext(
                    title = storyPayload.title,
                    synopsis = storyPayload.synopsis,
                ),
                page = FinalIllustrationPagePayload(
                    pageNumber = page.pageNumber,
                    sceneSummary = sceneSummary,
                    englishText = englishText,
                    koreanText = koreanText,
                    imagePrompt = imagePrompt,
                ),
                children = children,
                companions = companions,
                roughStoryboardImageUrl = page.imageUrl,
                stylePrompt = stylePreset.code,
                additionalInstruction = null,
            )
        }

        // 6) AI 측 max_length=20 가드.
        if (items.size > MAX_ITEMS) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }

        val seed = deterministicSeed(storyId)
        val payload = FinalIllustrationGeneratePayload(
            storyId = storyId,
            seed = seed,
            items = items,
        )

        // 7) Job INSERT.
        val job = jobRepository.save(
            StoryGenerationJob(
                storyId = storyId,
                jobType = JobType.FINAL_ILLUSTRATION,
                status = JobStatus.PENDING,
                requestPayload = objectMapper.writeValueAsString(
                    mapOf(
                        "stylePresetId" to stylePresetId,
                        "payload" to payload,
                    ),
                ),
            ),
        )

        // 8) MQ publish.
        val envelope = FinalIllustrationGenerateMessage(
            jobId = job.id.toString(),
            storyId = storyId,
            payload = payload,
        )
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.FINAL_ILLUSTRATION_GENERATE,
            envelope,
        )

        return job.id
    }

    /**
     * 멱등 가드:
     *  - 같은 storyId + JobType.FINAL_ILLUSTRATION 으로 최근 잡 조회
     *  - 상태가 PENDING/RUNNING/SUCCESS 이고 requestPayload.stylePresetId 가 같으면 재사용
     *  - FAILED / CANCELLED 또는 stylePresetId 가 다르면 새로 enqueue
     */
    private fun findReusableJob(storyId: Long, stylePresetId: Long): StoryGenerationJob? {
        val recent = jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(
            storyId, JobType.FINAL_ILLUSTRATION,
        ) ?: return null
        if (recent.status !in REUSABLE_STATUSES) return null
        val savedStylePresetId = try {
            val node = objectMapper.readTree(recent.requestPayload)
            node.get("stylePresetId")?.asLong() ?: return null
        } catch (e: Exception) {
            return null
        }
        return if (savedStylePresetId == stylePresetId) recent else null
    }

    private fun loadLastSuccessStoryPayload(storyId: Long): StoryboardPayload {
        val storyJob = jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
            storyId = storyId,
            jobType = JobType.STORYBOARD_STORY,
            status = JobStatus.SUCCESS,
        ) ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val resultPayloadJson = storyJob.resultPayload
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        return try {
            objectMapper.readValue(resultPayloadJson, StoryboardPayload::class.java)
        } catch (e: Exception) {
            throw BusinessException(CommonErrorCode.INTERNAL_SERVER_ERROR)
        }
    }

    private fun deterministicSeed(storyId: Long): Int =
        ((storyId * 2654435761L) and 0x7FFFFFFFL).toInt()

    companion object {
        private const val MAX_ITEMS = 20  // AI 측 FinalIllustrationGenerateRequest.items max_length
        private val REUSABLE_STATUSES = setOf(JobStatus.PENDING, JobStatus.RUNNING, JobStatus.SUCCESS)
    }
}
```

- [ ] **Step 2: 의존 항목 확인**
  - `StoryErrorCode.STYLE_PRESET_NOT_FOUND` 가 이미 존재하는지 확인. 없으면 추가.
  - `StoryErrorCode.STORYBOARD_IMAGES_NOT_READY` 가 없으면 다음을 추가:

```kotlin
// StoryErrorCode 에 추가
STORYBOARD_IMAGES_NOT_READY(HttpStatus.CONFLICT, "STORYBOARD_IMAGES_NOT_READY", "스토리보드 이미지가 아직 모두 준비되지 않았습니다."),
```

  - `StoryGenerationJobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc` 메서드가 없으면 추가.

- [ ] **Step 3: 컴파일 확인**

```bash
cd app/backend && ./gradlew compileKotlin
```
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: 커밋**

```bash
git add app/backend/src/main/kotlin/com/s210/backend/domain/storyboard/application/FinalIllustrationGenerationService.kt
git add app/backend/src/main/kotlin/com/s210/backend/domain/story/exception/StoryErrorCode.kt
git add app/backend/src/main/kotlin/com/s210/backend/domain/job/infrastructure/repository/StoryGenerationJobRepository.kt
git commit -m "[BE] feat: FinalIllustrationGenerationService — Step 5 자동 enqueue + 멱등 가드"
```

---

### Task 6: FinalIllustrationGenerationService 단위 테스트

**Files:**
- Create: `app/backend/src/test/kotlin/com/s210/backend/domain/storyboard/application/FinalIllustrationGenerationServiceTest.kt`

테스트 대상: enqueue 성공 경로, 멱등 가드(같은 stylePresetId 면 재사용 / 다르면 신규), storyboard image 미준비 시 거부, max_items 초과 거부.

- [ ] **Step 1: 실패 테스트 작성 (TDD: 멱등 재사용)**

```kotlin
package com.s210.backend.domain.storyboard.application

// imports 생략 — 기존 다른 service 테스트 파일 참고

@SpringBootTest
@Transactional
class FinalIllustrationGenerationServiceTest {

    @Autowired private lateinit var sut: FinalIllustrationGenerationService
    @Autowired private lateinit var jobRepository: StoryGenerationJobRepository
    // ... fixture builder autowire (기존 테스트의 fixture util 활용)

    @Test
    fun `같은 stylePresetId 로 두 번 호출하면 두 번째는 기존 jobId 를 재사용한다`() {
        val story = givenStoryWithStoryboardImagesReady()
        val styleId = givenStylePreset().id

        val firstJobId = sut.enqueue(story.id, styleId)
        val secondJobId = sut.enqueue(story.id, styleId)

        assertThat(secondJobId).isEqualTo(firstJobId)
        val jobCount = jobRepository.countByStoryIdAndJobType(story.id, JobType.FINAL_ILLUSTRATION)
        assertThat(jobCount).isEqualTo(1L)
    }
}
```

- [ ] **Step 2: 테스트 실행하여 실패 확인 (이미 구현됐을 수 있으니 우선 돌려본다)**

```bash
cd app/backend && ./gradlew test --tests FinalIllustrationGenerationServiceTest.같은*
```
Expected: PASS (실제 enqueue 가 멱등 가드로 작동) — 만약 FAIL 이면 Task 5 의 가드 로직 재확인.

- [ ] **Step 3: 추가 케이스 — 다른 stylePresetId 호출 시 신규 잡**

```kotlin
@Test
fun `다른 stylePresetId 로 호출하면 새 잡을 생성한다`() {
    val story = givenStoryWithStoryboardImagesReady()
    val styleA = givenStylePreset(code = "WATERCOLOR").id
    val styleB = givenStylePreset(code = "PIXEL").id

    val jobA = sut.enqueue(story.id, styleA)
    val jobB = sut.enqueue(story.id, styleB)

    assertThat(jobB).isNotEqualTo(jobA)
}
```

- [ ] **Step 4: storyboard image 미준비 시 거부**

```kotlin
@Test
fun `storyboard_pages 중 하나라도 image_url 이 비어 있으면 거부한다`() {
    val story = givenStoryWithMissingStoryboardImage()
    val styleId = givenStylePreset().id

    assertThatThrownBy { sut.enqueue(story.id, styleId) }
        .isInstanceOf(BusinessException::class.java)
        .hasMessageContaining("STORYBOARD_IMAGES_NOT_READY")
}
```

- [ ] **Step 5: 모든 테스트 실행**

```bash
cd app/backend && ./gradlew test --tests FinalIllustrationGenerationServiceTest
```
Expected: ALL PASS

- [ ] **Step 6: 커밋**

```bash
git add app/backend/src/test/kotlin/com/s210/backend/domain/storyboard/application/FinalIllustrationGenerationServiceTest.kt
git commit -m "[BE] test: FinalIllustrationGenerationService 멱등/검증 테스트"
```

---

## Phase 3 — Backend: PATCH /style 핸들러 + 응답 DTO

### Task 7: StyleModifyResponse DTO 생성

**Files:**
- Create: `app/backend/src/main/kotlin/com/s210/backend/domain/story/presentation/response/StyleModifyResponse.kt`

- [ ] **Step 1: 파일 생성**

```kotlin
package com.s210.backend.domain.story.presentation.response

/**
 * PATCH /api/stories/{storyId}/style 응답.
 * jobId 는 Step 5 직후 백그라운드로 enqueue 된 FINAL_ILLUSTRATION 잡의 id.
 * FE 는 이 jobId 를 store 에 저장해두었다가 Step 8 에서 폴링한다.
 */
data class StyleModifyResponse(
    val finalIllustrationJobId: Long,
)
```

- [ ] **Step 2: 컴파일 확인**

```bash
cd app/backend && ./gradlew compileKotlin
```

- [ ] **Step 3: 커밋**

```bash
git add app/backend/src/main/kotlin/com/s210/backend/domain/story/presentation/response/StyleModifyResponse.kt
git commit -m "[BE] feat: StyleModifyResponse DTO 추가"
```

---

### Task 8: StoryService.modifyStyle → enqueue 호출 + jobId 반환

**Files:**
- Modify: `app/backend/src/main/kotlin/com/s210/backend/domain/story/application/StoryService.kt:351-357`

- [ ] **Step 1: StoryService 에 의존 추가**

`StoryService` 생성자에 `private val finalIllustrationGenerationService: FinalIllustrationGenerationService` 추가.

- [ ] **Step 2: modifyStyle 시그니처 및 본문 변경**

기존:

```kotlin
fun modifyStyle(userId: Long, storyId: Long, stylePresetId: Long) {
    val story = ownedStory(userId, storyId)
    if (!stylePresetRepository.existsById(stylePresetId)) {
        throw BusinessException(StoryErrorCode.STYLE_PRESET_NOT_FOUND)
    }
    story.stylePresetId = stylePresetId
}
```

변경 후:

```kotlin
/**
 * @return Step 5 직후 백그라운드 enqueue 된 FINAL_ILLUSTRATION 잡 id (멱등 가드 시 기존 jobId).
 */
fun modifyStyle(userId: Long, storyId: Long, stylePresetId: Long): Long {
    val story = ownedStory(userId, storyId)
    if (!stylePresetRepository.existsById(stylePresetId)) {
        throw BusinessException(StoryErrorCode.STYLE_PRESET_NOT_FOUND)
    }
    story.stylePresetId = stylePresetId
    // story 트랜잭션 commit 후 enqueue 하고 싶다면 여기서 바로 호출 가능 (Service 가 별도 @Transactional).
    // FinalIllustrationGenerationService 는 별도 Tx — 호출 즉시 IN PROGRESS 상태가 만들어진다.
    return finalIllustrationGenerationService.enqueue(storyId, stylePresetId)
}
```

- [ ] **Step 3: 컴파일 확인**

```bash
cd app/backend && ./gradlew compileKotlin
```

- [ ] **Step 4: 기존 modifyStyle 호출부 컴파일 에러 수정**
  - 기존에 `Unit` 반환을 기대하던 호출자(SceneController) 가 다음 Task 에서 수정됨.

- [ ] **Step 5: 커밋**

```bash
git add app/backend/src/main/kotlin/com/s210/backend/domain/story/application/StoryService.kt
git commit -m "[BE] feat: modifyStyle 이 FINAL_ILLUSTRATION 자동 enqueue 후 jobId 반환"
```

---

### Task 9: SceneController PATCH /style 응답 변경

**Files:**
- Modify: `app/backend/src/main/kotlin/com/s210/backend/domain/story/presentation/SceneController.kt:138-146`

- [ ] **Step 1: 핸들러 변경**

기존:

```kotlin
@PatchMapping("/style")
fun storyStyleModify(
    @PathVariable storyId: Long,
    @RequestBody request: StyleModifyRequest,
    @AuthenticationPrincipal user: CustomUser,
): ResponseEntity<ApiResponse<Unit>> {
    storyService.modifyStyle(user.userId, storyId, request.stylePresetId)
    return ResponseEntity.ok(ApiResponse(data = null))
}
```

변경 후:

```kotlin
@PatchMapping("/style")
fun storyStyleModify(
    @PathVariable storyId: Long,
    @RequestBody request: StyleModifyRequest,
    @AuthenticationPrincipal user: CustomUser,
): ResponseEntity<ApiResponse<StyleModifyResponse>> {
    val jobId = storyService.modifyStyle(user.userId, storyId, request.stylePresetId)
    return ResponseEntity.ok(ApiResponse(data = StyleModifyResponse(finalIllustrationJobId = jobId)))
}
```

- [ ] **Step 2: import 추가**

```kotlin
import com.s210.backend.domain.story.presentation.response.StyleModifyResponse
```

- [ ] **Step 3: 컴파일 확인**

```bash
cd app/backend && ./gradlew compileKotlin
```

- [ ] **Step 4: 통합 테스트로 응답 형태 확인**

기존 `SceneControllerTest` 등에 PATCH /style 케이스가 있다면 응답 데이터에 `finalIllustrationJobId` 가 있는지 검증하도록 수정. 없다면 신규 작성:

```kotlin
@Test
fun `PATCH style 응답에 finalIllustrationJobId 가 포함된다`() {
    val storyId = givenStoryWithStoryboardImagesReady().id
    val styleId = givenStylePreset().id
    mockMvc.perform(
        patch("/api/stories/$storyId/style")
            .with(authUser(userId))
            .contentType(MediaType.APPLICATION_JSON)
            .content("""{"stylePresetId":$styleId}""")
    )
        .andExpect(status().isOk)
        .andExpect(jsonPath("$.data.finalIllustrationJobId").isNumber)
}
```

- [ ] **Step 5: 테스트 실행**

```bash
cd app/backend && ./gradlew test --tests SceneControllerTest
```

- [ ] **Step 6: 커밋**

```bash
git add app/backend/src/main/kotlin/com/s210/backend/domain/story/presentation/SceneController.kt
git add app/backend/src/test/kotlin/com/s210/backend/domain/story/presentation/SceneControllerTest.kt
git commit -m "[BE] feat: PATCH /stories/{id}/style 응답에 finalIllustrationJobId 포함"
```

---

## Phase 4 — Backend: AI 결과 콜백 처리

### Task 10: FinalIllustrationResultListener 작성

**Files:**
- Create: `app/backend/src/main/kotlin/com/s210/backend/domain/storyboard/application/FinalIllustrationResultListener.kt`

기존 `StoryboardResultListener` 와 동일한 RESULT_QUEUE 를 구독한다 — 단, type 이 `GENERATE_FINAL_ILLUSTRATION_*` 인 메시지만 처리.

> **주의:** 기존 `StoryboardResultListener.onResult` 가 모든 결과 envelope 를 받기 때문에 새 type 을 추가만 해도 된다. 별도 `@RabbitListener` 를 만들면 같은 큐를 두 컴포넌트가 병렬 컨슘하므로 파일은 분리하되 진입점은 기존 listener 의 `when (type)` 분기에 케이스 추가하는 방식을 권장.

- [ ] **Step 1: 우선 기존 `StoryboardResultListener` 의 type 분기 위치를 확인**

```bash
grep -n "GENERATE_STORYBOARD_IMAGE_COMPLETED" app/backend/src/main/kotlin/com/s210/backend/domain/storyboard/application/StoryboardResultListener.kt
```

확인된 분기 블록(예: line 108-145) 에 `GENERATE_FINAL_ILLUSTRATION_COMPLETED` / `GENERATE_FINAL_ILLUSTRATION_FAILED` 케이스 추가하고, 처리 본체는 신규 `FinalIllustrationResultHandler` 컴포넌트로 위임.

- [ ] **Step 2: FinalIllustrationResultHandler 신규 컴포넌트 작성**

```kotlin
package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationResultEnvelope
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper

/**
 * AI 가 보낸 최종 일러스트 페이지 단위 결과를 처리.
 *
 * 누적 정책:
 *  - 페이지가 N장이면 AI 가 N번 publish (페이지별 1개씩) → 매 메시지마다 resultPayload 누적 갱신
 *  - 모든 페이지 도착 시 status = SUCCESS
 *  - scenes 가 이미 INSERT 된 상태라면(드물지만) 즉시 illustration_url 도 UPDATE
 *  - confirm 시점이 결과보다 먼저면 confirm 핸들러가 resultPayload 에서 꺼내 INSERT
 */
@Component
@Transactional
class FinalIllustrationResultHandler(
    private val jobRepository: StoryGenerationJobRepository,
    private val sceneRepository: SceneRepository,
    private val objectMapper: ObjectMapper,
) {

    fun handleSuccess(envelope: FinalIllustrationResultEnvelope) {
        val jobId = envelope.jobId.toLongOrNull()
            ?: throw BusinessException(CommonErrorCode.INVALID_INPUT)
        val job = jobRepository.findById(jobId).orElseThrow {
            BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        }
        val pageNumber = envelope.pageNumber
            ?: throw BusinessException(CommonErrorCode.INVALID_INPUT)
        val imageUrl = envelope.payload?.result?.imageUrl
            ?: throw BusinessException(CommonErrorCode.INVALID_INPUT)

        // 1) resultPayload 누적 (Map<pageNumber, imageUrl>).
        val accumulator = readAccumulator(job)
        accumulator[pageNumber] = imageUrl
        job.resultPayload = objectMapper.writeValueAsString(accumulator)
        job.status = if (accumulator.size >= expectedPageCount(job)) JobStatus.SUCCESS else JobStatus.RUNNING

        // 2) scenes 가 이미 있으면 즉시 update (confirm 이 먼저 일어난 케이스).
        sceneRepository.findByStoryIdAndPageNumber(job.storyId, pageNumber)?.let { scene ->
            scene.illustrationUrl = imageUrl
        }
    }

    fun handleFailure(envelope: FinalIllustrationResultEnvelope) {
        val jobId = envelope.jobId.toLongOrNull()
            ?: throw BusinessException(CommonErrorCode.INVALID_INPUT)
        val job = jobRepository.findById(jobId).orElse(null) ?: return
        job.status = JobStatus.FAILED
        job.errorMessage = (envelope.error?.message ?: "FINAL_ILLUSTRATION_FAILED").take(65_000)
    }

    private fun readAccumulator(job: StoryGenerationJob): MutableMap<Int, String> {
        val raw = job.resultPayload ?: return mutableMapOf()
        return try {
            val node = objectMapper.readTree(raw)
            if (!node.isObject) mutableMapOf()
            else node.fieldNames().asSequence().associate { it.toInt() to node.get(it).asText() }.toMutableMap()
        } catch (e: Exception) {
            mutableMapOf()
        }
    }

    private fun expectedPageCount(job: StoryGenerationJob): Int {
        return try {
            val req = objectMapper.readTree(job.requestPayload)
            req.path("payload").path("items").size()
        } catch (e: Exception) {
            Int.MAX_VALUE
        }
    }
}
```

- [ ] **Step 3: 기존 StoryboardResultListener 의 onResult when (type) 블록에 분기 추가**

```kotlin
"GENERATE_FINAL_ILLUSTRATION_COMPLETED" -> {
    val env = objectMapper.readValue(body, FinalIllustrationResultEnvelope::class.java)
    finalIllustrationResultHandler.handleSuccess(env)
}
"GENERATE_FINAL_ILLUSTRATION_FAILED" -> {
    val env = objectMapper.readValue(body, FinalIllustrationResultEnvelope::class.java)
    finalIllustrationResultHandler.handleFailure(env)
}
```

생성자에 `private val finalIllustrationResultHandler: FinalIllustrationResultHandler` 추가.

- [ ] **Step 4: SceneRepository 에 `findByStoryIdAndPageNumber` 가 없으면 추가**

```kotlin
fun findByStoryIdAndPageNumber(storyId: Long, pageNumber: Int): Scene?
```

- [ ] **Step 5: 컴파일 확인**

```bash
cd app/backend && ./gradlew compileKotlin
```

- [ ] **Step 6: 커밋**

```bash
git add app/backend/src/main/kotlin/com/s210/backend/domain/storyboard/application/FinalIllustrationResultHandler.kt
git add app/backend/src/main/kotlin/com/s210/backend/domain/storyboard/application/StoryboardResultListener.kt
git add app/backend/src/main/kotlin/com/s210/backend/domain/story/infrastructure/repository/SceneRepository.kt
git commit -m "[BE] feat: FinalIllustrationResultHandler — AI 결과 누적 + scenes 즉시 update"
```

---

### Task 11: ResultHandler 단위 테스트

**Files:**
- Create: `app/backend/src/test/kotlin/com/s210/backend/domain/storyboard/application/FinalIllustrationResultHandlerTest.kt`

- [ ] **Step 1: 테스트 작성**

```kotlin
@SpringBootTest
@Transactional
class FinalIllustrationResultHandlerTest {

    @Autowired private lateinit var sut: FinalIllustrationResultHandler
    @Autowired private lateinit var jobRepository: StoryGenerationJobRepository

    @Test
    fun `페이지가 N장 모두 도착하면 status SUCCESS, 그전엔 RUNNING`() {
        val job = givenPendingFinalJob(storyId = 1L, pageCount = 3)

        sut.handleSuccess(envelopeFor(jobId = job.id, page = 1, url = "https://s3/p1.png"))
        assertThat(jobRepository.findById(job.id).get().status).isEqualTo(JobStatus.RUNNING)

        sut.handleSuccess(envelopeFor(jobId = job.id, page = 2, url = "https://s3/p2.png"))
        assertThat(jobRepository.findById(job.id).get().status).isEqualTo(JobStatus.RUNNING)

        sut.handleSuccess(envelopeFor(jobId = job.id, page = 3, url = "https://s3/p3.png"))
        assertThat(jobRepository.findById(job.id).get().status).isEqualTo(JobStatus.SUCCESS)
    }

    @Test
    fun `이미 scenes 가 INSERT 되어 있으면 illustration_url 즉시 update`() {
        val story = givenConfirmedStory(pageCount = 2)
        val job = givenPendingFinalJob(storyId = story.id, pageCount = 2)

        sut.handleSuccess(envelopeFor(jobId = job.id, page = 1, url = "https://s3/final-1.png"))

        val scene = sceneRepository.findByStoryIdAndPageNumber(story.id, 1)
        assertThat(scene!!.illustrationUrl).isEqualTo("https://s3/final-1.png")
    }

    @Test
    fun `FAILED envelope 받으면 status 와 errorMessage 갱신`() {
        val job = givenPendingFinalJob(storyId = 1L, pageCount = 2)
        sut.handleFailure(failEnvelopeFor(jobId = job.id, code = "AI_TIMEOUT", message = "model timeout"))
        val updated = jobRepository.findById(job.id).get()
        assertThat(updated.status).isEqualTo(JobStatus.FAILED)
        assertThat(updated.errorMessage).contains("model timeout")
    }
}
```

- [ ] **Step 2: 테스트 실행**

```bash
cd app/backend && ./gradlew test --tests FinalIllustrationResultHandlerTest
```
Expected: ALL PASS

- [ ] **Step 3: 커밋**

```bash
git add app/backend/src/test/kotlin/com/s210/backend/domain/storyboard/application/FinalIllustrationResultHandlerTest.kt
git commit -m "[BE] test: FinalIllustrationResultHandler 누적/즉시update/실패 시나리오"
```

---

## Phase 5 — Backend: confirm 시 final 결과 우선 사용

### Task 12: StoryConfirmService — Scene INSERT 시 FINAL 결과 적용

**Files:**
- Modify: `app/backend/src/main/kotlin/com/s210/backend/domain/story/application/StoryConfirmService.kt:130-157` (Scene INSERT 블록)
- Modify: `app/backend/src/main/kotlin/com/s210/backend/domain/story/application/dto/ConfirmStoryboardResponse.kt` (또는 inline 정의 위치)

- [ ] **Step 1: ConfirmStoryboardResponse 에 finalIllustrationJobId 필드 추가**

기존 응답 DTO 에 다음 필드 추가:

```kotlin
val finalIllustrationJobId: Long? = null,
```

- [ ] **Step 2: confirmStoryboard() 의 Scene INSERT 직전에 FINAL 잡 결과 로드**

기존 (대략):

```kotlin
val scenes = pages.map { page ->
    Scene(
        storyId = storyId,
        pageNumber = page.pageNumber,
        illustrationUrl = page.imageUrl,
        characterAnchors = null,
    )
}
```

변경 후:

```kotlin
// 최신 FINAL_ILLUSTRATION 잡의 결과(있으면) 로드.
val latestFinalJob = jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(
    storyId, JobType.FINAL_ILLUSTRATION,
)
val finalUrlsByPage: Map<Int, String> = latestFinalJob
    ?.takeIf { it.status == JobStatus.SUCCESS || it.status == JobStatus.RUNNING }
    ?.resultPayload
    ?.let { runCatching { parseFinalUrlMap(it) }.getOrNull() }
    ?: emptyMap()

val scenes = pages.map { page ->
    Scene(
        storyId = storyId,
        pageNumber = page.pageNumber,
        illustrationUrl = finalUrlsByPage[page.pageNumber] ?: page.imageUrl,
        characterAnchors = null,
    )
}
```

> `parseFinalUrlMap` 는 `Map<Int,String>` 반환 헬퍼 — `objectMapper.readTree(json).fields().asSequence().associate { it.key.toInt() to it.value.asText() }`

- [ ] **Step 3: 응답 빌드 시 finalIllustrationJobId 포함**

```kotlin
return ConfirmStoryboardResponse(
    jobId = ttsJob.id,
    jobType = "TTS",
    status = ttsJob.status.name,
    sceneCount = scenes.size,
    sentenceCount = totalSentences,
    finalIllustrationJobId = latestFinalJob?.id,
    // ... 기존 필드
)
```

- [ ] **Step 4: 컴파일 확인**

```bash
cd app/backend && ./gradlew compileKotlin
```

- [ ] **Step 5: 통합 테스트로 검증**

```kotlin
@Test
fun `confirm 시 FINAL 잡이 SUCCESS 면 Scene illustrationUrl 이 final 결과로 채워진다`() {
    val story = givenStoryReadyForConfirm()
    val finalJob = givenSucceededFinalJob(story.id, mapOf(1 to "https://s3/f1.png", 2 to "https://s3/f2.png"))

    val response = storyConfirmService.confirmStoryboard(userId, story.id)

    val scenes = sceneRepository.findAllByStoryIdOrderByPageNumberAsc(story.id)
    assertThat(scenes[0].illustrationUrl).isEqualTo("https://s3/f1.png")
    assertThat(scenes[1].illustrationUrl).isEqualTo("https://s3/f2.png")
    assertThat(response.finalIllustrationJobId).isEqualTo(finalJob.id)
}

@Test
fun `confirm 시 FINAL 잡이 아직 RUNNING 이면 Scene illustrationUrl 은 storyboard rough 로 일단 채우고 FINAL 콜백이 나중에 update`() {
    val story = givenStoryReadyForConfirm()
    val finalJob = givenRunningFinalJob(story.id)  // 아직 결과 없음

    storyConfirmService.confirmStoryboard(userId, story.id)
    val scenes = sceneRepository.findAllByStoryIdOrderByPageNumberAsc(story.id)
    // 일단 storyboard rough 가 들어감
    assertThat(scenes[0].illustrationUrl).contains("storyboard")

    // 이후 FINAL 콜백 도착 → handler 가 Scene 도 update
    finalIllustrationResultHandler.handleSuccess(envelopeFor(finalJob.id, 1, "https://s3/late.png"))
    val updated = sceneRepository.findByStoryIdAndPageNumber(story.id, 1)
    assertThat(updated!!.illustrationUrl).isEqualTo("https://s3/late.png")
}
```

- [ ] **Step 6: 테스트 실행**

```bash
cd app/backend && ./gradlew test --tests StoryConfirmServiceTest
```

- [ ] **Step 7: 커밋**

```bash
git add app/backend/src/main/kotlin/com/s210/backend/domain/story/application/StoryConfirmService.kt
git add app/backend/src/main/kotlin/com/s210/backend/domain/story/application/dto/ConfirmStoryboardResponse.kt
git add app/backend/src/test/kotlin/com/s210/backend/domain/story/application/StoryConfirmServiceTest.kt
git commit -m "[BE] feat: confirm 시 FINAL_ILLUSTRATION 결과 우선 적용 + 응답에 jobId 포함"
```

---

## Phase 6 — Frontend: API 타입 + Store 확장

### Task 13: patchStoryStyle 응답 타입 변경

**Files:**
- Modify: `app/frontend/src/features/story-creation/style-selector/api/patchStoryStyle.ts`

- [ ] **Step 1: 응답 타입 정의**

```typescript
export interface StylePatchResponse {
  finalIllustrationJobId: number
}

export function patchStoryStyle(
  storyId: number,
  stylePresetId: number,
): Promise<StylePatchResponse> {
  return patch<StylePatchResponse>(`/stories/${storyId}/style`, { stylePresetId })
}
```

- [ ] **Step 2: feature 의 index.ts 가 `StylePatchResponse` 를 노출하지 않는지 확인 (내부 타입은 노출 안 함이 원칙)**

- [ ] **Step 3: 타입 체크**

```bash
cd app/frontend && pnpm tsc --noEmit
```
Expected: 새 호출자에서 타입 변경에 따른 에러 발생 가능 (다음 Task 에서 수정).

- [ ] **Step 4: 커밋**

```bash
git add app/frontend/src/features/story-creation/style-selector/api/patchStoryStyle.ts
git commit -m "[FE] feat: patchStoryStyle 응답 타입 → StylePatchResponse (jobId 포함)"
```

---

### Task 14: useStoryStylePatch 훅 반환 타입 반영

**Files:**
- Modify: `app/frontend/src/features/story-creation/style-selector/model/useStoryStylePatch.ts`

- [ ] **Step 1: 훅 수정**

```typescript
import { useMutation } from '@tanstack/react-query'
import { patchStoryStyle, type StylePatchResponse } from '../api/patchStoryStyle'

export function useStoryStylePatch(storyId: number | null) {
  return useMutation<StylePatchResponse, Error, number>({
    mutationFn: (stylePresetId: number) => {
      if (storyId === null) return Promise.reject(new Error('storyId is null'))
      return patchStoryStyle(storyId, stylePresetId)
    },
  })
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd app/frontend && pnpm tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
git add app/frontend/src/features/story-creation/style-selector/model/useStoryStylePatch.ts
git commit -m "[FE] feat: useStoryStylePatch 반환 타입을 StylePatchResponse 로"
```

---

### Task 15: useStoryCreationFlow 에 finalIllustrationJobId state 추가

**Files:**
- Modify: `app/frontend/src/features/story-creation/model/useStoryCreationFlow.ts:111` 부근 (state 정의), 320 부근 (setter)

- [ ] **Step 1: 기존 storyGenerationJobId 옆에 finalIllustrationJobId 추가**

state 정의:

```typescript
const [storyGenerationJobId, setStoryGenerationJobId] = useState<number | null>(null)
const [finalIllustrationJobId, setFinalIllustrationJobId] = useState<number | null>(null)
```

return 객체에 두 개 다 노출:

```typescript
return {
  // ... 기존 필드
  storyGenerationJobId,
  setStoryGenerationJobId,
  finalIllustrationJobId,
  setFinalIllustrationJobId,
  // ...
}
```

- [ ] **Step 2: useStoryCreationFlow 의 reset/clear 헬퍼가 있다면 finalIllustrationJobId 도 null 로**

- [ ] **Step 3: 타입 체크**

```bash
cd app/frontend && pnpm tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add app/frontend/src/features/story-creation/model/useStoryCreationFlow.ts
git commit -m "[FE] feat: useStoryCreationFlow 에 finalIllustrationJobId state 추가"
```

---

### Task 16: StyleSelectorStep 에서 jobId 받아 store 저장

**Files:**
- Modify: `app/frontend/src/features/story-creation/style-selector/ui/StyleSelectorStep.tsx:25-33`

- [ ] **Step 1: props 에 setFinalIllustrationJobId 추가**

```typescript
interface StyleSelectorStepProps {
  storyId: number | null
  // ... 기존 props
  setFinalIllustrationJobId: (jobId: number) => void
  onNext: () => void
}
```

- [ ] **Step 2: handleNext / mutate onSuccess 에서 jobId 저장**

기존:

```typescript
stylePatch.mutate(selected.id, { onSuccess: () => onNext() })
```

변경:

```typescript
stylePatch.mutate(selected.id, {
  onSuccess: (response) => {
    setFinalIllustrationJobId(response.finalIllustrationJobId)
    onNext()
  },
})
```

- [ ] **Step 3: 타입 체크**

```bash
cd app/frontend && pnpm tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add app/frontend/src/features/story-creation/style-selector/ui/StyleSelectorStep.tsx
git commit -m "[FE] feat: Step 5 에서 PATCH /style 응답의 jobId 를 store 에 저장"
```

---

### Task 17: CreationPage props drilling

**Files:**
- Modify: `app/frontend/src/pages/creation/CreationPage.tsx`

- [ ] **Step 1: useStoryCreationFlow 에서 새 state/setter 구조분해**

```typescript
const flow = useStoryCreationFlow(...)
// flow.finalIllustrationJobId, flow.setFinalIllustrationJobId 사용 가능
```

- [ ] **Step 2: StyleSelectorStep 렌더 부분에 setter 전달**

```tsx
<StyleSelectorStep
  storyId={flow.storyId}
  // ... 기존 props
  setFinalIllustrationJobId={flow.setFinalIllustrationJobId}
  onNext={flow.next}
/>
```

- [ ] **Step 3: FinalPreviewStep 렌더 부분에 finalIllustrationJobId 전달**

```tsx
<FinalPreviewStep
  storyId={flow.storyId}
  storyGenerationJobId={flow.storyGenerationJobId}
  finalIllustrationJobId={flow.finalIllustrationJobId}  // ← 추가
  // ... 기존 props
/>
```

- [ ] **Step 4: 타입 체크**

```bash
cd app/frontend && pnpm tsc --noEmit
```

- [ ] **Step 5: 커밋**

```bash
git add app/frontend/src/pages/creation/CreationPage.tsx
git commit -m "[FE] feat: CreationPage finalIllustrationJobId props drilling"
```

---

## Phase 7 — Frontend: confirm 응답 + 이중 폴링

### Task 18: confirmStoryboard 응답 타입에 finalIllustrationJobId 추가

**Files:**
- Modify: `app/frontend/src/features/story-creation/highlight-outro/api/postStoryboardConfirm.ts`

- [ ] **Step 1: 응답 타입 확장**

```typescript
export interface ConfirmStoryboardResponse {
  jobId: number
  jobType: 'TTS'
  status: string
  sceneCount: number
  sentenceCount: number
  finalIllustrationJobId: number | null  // ← 추가
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd app/frontend && pnpm tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
git add app/frontend/src/features/story-creation/highlight-outro/api/postStoryboardConfirm.ts
git commit -m "[FE] feat: confirm 응답 타입에 finalIllustrationJobId 추가"
```

---

### Task 19: HighlightOutroStep 에서 confirm 응답의 finalIllustrationJobId 동기화

**Files:**
- Modify: `app/frontend/src/features/story-creation/highlight-outro/ui/HighlightOutroStep.tsx:308-321`

> 이유: Step 5 에서 store 에 저장된 jobId 가 (예: 사용자가 Step 5 로 돌아가 다시 PATCH 했거나, sessionStorage 만료 등으로) 비어 있을 수 있으므로 confirm 응답 값으로 보정.

- [ ] **Step 1: props 에 setFinalIllustrationJobId 추가**

기존:

```typescript
interface HighlightOutroStepProps {
  storyId: number
  setStoryGenerationJobId: (jobId: number) => void
  // ...
}
```

변경:

```typescript
interface HighlightOutroStepProps {
  storyId: number
  setStoryGenerationJobId: (jobId: number) => void
  setFinalIllustrationJobId: (jobId: number | null) => void  // ← 추가
  // ...
}
```

- [ ] **Step 2: handleNext 에서 응답 받고 동기화**

기존:

```typescript
const job = await confirmStoryboard(storyId)
setStoryGenerationJobId(job.jobId)
```

변경:

```typescript
const job = await confirmStoryboard(storyId)
setStoryGenerationJobId(job.jobId)
if (job.finalIllustrationJobId !== null) {
  setFinalIllustrationJobId(job.finalIllustrationJobId)
}
```

- [ ] **Step 3: CreationPage 에서 새 setter 전달**

```tsx
<HighlightOutroStep
  storyId={flow.storyId!}
  setStoryGenerationJobId={flow.setStoryGenerationJobId}
  setFinalIllustrationJobId={flow.setFinalIllustrationJobId}  // ← 추가
  // ...
/>
```

- [ ] **Step 4: 타입 체크**

```bash
cd app/frontend && pnpm tsc --noEmit
```

- [ ] **Step 5: 커밋**

```bash
git add app/frontend/src/features/story-creation/highlight-outro/ui/HighlightOutroStep.tsx
git add app/frontend/src/pages/creation/CreationPage.tsx
git commit -m "[FE] feat: confirm 응답의 finalIllustrationJobId 로 store 보정"
```

---

### Task 20: FinalPreviewStep 이중 폴링

**Files:**
- Modify: `app/frontend/src/features/story-creation/final-preview/ui/FinalPreviewStep.tsx:42-87`

- [ ] **Step 1: props 에 finalIllustrationJobId 추가**

```typescript
interface FinalPreviewStepProps {
  storyId: number
  storyGenerationJobId: number | null
  finalIllustrationJobId: number | null  // ← 추가
  // ...
}
```

- [ ] **Step 2: 두 개의 useGenerationJobQuery 호출 + 두 잡 모두 SUCCESS 일 때만 fetch**

기존:

```typescript
const jobQuery = useGenerationJobQuery(storyGenerationJobId)
const shouldFetch = !storyGenerationJobId || jobQuery.data?.status === 'SUCCESS'
```

변경:

```typescript
const ttsJobQuery = useGenerationJobQuery(storyGenerationJobId)
const finalJobQuery = useGenerationJobQuery(finalIllustrationJobId)

const ttsReady = !storyGenerationJobId || ttsJobQuery.data?.status === 'SUCCESS'
const finalReady = !finalIllustrationJobId || finalJobQuery.data?.status === 'SUCCESS'
const shouldFetch = ttsReady && finalReady
```

- [ ] **Step 3: UI 진행률 표시 — 둘 중 하나라도 RUNNING 이면 진행 중 표시**

```tsx
{!shouldFetch && (
  <ProgressIndicator
    ttsStatus={ttsJobQuery.data?.status}
    finalStatus={finalJobQuery.data?.status}
  />
)}
```

> ProgressIndicator UI 는 기존 디자인 시스템에 맞춰 작성. 별도 component 로 빼지 않고 inline 렌더 가능.

- [ ] **Step 4: 실패 처리 — 둘 중 하나라도 FAILED 이면 에러 UI**

```tsx
const isFailed = ttsJobQuery.data?.status === 'FAILED' || finalJobQuery.data?.status === 'FAILED'
const isTimedOut = ttsJobQuery.isTimedOut || finalJobQuery.isTimedOut
```

- [ ] **Step 5: 타입 체크**

```bash
cd app/frontend && pnpm tsc --noEmit
```

- [ ] **Step 6: 커밋**

```bash
git add app/frontend/src/features/story-creation/final-preview/ui/FinalPreviewStep.tsx
git commit -m "[FE] feat: FinalPreviewStep — TTS + FINAL 두 잡 동시 폴링"
```

---

## Phase 8 — 통합 검증

### Task 21: 백엔드 전체 테스트 실행

- [ ] **Step 1: 전체 테스트**

```bash
cd app/backend && ./gradlew test
```
Expected: ALL PASS

- [ ] **Step 2: 실패 발생 시 원인 파악 후 수정 → 재실행**

---

### Task 22: 프론트엔드 빌드 + lint

- [ ] **Step 1: 타입 체크 + 빌드**

```bash
cd app/frontend && pnpm tsc --noEmit && pnpm build
```
Expected: SUCCESS

- [ ] **Step 2: lint**

```bash
cd app/frontend && pnpm lint
```
Expected: PASS

---

### Task 23: 로컬 E2E 스모크 테스트 (수동)

**시나리오:** Step 1~9 까지 끝까지 진행하면서 스타일 변경 시 final illustration 잡이 백그라운드로 도는지, Step 8 에서 두 잡 모두 폴링되는지 확인.

- [ ] **Step 1: 로컬 dev 서버 모두 기동**

```bash
# infra
docker compose -f infra/docker/docker-compose.local.yml up -d
# AI
cd app/ai && uvicorn app.main:app --reload --port 8000
# AI consumer
cd app/ai && python -m app.consumers.final_illustration_consumer
# BE
cd app/backend && ./gradlew bootRun
# FE
cd app/frontend && pnpm dev
```

- [ ] **Step 2: 브라우저로 동화 생성 진행 (Step 1~5)**

- [ ] **Step 3: Step 5 에서 스타일 선택 → 다음. 네트워크 탭에서 PATCH /style 응답에 `finalIllustrationJobId: <number>` 가 있는지 확인.**

- [ ] **Step 4: Step 6, 7 진행하는 동안 BE 로그에서 FINAL_ILLUSTRATION 잡 RUNNING → SUCCESS 전이 관찰.**

- [ ] **Step 5: Step 7 confirm 응답에 `finalIllustrationJobId` 가 같은 값으로 포함되는지 확인.**

- [ ] **Step 6: Step 8 진입 시 두 잡 모두 SUCCESS → scenes 의 illustrationUrl 이 컬러 final 이미지 URL 인지 확인.**

- [ ] **Step 7: 회귀 — Step 5 로 돌아가 같은 스타일 다시 선택 시 새 잡이 안 만들어지고 기존 jobId 가 반환되는지 확인 (멱등 가드).**

- [ ] **Step 8: Step 5 로 돌아가 다른 스타일 선택 시 새 잡이 만들어지는지 확인.**

---

### Task 24: 최종 정리 커밋

- [ ] **Step 1: 변경된 모든 파일 git status 확인 → 누락된 add 없는지 점검**

```bash
git status
```

- [ ] **Step 2: 변경 요약 작성 후 push 준비**

(개별 커밋이 이미 다 떨어져 있으므로 추가 커밋은 필요 시만.)

- [ ] **Step 3: PR 생성은 사용자 요청 시에만 진행**

---

## 자가 점검 (Self-Review)

- [x] **Spec 커버리지**
  - Step 5 PATCH /style 자동 enqueue → Task 5, 8, 9
  - 멱등 가드 → Task 5 (Step 1, findReusableJob)
  - confirm 응답에 finalIllustrationJobId 포함 → Task 12 Step 1, 3
  - FE 이중 폴링 → Task 20
  - storyboard rough 의미 보존 → Scene.illustrationUrl 만 final 로 갱신 (Task 10, 12)
- [x] **Placeholder 없음** — 모든 코드/명령어 구체적
- [x] **타입 일관성**
  - `finalIllustrationJobId: Long`(BE) ↔ `number`(FE)
  - confirm 응답에서 `Long?` ↔ `number | null`
  - state setter 시그니처 일관 (`(jobId: number) => void`, 단 nullable 보정용은 `number | null`)
- [x] **Repository / 헬퍼 메서드 미존재 시 추가 명시**
  - `StoryGenerationJobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc` (Task 5)
  - `SceneRepository.findByStoryIdAndPageNumber` (Task 10 Step 4)
  - `StoryErrorCode.STORYBOARD_IMAGES_NOT_READY` (Task 5 Step 2)

---

**완료 시 결과**: Step 5 에서 사용자가 스타일을 고르면 BE 가 즉시 FINAL_ILLUSTRATION 잡을 enqueue 하여 AI 가 백그라운드로 컬러 일러스트를 생성하고, 사용자가 Step 6/7 진행 중에 잡이 끝나며, Step 8 에서 TTS 와 FINAL 두 잡이 모두 SUCCESS 인 시점에 컬러 일러스트가 표시된다. 같은 스타일 재선택은 멱등 처리, confirm 시점이 final 보다 빨라도 콜백이 scenes 를 update 해 자연스럽게 화면 갱신된다.
