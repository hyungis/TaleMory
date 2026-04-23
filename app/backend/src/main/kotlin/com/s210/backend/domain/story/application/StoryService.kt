package com.s210.backend.domain.story.application

import com.s210.backend.domain.story.application.dto.CreateStoryCommand
import com.s210.backend.domain.story.application.dto.StoryResult
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.model.StoryStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 동화 제작 워크스페이스의 진입 스토리 (DRAFT) 를 생성하는 유스케이스.
 *
 * 현재는 Step 1 (기본 정보 입력) 종료 시점에 호출되는 `addStory` 만 담당한다.
 * 이후 PATCH / publish / delete 같은 lifecycle 메서드는 후속 MR 에서 추가.
 */
@Service
@Transactional
class StoryService(
    private val storyRepository: StoryRepository,
) {
    /**
     * 기본 정보가 모두 채워진 상태로 새 동화 row 를 생성한다.
     * 상태는 무조건 DRAFT — 이후 단계에서 스토리보드/삽화/음성이 순차적으로 붙는다.
     */
    fun addStory(command: CreateStoryCommand): StoryResult =
        storyRepository.save(
            Story(
                userId = command.userId,
                title = command.title,
                difficulty = command.difficulty,
                status = StoryStatus.DRAFT,
                companionsJson = command.companionsJson,
                mainCharacterJson = command.mainCharacterJson,
                travelPlace = command.travelPlace,
                travelStartDate = command.travelStartDate,
                travelEndDate = command.travelEndDate,
            ),
        ).let(StoryResult::from)
}
