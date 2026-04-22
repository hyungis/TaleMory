package com.s210.backend.domain.preset.infrastructure.repository

import com.s210.backend.domain.preset.entity.BgmPreset
import org.springframework.data.jpa.repository.JpaRepository

interface BgmPresetRepository : JpaRepository<BgmPreset, Long>
