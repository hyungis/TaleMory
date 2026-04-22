/**
 * 삽화 스타일 프리셋 — `style_presets` 테이블 대응.
 */

export type StylePresetCode = 'watercolor' | 'digital' | 'crayon' | 'line' | 'collage'

export interface StylePreset {
  id: number
  code: StylePresetCode
  name: string
  previewUrl: string
}
