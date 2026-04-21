package com.s210.backend.domain.preset.presentation.response

data class StylePresetResponse(
    val id: Long,
    val code: String,
    val name: String,
    val previewUrl: String?
)

data class BgmPresetResponse(
    val id: Long,
    val code: String,
    val name: String,
    val audioUrl: String
)
