package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import org.springframework.stereotype.Component

@Component
class StoryboardEditGuard {
    fun assertEditable(story: Story) {
        if (story.stylePresetId != null) {
            throw BusinessException(StoryErrorCode.STORYBOARD_EDIT_LOCKED_BY_STYLE)
        }
    }
}
