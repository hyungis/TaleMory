package com.s210.backend.domain.story.entity

import com.s210.backend.common.entity.SoftDeletableEntity
import com.s210.backend.domain.story.model.Difficulty
import com.s210.backend.domain.story.model.StoryMode
import com.s210.backend.domain.story.model.StoryStatus
import jakarta.persistence.*
import java.time.LocalDate
import java.time.LocalDateTime

@Entity
@Table(name = "stories")
class Story(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "style_preset_id")
    var stylePresetId: Long? = null,

    @Column(name = "bgm_preset_id")
    var bgmPresetId: Long? = null,

    @Column(name = "voice_profile_id")
    var voiceProfileId: Long? = null,

    @Column(length = 200)
    var title: String? = null,

    @Column(columnDefinition = "TEXT")
    var synopsis: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var difficulty: Difficulty = Difficulty.BEGINNER,

    /**
     * 동화 생성 모드 — VIEWER(narration, 기본) / WEBTOON(대화).
     * 사용자가 메인의 "새 동화책 만들기" 모달에서 선택한 결과를 그대로 영속화.
     * StoryboardGenerationService 등이 mq publish 시 이 값을 storyMode 필드로 AI 워커에 전달.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var mode: StoryMode = StoryMode.VIEWER,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: StoryStatus = StoryStatus.DRAFT,

    @Column(name = "share_token", length = 64, unique = true)
    var shareToken: String? = null,

    @Column(name = "is_bookmarked", nullable = false)
    var isBookmarked: Boolean = false,

    @Column(name = "companions_json", nullable = false, columnDefinition = "JSON")
    var companionsJson: String,

    @Column(name = "main_character_json", nullable = false, columnDefinition = "JSON")
    var mainCharacterJson: String,

    @Column(name = "travel_place", length = 255)
    var travelPlace: String? = null,

    @Column(name = "travel_start_date")
    var travelStartDate: LocalDate? = null,

    @Column(name = "travel_end_date")
    var travelEndDate: LocalDate? = null,

    @Column(name = "published_at")
    var publishedAt: LocalDateTime? = null
) : SoftDeletableEntity()
