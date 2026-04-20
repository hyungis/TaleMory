package com.s210.backend.domain.story.entity

import com.s210.backend.common.entity.BaseTimeEntity
import jakarta.persistence.*

@Entity
@Table(name = "scenes")
class Scene(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "story_id", nullable = false)
    val storyId: Long,

    @Column(name = "page_number", nullable = false)
    val pageNumber: Int,

    @Column(name = "illustration_url", length = 500)
    var illustrationUrl: String? = null,

    @Column(name = "character_anchors", columnDefinition = "JSON")
    var characterAnchors: String? = null
) : BaseTimeEntity()
