package com.s210.backend.domain.preset.entity

import jakarta.persistence.*

@Entity
@Table(name = "style_presets")
class StylePreset(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, length = 50, unique = true)
    val code: String,

    @Column(nullable = false, length = 100)
    val name: String,

    @Column(name = "preview_url", length = 500)
    val previewUrl: String? = null,

    @Column(name = "style_prompt", nullable = false, columnDefinition = "TEXT")
    val stylePrompt: String,
)
