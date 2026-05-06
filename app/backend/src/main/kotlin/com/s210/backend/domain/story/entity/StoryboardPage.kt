package com.s210.backend.domain.story.entity

import com.s210.backend.common.entity.BaseTimeEntity
import jakarta.persistence.*

@Entity
@Table(name = "storyboard_pages")
class StoryboardPage(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "story_board_id", nullable = false)
    val storyBoardId: Long,

    @Column(name = "page_number", nullable = false)
    var pageNumber: Int,

    /** AI 가 생성한 영어 장면 요약. 페이지별 이미지 생성 시 Gemini 입력의 컨텍스트로 들어간다. */
    @Column(name = "scene_summary", columnDefinition = "TEXT")
    var sceneSummary: String? = null,

    /** AI 가 생성한 영어 그림 프롬프트. 이미지 생성 페이로드의 핵심 입력. */
    @Column(name = "image_prompt", columnDefinition = "TEXT")
    var imagePrompt: String? = null,

    @Column(name = "sentences", columnDefinition = "JSON")
    var sentences: String? = null,

    @Column(name = "image_url", length = 500)
    var imageUrl: String? = null
) : BaseTimeEntity()
