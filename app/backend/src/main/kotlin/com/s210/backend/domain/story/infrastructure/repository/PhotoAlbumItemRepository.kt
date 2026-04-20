package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.PhotoAlbumItem
import org.springframework.data.jpa.repository.JpaRepository

interface PhotoAlbumItemRepository : JpaRepository<PhotoAlbumItem, Long>
