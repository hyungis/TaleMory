package com.s210.backend.domain.preset.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.preset.application.PresetService
import com.s210.backend.domain.preset.presentation.response.BgmPresetResponse
import com.s210.backend.domain.preset.presentation.response.StylePresetResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api")
class PresetController(
    private val presetService: PresetService,
) {

    // 삽화 스타일 프리셋 목록 조회
    @GetMapping("/style-presets")
    fun stylePresetList(): ResponseEntity<ApiResponse<List<StylePresetResponse>>> {
        val results = presetService.findAllStylePresets()
        val response = results.map { StylePresetResponse(it.id, it.code, it.name, it.previewUrl) }
        return ResponseEntity.ok(ApiResponse(data = response))
    }

    // BGM 프리셋 목록 조회
    @GetMapping("/bgm-presets")
    fun bgmPresetList(): ResponseEntity<ApiResponse<List<BgmPresetResponse>>> {
        // TODO: PresetService.findAllBgmPresets()
        TODO("Not yet implemented")
    }
}
