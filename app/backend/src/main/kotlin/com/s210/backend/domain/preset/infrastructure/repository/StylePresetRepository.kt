package com.s210.backend.domain.preset.infrastructure.repository

import com.s210.backend.domain.preset.entity.StylePreset
import org.springframework.data.jpa.repository.JpaRepository

interface StylePresetRepository : JpaRepository<StylePreset, Long>
