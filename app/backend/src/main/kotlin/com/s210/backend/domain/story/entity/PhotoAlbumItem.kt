package com.s210.backend.domain.story.entity

import com.s210.backend.common.entity.SoftDeletableEntity
import com.s210.backend.domain.story.model.PhotoPurpose
import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "photo_album_items")
class PhotoAlbumItem(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "story_id", nullable = false)
    val storyId: Long,

    @Column(name = "image_url", nullable = false, length = 500)
    var imageUrl: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var purpose: PhotoPurpose = PhotoPurpose.STORYBOARD,

    @Column(length = 500)
    var description: String? = null,

    @Column(name = "tags_json", columnDefinition = "JSON")
    var tagsJson: String? = null,

    @Column(name = "taken_at")
    var takenAt: LocalDateTime? = null,

    @Column(name = "display_order", nullable = false)
    var displayOrder: Long
) : SoftDeletableEntity()
