import { MOCK_DICTIONARY } from './mockDictionary'

/**
 * 단어 번역 조회 API 호출 (`GET /api/dictionary/words/{word}`).
 * 현재는 Mock 모드 — 로그인/토큰 인프라가 완성되면 실제 호출 경로를 활성화한다.
 *
 * 반환값: 뜻(한글). 미등록 단어면 null.
 */

const USE_MOCK = import.meta.env.VITE_VIEWER_USE_MOCK !== 'false'

export async function getWordMeaning(rawWord: string): Promise<string | null> {
  const word = rawWord.trim().toLowerCase()
  if (!word) return null

  if (USE_MOCK) {
    // 네트워크처럼 약간의 딜레이로 로딩 UI 확인 가능
    await new Promise(resolve => setTimeout(resolve, 150))
    return MOCK_DICTIONARY[word] ?? null
  }

  // ===== 로그인/토큰 인프라 완성 후 활성화 =====
  // const token = localStorage.getItem('accessToken')
  // try {
  //   const res = await apiClient<{ word: string; meaning: string }>(
  //     `/dictionary/words/${encodeURIComponent(word)}`,
  //     { method: 'GET', headers: token ? { Authorization: `Bearer ${token}` } : {} },
  //   )
  //   return res.meaning
  // } catch (err) {
  //   if (err instanceof ApiError && err.status === 404) return null
  //   throw err
  // }
  throw new Error('단어 사전 실 API 는 로그인 구현 후 활성화됩니다. VITE_VIEWER_USE_MOCK 확인 필요.')
}
