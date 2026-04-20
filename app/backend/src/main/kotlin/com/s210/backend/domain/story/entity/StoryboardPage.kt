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

    @Column(name = "english_text", columnDefinition = "TEXT")
    var englishText: String? = null,

    @Column(name = "korean_text", columnDefinition = "TEXT")
    var koreanText: String? = null,

    @Column(name = "image_url", length = 500)
    var imageUrl: String? = null
) : BaseTimeEntity()
