package com.s210.backend.domain.user.infrastructure.repository

import jakarta.persistence.EntityManager
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Repository
class WithdrawnUserCleanupRepository(
    private val entityManager: EntityManager,
) {
    // Baseline FKs do not use ON DELETE CASCADE, so hard delete children explicitly in FK order.
    @Transactional(readOnly = true)
    fun findExpiredWithdrawnUserIds(cutoff: LocalDateTime, limit: Int): List<Long> =
        entityManager
            .createNativeQuery(
                """
                    SELECT id
                    FROM users
                    WHERE deleted_at IS NOT NULL
                      AND deleted_at < :cutoff
                    ORDER BY id
                """.trimIndent(),
            )
            .setParameter("cutoff", cutoff)
            .setMaxResults(limit)
            .resultList
            .map { id -> (id as Number).toLong() }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun deleteWithdrawnUsersByIds(userIds: List<Long>, cutoff: LocalDateTime): Int {
        if (userIds.isEmpty()) return 0

        deleteStoryGenerationJobs(userIds, cutoff)
        deleteSceneHighlightVoices(userIds, cutoff)
        deleteSceneSentences(userIds, cutoff)
        deleteScenes(userIds, cutoff)
        deleteStoryboardPages(userIds, cutoff)
        deleteStoryBoards(userIds, cutoff)
        deletePhotoAlbumItems(userIds, cutoff)
        deleteStoryOutros(userIds, cutoff)
        deleteStoryProgress(userIds, cutoff)
        deleteStories(userIds, cutoff)
        deleteOauthAccounts(userIds, cutoff)
        deletePersons(userIds, cutoff)
        deleteVoiceProfiles(userIds, cutoff)
        return deleteUsers(userIds, cutoff)
    }

    private fun deleteStoryGenerationJobs(userIds: List<Long>, cutoff: LocalDateTime) {
        execute(
            """
                DELETE j FROM story_generation_jobs j
                JOIN stories s ON j.story_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE u.id IN (:userIds)
                  AND u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            userIds,
            cutoff,
        )
    }

    private fun deleteSceneHighlightVoices(userIds: List<Long>, cutoff: LocalDateTime) {
        execute(
            """
                DELETE shv FROM scene_highlight_voices shv
                JOIN scene_sentences ss ON shv.sentence_id = ss.id
                JOIN scenes sc ON ss.scene_id = sc.id
                JOIN stories s ON sc.story_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE u.id IN (:userIds)
                  AND u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            userIds,
            cutoff,
        )
    }

    private fun deleteSceneSentences(userIds: List<Long>, cutoff: LocalDateTime) {
        execute(
            """
                DELETE ss FROM scene_sentences ss
                JOIN scenes sc ON ss.scene_id = sc.id
                JOIN stories s ON sc.story_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE u.id IN (:userIds)
                  AND u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            userIds,
            cutoff,
        )
    }

    private fun deleteScenes(userIds: List<Long>, cutoff: LocalDateTime) {
        execute(
            """
                DELETE sc FROM scenes sc
                JOIN stories s ON sc.story_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE u.id IN (:userIds)
                  AND u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            userIds,
            cutoff,
        )
    }

    private fun deleteStoryboardPages(userIds: List<Long>, cutoff: LocalDateTime) {
        execute(
            """
                DELETE sp FROM storyboard_pages sp
                JOIN story_board sb ON sp.story_board_id = sb.id
                JOIN stories s ON sb.story_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE u.id IN (:userIds)
                  AND u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            userIds,
            cutoff,
        )
    }

    private fun deleteStoryBoards(userIds: List<Long>, cutoff: LocalDateTime) {
        execute(
            """
                DELETE sb FROM story_board sb
                JOIN stories s ON sb.story_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE u.id IN (:userIds)
                  AND u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            userIds,
            cutoff,
        )
    }

    private fun deletePhotoAlbumItems(userIds: List<Long>, cutoff: LocalDateTime) {
        execute(
            """
                DELETE p FROM photo_album_items p
                JOIN stories s ON p.story_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE u.id IN (:userIds)
                  AND u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            userIds,
            cutoff,
        )
    }

    private fun deleteStoryOutros(userIds: List<Long>, cutoff: LocalDateTime) {
        execute(
            """
                DELETE so FROM story_outros so
                JOIN stories s ON so.story_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE u.id IN (:userIds)
                  AND u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            userIds,
            cutoff,
        )
    }

    private fun deleteStoryProgress(userIds: List<Long>, cutoff: LocalDateTime) {
        execute(
            """
                DELETE sp FROM story_progress sp
                LEFT JOIN stories s ON sp.story_id = s.id
                LEFT JOIN users story_owner ON s.user_id = story_owner.id
                LEFT JOIN users progress_user ON sp.user_id = progress_user.id
                WHERE (
                    story_owner.id IN (:userIds)
                    AND story_owner.deleted_at IS NOT NULL
                    AND story_owner.deleted_at < :cutoff
                ) OR (
                    progress_user.id IN (:userIds)
                    AND progress_user.deleted_at IS NOT NULL
                    AND progress_user.deleted_at < :cutoff
                )
            """.trimIndent(),
            userIds,
            cutoff,
        )
    }

    private fun deleteStories(userIds: List<Long>, cutoff: LocalDateTime) {
        execute(
            """
                DELETE s FROM stories s
                JOIN users u ON s.user_id = u.id
                WHERE u.id IN (:userIds)
                  AND u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            userIds,
            cutoff,
        )
    }

    private fun deleteOauthAccounts(userIds: List<Long>, cutoff: LocalDateTime) {
        execute(
            """
                DELETE oa FROM oauth_accounts oa
                JOIN users u ON oa.user_id = u.id
                WHERE u.id IN (:userIds)
                  AND u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            userIds,
            cutoff,
        )
    }

    private fun deletePersons(userIds: List<Long>, cutoff: LocalDateTime) {
        execute(
            """
                DELETE p FROM persons p
                JOIN users u ON p.user_id = u.id
                WHERE u.id IN (:userIds)
                  AND u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            userIds,
            cutoff,
        )
    }

    private fun deleteVoiceProfiles(userIds: List<Long>, cutoff: LocalDateTime) {
        execute(
            """
                DELETE vp FROM voice_profiles vp
                JOIN users u ON vp.user_id = u.id
                WHERE u.id IN (:userIds)
                  AND u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            userIds,
            cutoff,
        )
    }

    private fun deleteUsers(userIds: List<Long>, cutoff: LocalDateTime): Int =
        execute(
            """
                DELETE FROM users
                WHERE id IN (:userIds)
                  AND deleted_at IS NOT NULL
                  AND deleted_at < :cutoff
            """.trimIndent(),
            userIds,
            cutoff,
        )

    private fun execute(sql: String, userIds: List<Long>, cutoff: LocalDateTime): Int {
        val expandedSql = sql.replace(":userIds", userIds.indices.joinToString(",") { ":userId$it" })
        val query = entityManager
            .createNativeQuery(expandedSql)
            .setParameter("cutoff", cutoff)

        userIds.forEachIndexed { index, userId ->
            query.setParameter("userId$index", userId)
        }

        return query.executeUpdate()
    }
}
