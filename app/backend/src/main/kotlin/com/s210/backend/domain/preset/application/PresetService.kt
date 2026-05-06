package com.s210.backend.domain.preset.application

import com.s210.backend.domain.preset.application.dto.StylePresetResult
import com.s210.backend.domain.preset.infrastructure.repository.StylePresetRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(readOnly = true)
class PresetService(
    private val stylePresetRepository: StylePresetRepository,
) {
    fun findAllStylePresets(): List<StylePresetResult> =
        stylePresetRepository.findAll().map {
            StylePresetResult(it.id, it.code, it.name, it.previewUrl)
        }
}
