import type { WordEntry } from '../model/types'
import { MOCK_DICTIONARY } from './mockDictionary'
import { apiClient } from '../../../shared/api'

/**
 * 단어 번역 조회 API 호출 (`GET /api/dictionary/words/{word}`).
 * public endpoint — 인증 불필요.
 *
 * 반환값: 품사별 WordEntry 배열. 미등록 단어면 빈 배열.
 */

const USE_MOCK = import.meta.env.VITE_VIEWER_USE_MOCK === 'true'

export async function getWordMeaning(rawWord: string): Promise<WordEntry[]> {
  const word = rawWord.trim().toLowerCase()
  if (!word) return []

  if (USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 150))
    const meaning = MOCK_DICTIONARY[word]
    if (!meaning) return []
    return [{ word, pos: null, definitionKo: meaning, ipa: null, forms: null }]
  }

  const entries = await apiClient<WordEntry[]>(
    `/dictionary/words/${encodeURIComponent(word)}`,
    { skipAuth: true },
  )
  return entries ?? []
}
