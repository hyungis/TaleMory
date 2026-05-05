import { get } from '../../../../shared/api'
import { mapTermResponseToDetail, type TermDetail, type TermResponse } from '../model/termDetails'

export async function getTerms(): Promise<TermDetail[]> {
  const payload = await get<TermResponse[]>('/terms', {
    skipAuth: true,
    timeoutMs: 5000,
  })

  return payload
    .filter(term => term.isRequired)
    .map(mapTermResponseToDetail)
    .filter((term): term is TermDetail => term !== null)
}
