package com.s210.backend.domain.user.infrastructure.repository

import jakarta.persistence.EntityManager
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
class WithdrawnUserCleanupRepository(
    private val entityManager: EntityManager,
) {
    fun deleteWithdrawnUsersBefore(cutoff: LocalDateTime): Int {
        deleteStoryGenerationJobs(cutoff)
        deleteSceneHighlightVoices(cutoff)
        deleteSceneSentences(cutoff)
        deleteScenes(cutoff)
        deleteStoryboardPages(cutoff)
        deleteStoryBoards(cutoff)
        deletePhotoAlbumItems(cutoff)
        deleteStoryOutros(cutoff)
        deleteStoryProgress(cutoff)
        deleteStories(cutoff)
        deleteOauthAccounts(cutoff)
        deletePersons(cutoff)
        deleteVoiceProfiles(cutoff)
        return deleteUsers(cutoff)
    }

    private fun deleteStoryGenerationJobs(cutoff: LocalDateTime) {
        execute(
            """
                DELETE j FROM story_generation_jobs j
                JOIN stories s ON j.story_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            cutoff,
        )
    }

    private fun deleteSceneHighlightVoices(cutoff: LocalDateTime) {
        execute(
            """
                DELETE shv FROM scene_highlight_voices shv
                JOIN scene_sentences ss ON shv.sentence_id = ss.id
                JOIN scenes sc ON ss.scene_id = sc.id
                JOIN stories s ON sc.story_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            cutoff,
        )
    }

    private fun deleteSceneSentences(cutoff: LocalDateTime) {
        execute(
            """
                DELETE ss FROM scene_sentences ss
                JOIN scenes sc ON ss.scene_id = sc.id
                JOIN stories s ON sc.story_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            cutoff,
        )
    }

    private fun deleteScenes(cutoff: LocalDateTime) {
        execute(
            """
                DELETE sc FROM scenes sc
                JOIN stories s ON sc.story_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            cutoff,
        )
    }

    private fun deleteStoryboardPages(cutoff: LocalDateTime) {
        execute(
            """
                DELETE sp FROM storyboard_pages sp
                JOIN story_board sb ON sp.story_board_id = sb.id
                JOIN stories s ON sb.story_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            cutoff,
        )
    }

    private fun deleteStoryBoards(cutoff: LocalDateTime) {
        execute(
            """
                DELETE sb FROM story_board sb
                JOIN stories s ON sb.story_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            cutoff,
        )
    }

    private fun deletePhotoAlbumItems(cutoff: LocalDateTime) {
        execute(
            """
                DELETE p FROM photo_album_items p
                JOIN stories s ON p.story_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            cutoff,
        )
    }

    private fun deleteStoryOutros(cutoff: LocalDateTime) {
        execute(
            """
                DELETE so FROM story_outros so
                JOIN stories s ON so.story_id = s.id
                JOIN users u ON s.user_id = u.id
                WHERE u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            cutoff,
        )
    }

    private fun deleteStoryProgress(cutoff: LocalDateTime) {
        execute(
            """
                DELETE sp FROM story_progress sp
                LEFT JOIN stories s ON sp.story_id = s.id
                LEFT JOIN users story_owner ON s.user_id = story_owner.id
                LEFT JOIN users progress_user ON sp.user_id = progress_user.id
                WHERE (
                    story_owner.deleted_at IS NOT NULL
                    AND story_owner.deleted_at < :cutoff
                ) OR (
                    progress_user.deleted_at IS NOT NULL
                    AND progress_user.deleted_at < :cutoff
                )
            """.trimIndent(),
            cutoff,
        )
    }

    private fun deleteStories(cutoff: LocalDateTime) {
        execute(
            """
                DELETE s FROM stories s
                JOIN users u ON s.user_id = u.id
                WHERE u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            cutoff,
        )
    }

    private fun deleteOauthAccounts(cutoff: LocalDateTime) {
        execute(
            """
                DELETE oa FROM oauth_accounts oa
                JOIN users u ON oa.user_id = u.id
                WHERE u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            cutoff,
        )
    }

    private fun deletePersons(cutoff: LocalDateTime) {
        execute(
            """
                DELETE p FROM persons p
                JOIN users u ON p.user_id = u.id
                WHERE u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            cutoff,
        )
    }

    private fun deleteVoiceProfiles(cutoff: LocalDateTime) {
        execute(
            """
                DELETE vp FROM voice_profiles vp
                JOIN users u ON vp.user_id = u.id
                WHERE u.deleted_at IS NOT NULL
                  AND u.deleted_at < :cutoff
            """.trimIndent(),
            cutoff,
        )
    }

    private fun deleteUsers(cutoff: LocalDateTime): Int =
        execute(
            """
                DELETE FROM users
                WHERE deleted_at IS NOT NULL
                  AND deleted_at < :cutoff
            """.trimIndent(),
            cutoff,
        )

    private fun execute(sql: String, cutoff: LocalDateTime): Int =
        entityManager
            .createNativeQuery(sql)
            .setParameter("cutoff", cutoff)
            .executeUpdate()
}
