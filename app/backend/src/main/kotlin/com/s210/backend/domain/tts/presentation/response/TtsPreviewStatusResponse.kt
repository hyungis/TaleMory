package com.s210.backend.domain.tts.presentation.response

import com.s210.backend.common.redis.TtsPreviewSnapshot
import java.time.Instant

data class TtsPreviewStatusResponse(
    val previewId: String,
    val status: String,
    val audioUrl: String?,
    val errorCode: String?,
    val errorMessage: String?,
    val createdAt: Instant,
    val finishedAt: Instant?,
) {
    companion object {
        fun from(snapshot: TtsPreviewSnapshot) = TtsPreviewStatusResponse(
            previewId = snapshot.previewId,
            status = snapshot.status.name,
            audioUrl = snapshot.audioUrl,
            errorCode = snapshot.errorCode,
            errorMessage = snapshot.errorMessage,
            createdAt = snapshot.createdAt,
            finishedAt = snapshot.finishedAt,
        )
    }
}
