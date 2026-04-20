package com.s210.backend.domain.preset.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.preset.presentation.response.BgmPresetResponse
import com.s210.backend.domain.preset.presentation.response.StylePresetResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1")
class PresetController {

    // 삽화 스타일 프리셋 목록 조회
    @GetMapping("/style-presets")
    fun stylePresetList(): ResponseEntity<ApiResponse<List<StylePresetResponse>>> {
        // TODO: PresetService.findAllStylePresets()
        TODO("Not yet implemented")
    }

    // BGM 프리셋 목록 조회
    @GetMapping("/bgm-presets")
    fun bgmPresetList(): ResponseEntity<ApiResponse<List<BgmPresetResponse>>> {
        // TODO: PresetService.findAllBgmPresets()
        TODO("Not yet implemented")
    }
}
