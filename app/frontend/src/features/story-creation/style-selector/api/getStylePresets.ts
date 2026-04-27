import { get } from '../../../../shared/api/client'

export interface StylePresetDto {
  id: number
  code: string
  name: string
  previewUrl: string | null
}

export function getStylePresets(): Promise<StylePresetDto[]> {
  return get<StylePresetDto[]>('/style-presets')
}
