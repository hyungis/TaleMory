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
     * 잡이 한 번도 enqueue 되지 않았으면 null. FAILED/CANCELLED 상태여도 id 는 그대로 반환 —
     * FE 는 그 jobId 로 폴링해 실패 화면을 사용자에게 보여줄 수 있어야 하므로 의도된 동작.
     * (Scene.illustrationUrl 채움은 SUCCESS/RUNNING 잡만 사용하는 별도 로직으로 분리되어 있음.)
     * FE 는 이 값으로 Step 8 에서 TTS 와 함께 동시 폴링한다.
     */
    val finalIllustrationJobId: Long? = null,
)
