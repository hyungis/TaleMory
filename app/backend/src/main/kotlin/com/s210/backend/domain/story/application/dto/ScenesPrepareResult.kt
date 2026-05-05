package com.s210.backend.domain.story.application.dto

/**
 * Step 7 진입 시점에 호출되는 `prepareScenes` 의 반환 값.
 *
 * `storyboard_pages.sentences` JSON 으로부터 `scenes` + `scene_sentences` 를 평탄화 INSERT.
 * 멱등이라 이미 prepared 된 상태라면 `alreadyPrepared = true` 로 표기하고 기존 row 수를 그대로 반환.
 */
data class ScenesPrepareResult(
    /** 신규/기존 합산 scene row 개수. */
    val sceneCount: Int,
    /** 신규/기존 합산 scene_sentence row 개수. */
    val sentenceCount: Int,
    /** true 면 이번 호출에서 INSERT 가 일어나지 않음 — FE 는 곧장 GET /scenes 로 진행. */
    val alreadyPrepared: Boolean,
)
