package com.s210.backend.domain.preset.application.dto

data class StylePresetResult(
    val id: Long,
    val code: String,
    val name: String,
    val previewUrl: String?
)
