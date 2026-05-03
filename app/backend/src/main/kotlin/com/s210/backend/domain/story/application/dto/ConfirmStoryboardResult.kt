package com.s210.backend.domain.story.application.dto

data class ConfirmStoryboardResult(
    val jobId: Long,
    val jobType: String,        // "TTS"
    val status: String,         // "PENDING" | "SUCCESS"
    val sceneCount: Int,
    val sentenceCount: Int,
    val cacheHits: Int,
    val cacheMisses: Int,
    /**
     * Step 5 PATCH /style 시점에 enqueue 된 FINAL_ILLUSTRATION 잡 id.
     * confirm 시점에 잡이 없거나 SUCCESS 도 RUNNING 도 아닌 상태(FAILED/CANCELLED)면 null.
     * FE 는 이 값으로 Step 8 에서 TTS 와 함께 동시 폴링한다.
     */
    val finalIllustrationJobId: Long? = null,
)
