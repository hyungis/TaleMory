package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.PhotoAlbumItem
import com.s210.backend.domain.story.model.PhotoPurpose
import org.springframework.data.jpa.repository.JpaRepository

interface PhotoAlbumItemRepository : JpaRepository<PhotoAlbumItem, Long> {
    /** 갤러리 표시용 — display_order 오름차순 + soft-delete 제외. */
    fun findAllByStoryIdAndDeletedAtIsNullOrderByDisplayOrderAsc(storyId: Long): List<PhotoAlbumItem>

    /** `addPhoto` 에서 새 row 의 display_order 를 "기존 최대 + 1" 로 채우기 위해. */
    fun findFirstByStoryIdAndDeletedAtIsNullOrderByDisplayOrderDesc(storyId: Long): PhotoAlbumItem?

    /**
     * purpose 기준 활성 사진 조회 — display_order 오름차순.
     *
     * 사용처:
     *  - 추억 사진 모음 (스토리 본문 입력): purposes = [STORYBOARD, BOTH]
     *  - reference 모음 (AI characterSourceImageS3Keys): purposes = [CHARACTER_REF, BOTH]
     */
    fun findAllByStoryIdAndPurposeInAndDeletedAtIsNullOrderByDisplayOrderAsc(
        storyId: Long,
        purposes: Collection<PhotoPurpose>,
    ): List<PhotoAlbumItem>

    /**
     * purpose 기준 활성 사진 카운트.
     *
     * 사용처:
     *  - "대표 X/3" 카운터 (FE 노출용)
     *  - max-3 검증 (toggleCharacterRef / addCharacterRef)
     *  - Step 3 진입 차단 검증 (>= 1)
     */
    fun countByStoryIdAndPurposeInAndDeletedAtIsNull(
        storyId: Long,
        purposes: Collection<PhotoPurpose>,
    ): Long
}
