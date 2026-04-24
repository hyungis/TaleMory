package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.PhotoAlbumItem
import org.springframework.data.jpa.repository.JpaRepository

interface PhotoAlbumItemRepository : JpaRepository<PhotoAlbumItem, Long> {
    /** 갤러리 표시용 — display_order 오름차순 + soft-delete 제외. */
    fun findAllByStoryIdAndDeletedAtIsNullOrderByDisplayOrderAsc(storyId: Long): List<PhotoAlbumItem>

    /** `addPhoto` 에서 새 row 의 display_order 를 "기존 최대 + 1" 로 채우기 위해. */
    fun findFirstByStoryIdAndDeletedAtIsNullOrderByDisplayOrderDesc(storyId: Long): PhotoAlbumItem?
}
